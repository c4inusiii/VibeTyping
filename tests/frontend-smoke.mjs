/* Интеграционный смоук-тест фронтенд-сценариев через реальный API. */
const BASE = (process.env.BASE ?? 'http://localhost:8787').trim().replace(/\/+$/, '');

let pass = 0;
let fail = 0;

function check(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data, text };
}

const uniq = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const email = `smoke_${uniq}@print.hero`;
const password = 'hero12345';

console.log(`\n== Смоук-тест фронтенда (${BASE}) ==\n`);

// --- 1. Регистрация (как на странице /login) -------------------------
const reg = await req('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email, password, nickname: 'Смоук' }),
});
check('регистрация возвращает 200', reg.status === 200, `-> ${reg.status} ${reg.text}`);
check('регистрация возвращает token', typeof reg.data?.token === 'string');
check('регистрация возвращает levelInfo', typeof reg.data?.user?.levelInfo?.level === 'number');
check('регистрация возвращает streak', typeof reg.data?.user?.streak === 'number');
const token = reg.data?.token;
const userId = reg.data?.user?.id;

if (!token) {
  console.log('\nНет токена — дальнейшие проверки невозможны.\n');
  process.exit(1);
}

// --- 2. Повторная регистрация -> 409 ----------------------------------
const dup = await req('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
check('повторная регистрация даёт 409 email_taken', dup.status === 409 && dup.data?.error === 'email_taken');

// --- 3. Вход с неверным паролем -> 401 --------------------------------
const bad = await req('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password: 'wrongpassword' }),
});
check('неверный пароль даёт 401 bad_credentials', bad.status === 401 && bad.data?.error === 'bad_credentials');

