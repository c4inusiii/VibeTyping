// UI-тест через Chrome DevTools Protocol: авторизуется, печатает текст
// в тренажёре и проверяет, что показатели и навигация работают.
//
// Запуск:  node tests/ui-e2e.mjs
// Требуется запущенный сервер (по умолчанию http://localhost:8787).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:8787';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9300 + Math.floor(Math.random() * 400);

// Вывод идёт через синхронную запись: process.exit() обрезает
// асинхронный stdout при перенаправлении в файл.
function out(line) {
  writeSync(1, line + '\n');
}

let pass = 0;
let fail = 0;

function check(name, cond, extra = '') {
  if (cond) {
    pass++;
    out(`  ok  ${name}`);
  } else {
    fail++;
    out(`FAIL  ${name} ${extra}`);
  }
}

const profile = mkdtempSync(join(tmpdir(), 'pth-ui-'));
const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--window-size=1440,1000',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank',
]);

const cleanup = () => {
  try {
    edge.kill();
  } catch {}
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
};
process.on('exit', cleanup);

// --- Ждём DevTools --------------------------------------------------------
let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const tabs = await res.json();
    const page = tabs.find((t) => t.type === 'page');
    if (page?.webSocketDebuggerUrl) wsUrl = page.webSocketDebuggerUrl;
  } catch {}
}
if (!wsUrl) {
  console.error('Не удалось подключиться к DevTools');
  cleanup();
  process.exit(1);
}

// --- Минимальный CDP-клиент ----------------------------------------------
const ws = new WebSocket(wsUrl);
let msgId = 0;
const pending = new Map();

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 20000);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error(
      res.exceptionDetails.text + ' :: ' + (res.exceptionDetails.exception?.description ?? ''),
    );
  }
  return res.result.value;
}

async function navigate(url) {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const ready = await evaluate(
        `document.readyState === 'complete' && !!document.querySelector('#root')`,
      );
      if (ready) break;
    } catch {}
  }
  await new Promise((r) => setTimeout(r, 800));
}

async function key(text) {
  for (const ch of text) {
    if (ch === '\n') {
      // Enter требует корректных кодов клавиш, иначе он вставит текст "Enter".
      const enter = {
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
        text: '\r',
        unmodifiedText: '\r',
      };
      await send('Input.dispatchKeyEvent', { type: 'keyDown', ...enter });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
    } else {
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: ch,
        text: ch,
        unmodifiedText: ch,
      });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
    }
    await new Promise((r) => setTimeout(r, 14));
  }
}

console.log(`\n== UI E2E (${BASE}) ==\n`);
process.on('uncaughtException', (err) => {
  out(`\nИСКЛЮЧЕНИЕ: ${err?.message ?? err}`);
  out(String(err?.stack ?? ''));
  cleanup();
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  out(`\nОТКАЗ ПРОМИСА: ${err?.message ?? err}`);
  out(String(err?.stack ?? ''));
  cleanup();
  process.exit(1);
});

