import express from 'express';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import { db, nowIso } from './db.mjs';
import {
  hashPassword,
  verifyPassword,
  createToken,
  userFromToken,
  publicUser,
  levelFromXp,
  xpToNextLevel,
} from './auth.mjs';
import {
  evaluateAchievements,
  listAchievements,
  currentStreak,
  isNightHour,
  localDay,
} from './achievements.mjs';
import {
  generateWords,
  generateSentences,
  generateCode,
  generateSymbols,
  generateDrill,
  isModeUnlocked,
  MODE_MIN_LEVEL,
} from './generator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);

const app = express();
app.use(express.json({ limit: '1mb' }));

/* ------------------------------------------------------------------ */
/*  Хелперы                                                            */
/* ------------------------------------------------------------------ */

function auth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = userFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  req.user = user;
  next();
}

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  req.user = userFromToken(token);
  next();
}

function levelInfo(user) {
  return { ...xpToNextLevel(user.xp), xp: user.xp };
}

function withUser(u) {
  return { ...publicUser(u), levelInfo: levelInfo(u), streak: currentStreak(u.id, 3) };
}

const AVATARS = ['neon', 'cyber', 'pulse', 'void'];
function pickAvatar() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

app.post('/api/auth/register', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const nickname = String(req.body?.nickname ?? '').trim() || email.split('@')[0];

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'weak_password' });
    return;
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) {
    res.status(409).json({ error: 'email_taken' });
    return;
  }

  const info = db
    .prepare('INSERT INTO users (email, password_hash, nickname, avatar) VALUES (?, ?, ?, ?)')
    .run(email, hashPassword(password), nickname, pickAvatar());
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = createToken(user.id, 'email');
  res.json({ token, user: withUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'bad_credentials' });
    return;
  }
  const token = createToken(user.id, 'email');
  res.json({ token, user: withUser(user) });
});

/** Быстрый вход через соцсети: создаёт/ищет пользователя по email. */
app.post('/api/auth/social', (req, res) => {
  const provider = String(req.body?.provider ?? 'google');
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'email_required' });
    return;
  }
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const nickname = String(req.body?.nickname ?? '').trim() || email.split('@')[0];
    const info = db
      .prepare('INSERT INTO users (email, password_hash, nickname, avatar) VALUES (?, ?, ?, ?)')
      .run(email, hashPassword(randomBytes(16).toString('hex')), nickname, pickAvatar());
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }
  const token = createToken(user.id, provider);
  res.json({ token, user: withUser(user) });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: withUser(req.user) });
});

/* ------------------------------------------------------------------ */
/*  Тренировки                                                        */
/* ------------------------------------------------------------------ */

/** Выдаёт текст для тренировки с учётом режима, языка и уровня. */
app.get('/api/train/text', optionalAuth, (req, res) => {
  const mode = String(req.query.mode ?? 'words');
  const language = String(req.query.language ?? 'ru');
  const level = Number(req.query.level ?? 1);
  const variant = req.query.variant ? String(req.query.variant) : null;
  const count = Number(req.query.count ?? 60);

  const userLevel = req.user?.level ?? level;

  if (!isModeUnlocked(mode, userLevel)) {
    res.status(403).json({
      error: 'mode_locked',
      required_level: MODE_MIN_LEVEL[mode] ?? 1,
      current_level: userLevel,
    });
    return;
  }

  switch (mode) {
    case 'sentences':
      res.json({ mode, language, text: generateSentences(language, userLevel, 6) });
      break;
    case 'code': {
      const { text, variant: v } = generateCode(language, userLevel, variant);
      res.json({ mode, language, text, variant: v });
      break;
    }
    case 'symbols':
      res.json({ mode, language, text: generateSymbols(userLevel, count) });
      break;
    case 'drill': {
      const chars = String(req.query.chars ?? '').split('').filter(Boolean);
      res.json({ mode, language, text: generateDrill(chars, language, count) });
      break;
    }
    case 'words':
    default:
      res.json({ mode, language, text: generateWords(language, userLevel, count) });
      break;
  }
});