// --- 4. Вход (как на странице /login) ---------------------------------
const login = await req('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
check('вход возвращает 200', login.status === 200, `-> ${login.status}`);
check('вход возвращает token', typeof login.data?.token === 'string');

// --- 5. /api/auth/me --------------------------------------------------
const me = await req('/api/auth/me', { token });
check('/api/auth/me отдаёт пользователя', me.status === 200 && me.data?.user?.id === userId);
check('у пользователя есть levelInfo', typeof me.data?.user?.levelInfo?.needed === 'number');

// --- 6. /api/train/text по всем режимам --------------------------------
// ВНИМАНИЕ: сервер смотрит на уровень авторизованного пользователя,
// а не на query-параметр level. У нового пользователя уровень 1,
// поэтому symbols (открывается с 5) корректно отдаёт 403.
for (const mode of ['words', 'sentences', 'code']) {
  const t = await req(`/api/train/text?mode=${mode}&language=ru&level=5`, { token });
  const ok = t.status === 200 && typeof t.data?.text === 'string' && t.data.text.length > 0;
  check(`/api/train/text mode=${mode} отдаёт текст`, ok, `-> ${t.status} ${t.text.slice(0, 120)}`);
}

const sym = await req('/api/train/text?mode=symbols&language=ru&level=5', { token });
check(
  'symbols закрыт для пользователя 1-го уровня (ожидаем 403)',
  sym.status === 403 && sym.data?.error === 'mode_locked',
  `-> ${sym.status}`,
);

// --- 7. symbols закрыт на низком уровне --------------------------------
const symLow = await req('/api/train/text?mode=symbols&language=ru&level=1', { token });
check(
  'symbols заблокирован без auth-уровня',
  symLow.status === 403 && symLow.data?.error === 'mode_locked',
  `-> ${symLow.status}`,
);

// --- 8. code с variant -------------------------------------------------
const code = await req('/api/train/text?mode=code&language=ru&level=3&variant=python', { token });
check(
  'code с variant=python возвращает variant',
  code.status === 200 && code.data?.variant === 'python',
  `-> ${code.status} ${code.data?.variant}`,
);

// --- 9. Отправка сессии (как из useTyping) ------------------------------
const session = await req('/api/train/session', {
  method: 'POST',
  token,
  body: JSON.stringify({
    mode: 'words',
    language: 'ru',
    duration: 60,
    wpm: 72,
    rawWpm: 80,
    cpm: 360,
    accuracy: 95.5,
    chars: 300,
    errors: 12,
    maxCombo: 34,
    comboMultiplier: 3,
    bonusXp: 250,
    errorLog: [
      { expected: 'о', pressed: 'щ', delayMs: 210 },
      { expected: 'л', pressed: 'о', delayMs: 180 },
      { expected: 'и', pressed: 'ш', delayMs: 240 },
    ],
  }),
});
check('сессия принята (200)', session.status === 200, `-> ${session.status} ${session.text}`);
check('сессия начислила XP', typeof session.data?.xpEarned === 'number' && session.data.xpEarned > 0);
check('сессия вернула levelInfo', typeof session.data?.levelInfo?.level === 'number');
check('сессия вернула streak', typeof session.data?.streak === 'number');
check('сессия вернула unlockedAchievements', Array.isArray(session.data?.unlockedAchievements));
check('сессия вернула user', typeof session.data?.user?.id === 'number');
check('XP пользователя вырос', (session.data?.user?.xp ?? 0) > 0);

// --- 10. /api/profile ---------------------------------------------------
const profile = await req('/api/profile', { token });
check('/api/profile отдаёт 200', profile.status === 200, `-> ${profile.status}`);
check('profile.summary.totalSessions = 1', profile.data?.summary?.totalSessions === 1);
check('profile.summary.totalChars = 300', profile.data?.summary?.totalChars === 300);
check('profile.summary.totalErrors = 12', profile.data?.summary?.totalErrors === 12);
check('profile.byDay содержит сегодня', Array.isArray(profile.data?.byDay) && profile.data.byDay.length >= 1);
check('profile.byMode содержит words', (profile.data?.byMode ?? []).some((m) => m.mode === 'words'));
check('profile.keyErrors содержит "о"', (profile.data?.keyErrors ?? []).some((k) => k.key_char === 'о'));
check('profile.recent содержит сессию', (profile.data?.recent ?? []).length === 1);
check('profile.achievements — массив', Array.isArray(profile.data?.achievements));
check('profile.recommendations — массив', Array.isArray(profile.data?.recommendations));

// --- 11. /api/profile/drill ---------------------------------------------
const drill = await req('/api/profile/drill?chars=%D0%BE%D0%BB&language=ru', { token });
check('/api/profile/drill отдаёт текст', drill.status === 200 && typeof drill.data?.text === 'string');

// --- 12. /api/leaderboard ------------------------------------------------
for (const sort of ['wpm', 'accuracy', 'xp']) {
  const lb = await req(`/api/leaderboard?sort=${sort}&period=all`, { token });
  check(`/api/leaderboard sort=${sort} отдаёт строки`, lb.status === 200 && Array.isArray(lb.data?.rows));
  check(`/api/leaderboard sort=${sort} содержит меня`, lb.data?.me?.id === userId);
  check(
    `/api/leaderboard sort=${sort} ранжирует строки`,
    (lb.data?.rows ?? []).every((r, i, a) => i === 0 || a[i - 1].value >= r.value),
  );
}

const lbToday = await req('/api/leaderboard?sort=wpm&period=today', { token });
check('leaderboard period=today работает', lbToday.status === 200 && Array.isArray(lbToday.data?.rows));

// --- 13. /api/achievements ------------------------------------------------
const ach = await req('/api/achievements', { token });
check('/api/achievements отдаёт список', ach.status === 200 && Array.isArray(ach.data?.achievements));
check(
  'ach_combo_1000 ещё закрыт (комбо 34 < 1000)',
  (ach.data?.achievements ?? []).find((a) => a.achievement_id === 'ach_combo_1000')?.unlocked === false,
);

// --- 14. Защита приватных маршрутов -----------------------------------------
for (const p of ['/api/profile', '/api/auth/me']) {
  const anon = await req(p);
  check(`${p} без токена даёт 401`, anon.status === 401, `-> ${anon.status}`);
}
const anonSave = await req('/api/train/session', { method: 'POST', body: JSON.stringify({ wpm: 10 }) });
check('/api/train/session без токена даёт 401', anonSave.status === 401, `-> ${anonSave.status}`);

// --- 15. Раздача собранного фронтенда -----------------------------------------
const index = await fetch(`${BASE}/`);
const html = await index.text();
check('Express раздаёт index.html', index.status === 200 && html.includes('<div id="root">'));
const spa = await fetch(`${BASE}/profile`);
const spaHtml = await spa.text();
check('SPA-роут /profile отдаёт index.html', spa.status === 200 && spaHtml.includes('<div id="root">'));

// --- 16. Второй пользователь попадает в таблицу лидеров -----------------------
// ВАЖНО: таблица лидеров строится JOIN-ом по typing_sessions, поэтому
// пользователь без завершённых тренировок в рейтинге не участвует.
const otherEmail = `smoke2_${uniq}@print.hero`;
const other = await req('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email: otherEmail, password, nickname: 'Смоук2' }),
});
check('второй пользователь зарегистрирован', other.status === 200);
const otherToken = other.data?.token;

