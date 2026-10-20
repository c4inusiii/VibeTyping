// Проверка структуры CSS: баланс скобок и отсутствие «висячих» правил.
// Ловит повреждённые блоки (например, незакрытый .btn--ghost { ... }),
// из-за которых все последующие селекторы вкладываются внутрь.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = resolve(__dirname, '..', 'src', 'styles');

let bad = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
  const src = readFileSync(resolve(dir, file), 'utf8');
  const issues = [];

  // 1. Баланс скобок.
  let depth = 0;
  let line = 1;
  for (const ch of src) {
    if (ch === '\n') line++;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth < 0) {
        issues.push(`лишняя "}" на строке ${line}`);
        depth = 0;
      }
    }
  }
  if (depth !== 0) issues.push(`не закрыто ${depth} блок(ов)`);

  // 2. Правило верхнего уровня должно закрываться в своей строке.
  //    Иначе следующие селекторы вкладываются внутрь него.
  const lines = src.split('\n');
  let openAt = null;
  lines.forEach((l, i) => {
    const brace = l.indexOf('{');
    if (brace >= 0) {
      const selector = l.slice(0, brace).trim();
      if (selector && !selector.startsWith('@') && openAt === null) {
        openAt = { line: i + 1, selector };
      }
    }
    if (l.includes('}')) {
      if (openAt && !l.trim().startsWith('@') && l.trim() !== '}') {
        issues.push(`"${openAt.selector}" (стр. ${openAt.line}) не закрыт в своей строке`);
      }
      openAt = null;
    }
  });

  if (issues.length > 0) {
    console.log(`FAIL ${file}`);
    for (const i of issues) console.log(`      ${i}`);
    bad++;
  } else {
    console.log(`  ok ${file}`);
  }
}

process.exit(bad === 0 ? 0 : 1);
