import {
  WORDS_RU,
  WORDS_EN,
  SENTENCES_RU,
  SENTENCES_EN,
  CODE_SNIPPETS,
  SYMBOL_CHARS,
} from './content.mjs';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Слова: база 2–10 букв. С ростом уровня в пул попадают
 * более длинные и редкие слова.
 */
export function generateWords(language = 'ru', level = 1, count = 60) {
  const pool = language === 'en' ? WORDS_EN : WORDS_RU;

  // Порог длины растёт с уровнем: 1–5 => 2..6 символов, 10+ => до 10.
  const maxLen = Math.min(10, 3 + Math.floor(level / 2));
  const minLen = level >= 3 ? 2 : 2;

  const filtered = pool.filter((w) => w.length >= minLen && w.length <= maxLen);
  const usable = filtered.length >= 8 ? filtered : pool;

  // С уровня 6 добавляем «редкие» длинные слова в общий пул.
  const withRare = level >= 6 ? [...usable, ...pool.filter((w) => w.length >= 7)] : usable;

  return shuffle(withRare)
    .slice(0, count)
    .join(' ');
}

/** Предложения: связные тексты с капитализацией и знаками препинания. */
export function generateSentences(language = 'ru', level = 1, count = 6) {
  const pool = language === 'en' ? SENTENCES_EN : SENTENCES_RU;
  const list = shuffle(pool).slice(0, Math.max(1, Math.min(count, pool.length)));
  return list.join(' ');
}

/** Код: сниппеты на Python / JavaScript / HTML / CSS. */
export function generateCode(language = 'ru', level = 1, variant = null) {
  const keys = Object.keys(CODE_SNIPPETS);
  const key = variant && CODE_SNIPPETS[variant] ? variant : pick(keys);
  const snippets = CODE_SNIPPETS[key];
  const count = level >= 8 ? 2 : 1;
  const text = shuffle(snippets)
    .slice(0, count)
    .join('\n\n');
  return { text, variant: key };
}

/** Символы: хаотичные строки. Режим открывается с уровня 5. */
export function generateSymbols(level = 1, count = 240) {
  const len = Math.min(600, 120 + level * 20);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += SYMBOL_CHARS[Math.floor(Math.random() * SYMBOL_CHARS.length)];
    if (i % 4 === 3) out += ' ';
  }
  return out;
}

/** Персональное упражнение на конкретные буквы (рекомендации по ошибкам). */
export function generateDrill(chars, language = 'ru', count = 40) {
  const set = chars.map((c) => c.toLowerCase());
  const pool = language === 'en' ? WORDS_EN : WORDS_RU;
  const words = pool.filter((w) => [...new Set(w)].some((ch) => set.includes(ch)));
  const usable = words.length >= 5 ? words : pool.slice(0, 20);
  const out = [];
  for (let i = 0; i < count; i++) out.push(pick(usable));
  return out.join(' ');
}

export const MODE_MIN_LEVEL = {
  words: 1,
  sentences: 1,
  code: 1,
  symbols: 5,
};

export function isModeUnlocked(mode, level) {
  const min = MODE_MIN_LEVEL[mode] ?? 1;
  return level >= min;
}
