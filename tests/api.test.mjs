/**
 * API smoke test: регистрация -> текст -> сессия -> профиль -> лидерборд.
 * Запуск: node tests/api.test.mjs
 */
const BASE = process.env.BASE ?? 'http://localhost:8787';

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

const email = `hero_${Date.now()}@test.dev`;

console.log('\n== health ==');
{
  const { status, body } = await api('/api/health');
  check('health 200', status === 200 && body.ok === true);
}

console.log('\n== register ==');
let token = '';
let user = null;
{
  const { status, body } = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'secret123', nickname: 'Герой' }),
  });
  check('register 200', status === 200, JSON.stringify(body));
  check('token issued', typeof body.token === 'string' && body.token.length > 20);
  check('levelInfo present', !!body.user?.levelInfo);
  token = body.token;
  user = body.user;
}

console.log('\n== login ==');
{
  const { status, body } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'secret123' }),
  });
  check('login 200', status === 200, JSON.stringify(body));
  const bad = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'wrong' }),
  });
  check('login rejects wrong password', bad.status === 401);
}

console.log('\n== train text ==');
{
  const { status, body } = await api('/api/train/text?mode=words&language=ru&count=20');
  check('words 200', status === 200, JSON.stringify(body).slice(0, 120));
  check('words non-empty', typeof body.text === 'string' && body.text.length > 10);

  const code = await api('/api/train/text?mode=code&language=ru&variant=python');
  check('code 200', code.status === 200);
  check('code has python', code.body.variant === 'python', code.body.variant);

  const sent = await api('/api/train/text?mode=sentences&language=en');
  check('sentences en 200', sent.status === 200 && sent.body.text.includes('.'));

  const sym = await api('/api/train/text?mode=symbols&language=ru');
  check('symbols locked at lvl1 (403)', sym.status === 403, String(sym.status));
}

console.log('\n== train session ==');
{
  const { status, body } = await api('/api/train/session', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({
      mode: 'words',
      language: 'ru',
      duration: 60,
      wpm: 80,
      rawWpm: 92,
      cpm: 400,
      accuracy: 96.5,
      chars: 400,
      errors: 14,
      maxCombo: 42,
      comboMultiplier: 2,
      errorLog: [
        { expected: 'о', pressed: 'л', delayMs: 140 },
        { expected: 'о', pressed: 'л', delayMs: 160 },
        { expected: 'р', pressed: 'к', delayMs: 120 },
        { expected: 'о', pressed: 'л', delayMs: 200 },
      ],
    }),
  });
  check('session 200', status === 200, JSON.stringify(body).slice(0, 200));
  check('xp earned > 0', body.xpEarned > 0);
  check('total xp grew', body.totalXp > 0);
  check('unlocked list is array', Array.isArray(body.unlockedAchievements));
}

console.log('\n== profile ==');
{
  const { status, body } = await api('/api/profile', {
    headers: { authorization: `Bearer ${token}` },
  });
  check('profile 200', status === 200);
  check('summary.sessions = 1', body.summary?.totalSessions === 1, String(body.summary?.totalSessions));
  check('summary.chars = 400', body.summary?.totalChars === 400);
  check('keyErrors recorded', body.keyErrors?.length >= 1);
  check('achievements listed', Array.isArray(body.achievements) && body.achievements.length > 0);
  const rec = body.recommendations?.[0];
  check('recommendation for о/л', !!rec && rec.chars.join('') === 'ол', JSON.stringify(rec));
}

console.log('\n== drill ==');
{
  const { status, body } = await api('/api/profile/drill?chars=ол&language=ru', {
    headers: { authorization: `Bearer ${token}` },
  });
  check('drill 200', status === 200 && body.text.length > 10);
}

console.log('\n== leaderboard ==');
{
  const { status, body } = await api('/api/leaderboard?sort=wpm&period=all', {
    headers: { authorization: `Bearer ${token}` },
  });
  check('leaderboard 200', status === 200);
  check('rows include me', body.me?.nickname === 'Герой', JSON.stringify(body.me));
  check('me pinned with rank', typeof body.me?.rank === 'number');
}

console.log('\n== achievements spec ==');
{
  const { status, body } = await api('/api/achievements');
  check('achievements 200', status === 200);
  const ids = body.achievements.map((a) => a.achievement_id);
  for (const id of [
    'ach_speed_300',
    'ach_combo_1000',
    'ach_mode_code',
    'ach_perfect_100',
    'ach_streak_7',
  ]) {
    check(`spec ${id} present`, ids.includes(id));
  }
}

console.log('\n== auth guard ==');
{
  const { status } = await api('/api/profile');
  check('profile without token 401', status === 401);
}

console.log(failures === 0 ? '\nALL TESTS PASSED\n' : `\n${failures} TEST(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