// --- 1. Регистрация и получение токена ------------------------------------
const email = `ui_${Date.now().toString(36)}@print.hero`;
const reg = await fetch(`${BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'hero12345', nickname: 'Пилот' }),
});
const regData = await reg.json();
const token = regData.token;
check('пользователь зарегистрирован через API', Boolean(token));

// --- 2. Страница входа отображается ----------------------------------------
await navigate(`${BASE}/login`);
const loginTitle = await evaluate(`document.querySelector('.auth__title')?.textContent?.trim()`);
check('страница входа отрендерена', Boolean(loginTitle), `-> ${loginTitle}`);

const fieldLayoutOk = await evaluate(`
  (() => {
    const label = document.querySelector('.field__label');
    const input = document.querySelector('.input');
    if (!label || !input) return false;
    const l = label.getBoundingClientRect();
    const i = input.getBoundingClientRect();
    return l.bottom <= i.top + 2 && Math.abs(l.left - i.left) < 4;
  })()
`);
check('подпись поля расположена над полем ввода', fieldLayoutOk === true);

// --- 3. Вход через форму ----------------------------------------------------
const inputsFilled = await evaluate(`
  (() => {
    const set = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = document.querySelectorAll('.input');
    set(inputs[0], ${JSON.stringify(email)});
    set(inputs[1], 'hero12345');
    return Array.from(inputs).map(i => i.value).join('|');
  })()
`);
check('поля формы заполнены', inputsFilled.includes(email), `-> ${inputsFilled}`);

await evaluate(`document.querySelector('form').requestSubmit()`);
await new Promise((r) => setTimeout(r, 3000));

const afterLogin = await evaluate(`location.pathname`);
check('после входа открылась страница тренировки', afterLogin === '/train', `-> ${afterLogin}`);

const userChip = await evaluate(`document.querySelector('.userchip__name')?.textContent?.trim()`);
check('в шапке видно никнейм', userChip === 'Пилот', `-> ${userChip}`);

// --- 4. Текст для печати загружен -------------------------------------------
const textLen = await evaluate(`document.querySelectorAll('.text .char').length`);
check('текст для печати отрисован', textLen > 20, `-> ${textLen} символов`);

// --- 5. Запуск тренировки ----------------------------------------------------
await key('\n');
await new Promise((r) => setTimeout(r, 500));
const running = await evaluate(`!document.querySelector('.startpad')`);
check('оверлей старта исчез после Enter', running === true);

// --- 6. Ввод символов и реакция метрик --------------------------------------
const firstChars = await evaluate(`
  Array.from(document.querySelectorAll('.text .char')).slice(0, 12).map(c => c.textContent).join('')
`);
await key(firstChars);
await new Promise((r) => setTimeout(r, 400));

const correctCount = await evaluate(`document.querySelectorAll('.char--correct').length`);
check('верно набранные символы подсвечены', correctCount >= 10, `-> ${correctCount}`);

const wpmText = await evaluate(`document.querySelectorAll('.live__value')[0]?.textContent?.trim()`);
check('показатель WPM обновился', Number(wpmText) > 0, `-> ${wpmText}`);

// --- 7. Ошибка фиксируется, но не проходит ---------------------------------
const cursorBefore = await evaluate(`
  Array.from(document.querySelectorAll('.text .char')).findIndex(c => c.classList.contains('char--cursor'))
`);
const expected = await evaluate(
  `Array.from(document.querySelectorAll('.text .char'))[${cursorBefore}]?.textContent ?? ''`,
);
const wrong = expected === 'x' ? 'z' : 'x';
await key(wrong);
await new Promise((r) => setTimeout(r, 300));

const errorCount = await evaluate(`document.querySelectorAll('.char--error').length`);
check('ошибка визуально отмечена', errorCount >= 1, `-> ${errorCount}`);

const cursorAfter = await evaluate(`
  Array.from(document.querySelectorAll('.text .char')).findIndex(c => c.classList.contains('char--cursor'))
`);
check('ошибка не пропустила курсор вперёд', cursorAfter === cursorBefore, `-> ${cursorBefore} vs ${cursorAfter}`);

const errorsStat = await evaluate(`document.querySelectorAll('.live__value')[4]?.textContent?.trim()`);
check('счётчик ошибок вырос', Number(errorsStat) >= 1, `-> ${errorsStat}`);

// --- 8. Комбо-множитель появился --------------------------------------------
await key(firstChars.slice(0, 6));
await new Promise((r) => setTimeout(r, 300));
const comboVal = await evaluate(`document.querySelectorAll('.live__value')[3]?.textContent?.trim()`);
check('комбо и множитель отображаются', /\d/.test(comboVal ?? ''), `-> ${comboVal}`);

// --- 9. Профиль --------------------------------------------------------------
await evaluate(`document.querySelector('a[href="/profile"]').click()`);
await new Promise((r) => setTimeout(r, 2000));
const onProfile = await evaluate(`location.pathname`);
check('переход на профиль работает', onProfile === '/profile', `-> ${onProfile}`);

const summaryTiles = await evaluate(`document.querySelectorAll('.tile').length`);
check('плитки сводки отрисованы', summaryTiles >= 6, `-> ${summaryTiles}`);

const chartCanvas = await evaluate(`!!document.querySelector('canvas')`);
check('график скорости построен', chartCanvas === true);

const heatCells = await evaluate(`document.querySelectorAll('.heat').length`);
check('тепловая карта отрисована', heatCells > 50, `-> ${heatCells}`);

// --- 10. Таблица лидеров ------------------------------------------------------
await evaluate(`document.querySelector('a[href="/leaderboard"]').click()`);
await new Promise((r) => setTimeout(r, 1800));
const onLb = await evaluate(`location.pathname`);
check('переход к таблице лидеров работает', onLb === '/leaderboard', `-> ${onLb}`);

const lbRows = await evaluate(`document.querySelectorAll('.table tbody tr').length`);
check('таблица лидеров содержит строки', lbRows >= 1, `-> ${lbRows}`);

// --- 11. Достижения -----------------------------------------------------------
await evaluate(`document.querySelector('a[href="/achievements"]').click()`);
await new Promise((r) => setTimeout(r, 1800));
const achCards = await evaluate(`document.querySelectorAll('.ach').length`);
check('карточки достижений отрисованы', achCards >= 5, `-> ${achCards}`);

// --- 12. Выход ---------------------------------------------------------------
await evaluate(`document.querySelector('.topbar .btn--ghost').click()`);
await new Promise((r) => setTimeout(r, 1500));
const afterLogout = await evaluate(`location.pathname`);
check('выход возвращает на страницу входа', afterLogout === '/login', `-> ${afterLogout}`);

console.log(`\n== Итог: ${pass} ok, ${fail} fail ==\n`);

cleanup();
ws.close();
process.exit(fail === 0 ? 0 : 1);
