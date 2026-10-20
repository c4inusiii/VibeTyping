// Создаёт тестового пользователя и печатает его токен.
// Используется для ручной проверки UI в браузере.
const BASE = process.env.BASE ?? 'http://localhost:8787';
const email = process.env.EMAIL ?? 'ui_test@print.hero';
const password = process.env.PASSWORD ?? 'hero12345';
const nickname = process.env.NICKNAME ?? 'Неон';

const res = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, nickname }),
});

const data = await res.json();
if (!data.token) {
  // Пользователь уже существует — пробуем войти.
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const logged = await login.json();
  if (!logged.token) {
    console.error('Не удалось получить токен:', JSON.stringify(data));
    process.exit(1);
  }
  console.log(logged.token);
  process.exit(0);
}

console.log(data.token);
