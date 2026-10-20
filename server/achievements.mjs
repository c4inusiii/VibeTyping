import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Реестр ачивок хранится в JSON-конфигах (паттерн «Спецификация»).
 * Ядро ничего не знает о конкретных ачивках — оно лишь сверяет метрики.
 * Чтобы добавить 100+ новых ачивок, достаточно дописать JSON.
 */
export const ACHIEVEMENTS = JSON.parse(
  readFileSync(resolve(__dirname, 'data', 'achievements.json'), 'utf8'),
);

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.achievement_id, a]));

export function getAchievement(id) {
  return BY_ID.get(id) ?? null;
}

/** Текущая дата по локальному времени сервера в формате YYYY-MM-DD. */
export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function localHour(date = new Date()) {
  return date.getHours();
}

export function isNightHour(date = new Date()) {
  const h = localHour(date);
  return h >= 22 || h < 6;
}


/**
 * Считает текущую длину «ударного режима» (daily streak):
 * количество подряд идущих дней с >= minPerDay тренировок, заканчивающихся сегодня.
 */
export function currentStreak(userId, minPerDay = 3) {
  const rows = db
    .prepare('SELECT day, sessions_count FROM user_daily WHERE user_id = ? ORDER BY day DESC LIMIT 400')
    .all(userId);
  if (rows.length === 0) return 0;

  const counts = new Map(rows.map((r) => [r.day, r.sessions_count]));
  const cursor = new Date();
  let streak = 0;

  // Если сегодня тренировок ещё не было — начинаем с вчерашнего дня.
  if (!counts.has(localDay(cursor)) || counts.get(localDay(cursor)) < minPerDay) {
    cursor.setDate(cursor.getDate() - 1);
  }

  for (;;) {
    const key = localDay(cursor);
    const n = counts.get(key) ?? 0;
    if (n < minPerDay) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}


/** Сводные метрики пользователя, которые умеет понимать движок ачивок. */
export function collectMetrics(userId, session = null) {
  const totals = db
    .prepare(
      `SELECT COUNT(*)        AS sessions,
              COALESCE(SUM(chars), 0)    AS chars,
              COALESCE(SUM(errors), 0)   AS errors,
              COALESCE(SUM(xp_earned), 0) AS xp,
              COALESCE(MAX(max_combo), 0) AS max_combo,
              COALESCE(AVG(wpm), 0)       AS avg_wpm
         FROM typing_sessions WHERE user_id = ?`,
    )
    .get(userId);

  const nightCode = db
    .prepare(
      `SELECT COUNT(*) AS n FROM typing_sessions
        WHERE user_id = ? AND mode = 'code'
          AND (CAST(strftime('%H', finished_at) AS INTEGER) >= 22
            OR CAST(strftime('%H', finished_at) AS INTEGER) < 6)`,
    )
    .get(userId).n;

  const metrics = {
    userId,
    total_xp: totals.xp,
    total_sessions: totals.sessions,
    total_chars: totals.chars,
    total_errors: totals.errors,
    max_combo: totals.max_combo,
    avg_wpm: totals.avg_wpm,
    nightly_code_sessions: nightCode,
    daily_streak: currentStreak(userId, 3),
  };

  if (session) {
    metrics.session_wpm = session.wpm;
    metrics.session_accuracy = session.accuracy;
    metrics.session_combo = session.max_combo;
    metrics.session_mode = session.mode;
    metrics.session_duration = session.duration_s;
    metrics.session_night = session.isNight ? 1 : 0;
  }
  return metrics;
}


/**
 * Проверяет одну спецификацию против метрик.
 * Возвращает true, если условие выполнено.
 */
export function matches(spec, metrics) {
  const t = spec.metric_target ?? 0;

  switch (spec.metric) {
    case 'session_wpm': {
      if ((metrics.session_wpm ?? 0) < t) return false;
      if (spec.metric_mode && metrics.session_mode !== spec.metric_mode) return false;
      if (spec.metric_min_accuracy != null && (metrics.session_accuracy ?? 0) < spec.metric_min_accuracy)
        return false;
      return true;
    }

    case 'max_combo':
      return Math.max(metrics.max_combo ?? 0, metrics.session_combo ?? 0) >= t;

    case 'session_combo':
      return (metrics.session_combo ?? 0) >= t;

    case 'perfect_sentence_session': {
      if (metrics.session_mode !== (spec.metric_mode ?? 'sentences')) return false;
      if ((metrics.session_accuracy ?? 0) < (spec.metric_min_accuracy ?? 100)) return false;
      if ((metrics.session_duration ?? 0) < (spec.metric_min_duration ?? 0)) return false;
      return true;
    }

    case 'night_code_sessions': {
      if ((metrics.session_mode ?? '') !== 'code') return false;
      if (!metrics.session_night) return false;
      return (metrics.nightly_code_sessions ?? 0) >= t;
    }

    case 'daily_streak':
      return (metrics.daily_streak ?? 0) >= t;

    case 'total_xp':
      return (metrics.total_xp ?? 0) >= t;

    case 'total_chars':
      return (metrics.total_chars ?? 0) >= t;

    case 'total_sessions':
      return (metrics.total_sessions ?? 0) >= t;

    default:
      return false;
  }
}

/**
 * Слушает событие окончания сессии, сверяет все спецификации с метриками
 * и разблокирует новые награды. Возвращает список разблокированных ачивок.
 */
export function evaluateAchievements(userId, session = null) {
  const metrics = collectMetrics(userId, session);
  const owned = new Set(
    db
      .prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?')
      .all(userId)
      .map((r) => r.achievement_id),
  );

  const unlocked = [];
  const insert = db.prepare(
    'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)',
  );

  for (const spec of ACHIEVEMENTS) {
    if (owned.has(spec.achievement_id)) continue;
    if (!matches(spec, metrics)) continue;
    insert.run(userId, spec.achievement_id, new Date().toISOString());
    owned.add(spec.achievement_id);
    unlocked.push(spec);
  }
  return unlocked;
}

/** Все ачивки с пометкой «разблокирована» для конкретного пользователя. */
export function listAchievements(userId) {
  const owned = new Map(
    db
      .prepare('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?')
      .all(userId)
      .map((r) => [r.achievement_id, r.unlocked_at]),
  );
  return ACHIEVEMENTS.map((spec) => ({
    ...spec,
    unlocked: owned.has(spec.achievement_id),
    unlocked_at: owned.get(spec.achievement_id) ?? null,
  }));
}