const lbBefore = await req('/api/leaderboard?sort=wpm&period=all', { token });
check(
  'пользователь без сессий не попадает в рейтинг',
  !(lbBefore.data?.rows ?? []).some((r) => r.id === other.data?.user?.id),
);

// Второй оператор проводит тренировку — теперь он должен появиться в рейтинге.
await req('/api/train/session', {
  method: 'POST',
  token: otherToken,
  body: JSON.stringify({
    mode: 'sentences',
    language: 'ru',
    duration: 30,
    wpm: 55,
    rawWpm: 60,
    cpm: 280,
    accuracy: 98,
    chars: 150,
    errors: 3,
    maxCombo: 40,
    comboMultiplier: 3,
    bonusXp: 0,
    errorLog: [],
  }),
});

const lb2 = await req('/api/leaderboard?sort=wpm&period=all', { token });
check(
  'в таблице лидеров два участника',
  (lb2.data?.rows ?? []).length >= 2,
  `-> ${(lb2.data?.rows ?? []).length}`,
);
check(
  'второй оператор появился в рейтинге',
  (lb2.data?.rows ?? []).some((r) => r.id === other.data?.user?.id),
);

// --- 17. Проверка разблокировки symbols при достаточном уровне ------------
// Пользователю выдаётся XP напрямую в БД (тестовая БД — отдельный файл),
// после чего режим symbols перестаёт быть заблокированным.
const { DatabaseSync } = await import('node:sqlite');
const dbPath = process.env.PTH_DB ?? 'data/hero.db';
const db = new DatabaseSync(dbPath);
const levelRow = db.prepare('SELECT level, xp FROM users WHERE id = ?').get(userId);
const targetXp = 1600; // levelFromXp: floor(sqrt(xp/100)) + 1 => 5 при xp >= 1600
db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(
  targetXp,
  Math.floor(Math.sqrt(targetXp / 100)) + 1,
  userId,
);
db.close();

const symHigh = await req('/api/train/text?mode=symbols&language=ru&level=5', { token });
check(
  'symbols открывается на 5-м уровне',
  symHigh.status === 200 && typeof symHigh.data?.text === 'string' && symHigh.data.text.length > 0,
  `-> ${symHigh.status} ${symHigh.text.slice(0, 120)}`,
);

const meHigh = await req('/api/auth/me', { token });
check('уровень вырос до 5', meHigh.data?.user?.level === 5, `-> ${meHigh.data?.user?.level}`);

console.log(`\n== Итог: ${pass} ok, ${fail} fail ==\n`);
process.exit(fail === 0 ? 0 : 1);