/**
 * Приём результата сессии. Считает XP, ведёт дневную статистику,
 * логирует ошибки и триггерит разблокировку достижений.
 */
app.post('/api/train/session', auth, (req, res) => {
  const b = req.body ?? {};
  const mode = String(b.mode ?? 'words');
  const language = String(b.language ?? 'ru');
  const durationS = Number(b.duration ?? 60);
  const wpm = Number(b.wpm ?? 0);
  const rawWpm = Number(b.rawWpm ?? 0);
  const cpm = Number(b.cpm ?? 0);
  const accuracy = Number(b.accuracy ?? 100);
  const chars = Number(b.chars ?? 0);
  const errors = Number(b.errors ?? 0);
  const maxCombo = Number(b.maxCombo ?? 0);
  const comboMultiplier = Number(b.comboMultiplier ?? 1);
  const bonusXp = Number(b.bonusXp ?? 0);
  const errorLog = Array.isArray(b.errorLog) ? b.errorLog.slice(0, 500) : [];

  const baseXp = Math.round((wpm * durationS) / 60 / 10) + Math.max(0, chars - errors);
  const xpEarned = Math.max(1, Math.round((baseXp * comboMultiplier + bonusXp) * (accuracy / 100)));

  const finishedAt = new Date();
  const isNight = isNightHour(finishedAt);

  const info = db
    .prepare(
      `INSERT INTO typing_sessions
        (user_id, mode, language, duration_s, wpm, raw_wpm, cpm, accuracy, chars, errors, max_combo, xp_earned, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      req.user.id,
      mode,
      language,
      durationS,
      wpm,
      rawWpm,
      cpm,
      accuracy,
      chars,
      errors,
      maxCombo,
      xpEarned,
      new Date(finishedAt.getTime() - durationS * 1000).toISOString(),
      finishedAt.toISOString(),
    );

  const sessionId = Number(info.lastInsertRowid);

  const insertError = db.prepare(
    `INSERT INTO error_log (user_id, session_id, mode, expected, pressed, delay_ms)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const bumpKey = db.prepare(
    `INSERT INTO key_errors (user_id, key_char, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, key_char) DO UPDATE SET count = key_errors.count + 1`,
  );
  for (const e of errorLog) {
    const expected = String(e.expected ?? '');
    const pressed = String(e.pressed ?? '');
    if (!expected) continue;
    insertError.run(req.user.id, sessionId, mode, expected, pressed, Number(e.delayMs ?? 0));
    bumpKey.run(req.user.id, expected);
  }

  const day = localDay(finishedAt);
  db.prepare(
    `INSERT INTO user_daily (user_id, day, sessions_count, best_wpm, total_xp)
     VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(user_id, day) DO UPDATE SET
       sessions_count = sessions_count + 1,
       best_wpm = MAX(best_wpm, excluded.best_wpm),
       total_xp = total_xp + excluded.total_xp`,
  ).run(req.user.id, day, wpm, xpEarned);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const newXp = user.xp + xpEarned;
  const newLevel = levelFromXp(newXp);
  db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(newXp, newLevel, req.user.id);

  const session = {
    id: sessionId,
    mode,
    language,
    duration_s: durationS,
    wpm,
    raw_wpm: rawWpm,
    cpm,
    accuracy,
    chars,
    errors,
    max_combo: maxCombo,
    isNight,
  };

  const unlocked = evaluateAchievements(req.user.id, session);

  // Бонус XP за сами ачивки.
  let bonusFromAchievements = 0;
  for (const a of unlocked) bonusFromAchievements += a.reward_xp ?? 0;
  if (bonusFromAchievements > 0) {
    db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(bonusFromAchievements, req.user.id);
  }

  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({
    xpEarned,
    bonusFromAchievements,
    totalXp: fresh.xp,
    level: fresh.level,
    levelInfo: levelInfo(fresh),
    streak: currentStreak(fresh.id, 3),
    unlockedAchievements: unlocked,
    user: withUser(fresh),
  });
});

/* ------------------------------------------------------------------ */
/*  Профиль и статистика                                              */
/* ------------------------------------------------------------------ */

app.get('/api/profile', auth, (req, res) => {
  const uid = req.user.id;

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS sessions,
              COALESCE(SUM(chars), 0)    AS chars,
              COALESCE(SUM(errors), 0)   AS errors,
              COALESCE(SUM(xp_earned), 0) AS xp,
              COALESCE(AVG(wpm), 0)       AS avg_wpm,
              COALESCE(MAX(wpm), 0)       AS best_wpm,
              COALESCE(AVG(accuracy), 0)  AS avg_accuracy
         FROM typing_sessions WHERE user_id = ?`,
    )
    .get(uid);

  const totalChars = totals.chars;
  const totalErrors = totals.errors;
  const accuracy = totalChars + totalErrors > 0
    ? Math.max(0, (totalChars / (totalChars + totalErrors)) * 100)
    : 100;

  const byDay = db
    .prepare(
      `SELECT day, sessions_count AS sessions, best_wpm, total_xp AS xp
         FROM user_daily WHERE user_id = ?
        GROUP BY day ORDER BY day ASC LIMIT 60`,
    )
    .all(uid);

  const keyErrors = db
    .prepare(
      'SELECT key_char, count FROM key_errors WHERE user_id = ? ORDER BY count DESC LIMIT 40',
    )
    .all(uid);

  const byMode = db
    .prepare(
      `SELECT mode, COUNT(*) AS sessions, AVG(wpm) AS avg_wpm, MAX(wpm) AS best_wpm
         FROM typing_sessions WHERE user_id = ? GROUP BY mode`,
    )
    .all(uid);

  const recent = db
    .prepare(
      `SELECT id, mode, language, duration_s, wpm, raw_wpm, cpm, accuracy, chars, errors,
              max_combo, xp_earned, finished_at
         FROM typing_sessions WHERE user_id = ? ORDER BY finished_at DESC LIMIT 25`,
    )
    .all(uid);

  res.json({
    user: withUser(req.user),
    summary: {
      totalSessions: totals.sessions,
      totalChars: totalChars,
      totalErrors: totalErrors,
      totalXp: totals.xp,
      avgWpm: Number((totals.avg_wpm ?? 0).toFixed(1)),
      bestWpm: Number((totals.best_wpm ?? 0).toFixed(1)),
      accuracy: Number(accuracy.toFixed(2)),
      avgAccuracy: Number((totals.avg_accuracy ?? 0).toFixed(2)),
      streak: currentStreak(uid, 3),
    },
    byDay,
    byMode,
    keyErrors,
    recent,
    achievements: listAchievements(uid),
    recommendations: buildRecommendations(keyErrors),
  });
});


/**
 * Умные рекомендации: находим пары часто путаемых клавиш
 * и предлагаем персональное упражнение.
 */
function buildRecommendations(keyErrors) {
  const out = [];
  const byChar = new Map(keyErrors.map((k) => [k.key_char.toLowerCase(), k.count]));

  // Ищем визуально похожие / соседние пары (ОЛ, РК, МН, ТИ, ЬБ и т.п.)
  const PAIRS = [
    ['о', 'л'], ['п', 'и'], ['р', 'к'], ['м', 'н'], ['т', 'и'],
    ['ь', 'б'], ['ш', 'щ'], ['д', 'в'], ['з', 'х'], ['с', 'ь'],
    ['a', 's'], ['e', 'r'], ['i', 'o'], ['u', 'i'], ['n', 'm'],
    ['b', 'v'], ['g', 'h'], ['j', 'k'], ['q', 'g'],
  ];

  for (const [a, b] of PAIRS) {
    const ca = byChar.get(a) ?? 0;
    const cb = byChar.get(b) ?? 0;
    const total = ca + cb;
    if (total < 3) continue;
    out.push({
      id: `${a}-${b}`,
      chars: [a, b],
      count: total,
      text:
        `Заметили, что вы часто путаете клавиши «${a.toUpperCase()}» и «${b.toUpperCase()}». ` +
        `Нажмите кнопку ниже, чтобы сгенерировать персональное упражнение на эти буквы.`,
      drillChars: `${a}${b}`,
    });
  }

  out.sort((x, y) => y.count - x.count);
  return out.slice(0, 5);
}

/** Персональное упражнение по конкретным буквам. */
app.get('/api/profile/drill', auth, (req, res) => {
  const chars = String(req.query.chars ?? '').split('').filter(Boolean).slice(0, 6);
  const language = String(req.query.language ?? 'ru');
  res.json({ mode: 'drill', language, chars, text: generateDrill(chars, language, 40) });
});


/* ------------------------------------------------------------------ */
/*  Таблица лидеров                                                   */
/* ------------------------------------------------------------------ */

const LEADERBOARD_SORTS = {
  wpm: 'best_wpm',
  accuracy: 'avg_accuracy',
  xp: 'total_xp',
};

app.get('/api/leaderboard', optionalAuth, (req, res) => {
  const sortKey = String(req.query.sort ?? 'wpm');
  const sort = LEADERBOARD_SORTS[sortKey] ? sortKey : 'wpm';
  const period = String(req.query.period ?? 'all');

  let where = '';
  if (period === 'today') {
    where = "AND date(finished_at) = date('now','localtime')";
  } else if (period === 'week') {
    where = "AND finished_at >= datetime('now','localtime','-7 days')";
  }

  const rows = db
    .prepare(
      `SELECT u.id, u.nickname, u.avatar, u.xp,
              MAX(s.wpm)              AS best_wpm,
              AVG(s.wpm)              AS avg_wpm,
              AVG(s.accuracy)         AS avg_accuracy,
              COALESCE(SUM(s.xp_earned), 0) AS total_xp,
              COUNT(s.id)             AS sessions
         FROM users u
         JOIN typing_sessions s ON s.user_id = u.id ${where}
        GROUP BY u.id
       HAVING sessions > 0`,
    )
    .all();

  const enriched = rows.map((r) => {
    const value = sort === 'wpm' ? r.best_wpm : sort === 'accuracy' ? r.avg_accuracy : r.total_xp;
    return {
      id: r.id,
      nickname: r.nickname,
      avatar: r.avatar,
      xp: r.xp,
      bestWpm: Number((r.best_wpm ?? 0).toFixed(1)),
      avgWpm: Number((r.avg_wpm ?? 0).toFixed(1)),
      accuracy: Number((r.avg_accuracy ?? 0).toFixed(2)),
      totalXp: r.total_xp,
      sessions: r.sessions,
      value: Number((value ?? 0).toFixed(2)),
      isMe: req.user ? r.id === req.user.id : false,
    };
  });

  enriched.sort((a, b) => b.value - a.value || b.xp - a.xp);
  enriched.forEach((r, i) => {
    r.rank = i + 1;
  });

  const me = req.user ? enriched.find((r) => r.isMe) ?? null : null;
  res.json({ sort, period, rows: enriched, me });
});


/* ------------------------------------------------------------------ */
/*  Достижения (публичный список спецификаций)                        */
/* ------------------------------------------------------------------ */

app.get('/api/achievements', optionalAuth, (req, res) => {
  res.json({ achievements: listAchievements(req.user?.id ?? -1) });
});

/* ------------------------------------------------------------------ */
/*  Служебные                                                          */
/* ------------------------------------------------------------------ */

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: nowIso() });
});

/* ------------------------------------------------------------------ */
/*  Раздача собранного фронтенда                                      */
/* ------------------------------------------------------------------ */

const DIST = resolve(__dirname, '..', 'dist');
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(resolve(DIST, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('[api]', err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  console.log(`[api] Печать героя — сервер запущен на http://localhost:${PORT}`);
});
