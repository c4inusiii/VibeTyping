export const WORDS_RU = [
  'код','путь','тишина','печать','герой','вектор','радуга','система','орбита','экран',
  'молния','сталь','зерно','мост','искра','ветер','пламя','север','волна','тень',
  'рамка','свет','звук','линия','точка','круг','сфера','якорь','стрела','щит',
  'жар','дождь','заря','сумерки','полдень','рассвет','камень','дерево','река','поле',
  'столб','пиксель','сервер','клиент','база','токен','пароль','ключ','цифра','скрипт',
  'файл','папка','сеть','узел','протокол','интерфейс','логика','память','поток',
  'матрица','схема','модуль','ядро','команда','строка','символ','буква','слово','фраза',
  'режим','темп','ритм','удар','вспышка','взрыв','заряд','топливо','энергия',
];

export const WORDS_EN = [
  'code','path','silence','print','hero','vector','rainbow','system','orbit','screen',
  'lightning','steel','grain','bridge','spark','wind','flame','north','wave','shadow',
  'frame','light','sound','line','point','circle','sphere','anchor','arrow','shield',
  'heat','rain','dawn','twilight','noon','sunrise','stone','tree','river','field',
  'pillar','pixel','server','client','base','token','password','key','digit','script',
  'file','folder','net','node','protocol','interface','logic','memory','stream',
  'matrix','scheme','module','core','command','row','symbol','letter','word','phrase',
  'mode','tempo','rhythm','strike','flash','blast','charge','fuel','energy',
];


export const SENTENCES_RU = [
  'Тренажёр слепой печати превращает ошибку в данные, а данные — в рефлексы.',
  'Каждая напечатанная буква приближает героя к следующему уровню мастерства.',
  'Чем ровнее ритм, тем спокойнее дышит экран и ярче горит неоновая каретка.',
  'Мысленный код никогда не ошибается, но пальцы помогают ошибаться чаще.',
  'Скорость без точности — это просто быстрое разочарование.',
  'Клавиатура помнит ваши слабые места лучше, чем вы сами.',
  'Спокойный темп даёт больше очков, чем судорожные попытки ускориться.',
  'Настоящий мастер печатает вслепую, глядя не на буквы, а на экран целиком.',
  'Золотая лихорадка — временная аномалия, но опыт она удваивает по-настоящему.',
  'Режим кода учит терпению: лишний пробел здесь стоит дороже, чем целая строка.',
  'Северное сияние над ночным городом похоже на интерфейс из фантастического романа.',
  'Хорошая статистика начинается с честного подсчёта собственных ошибок.',
  'Повторение — единственный надёжный способ натренировать скорость рук.',
  'Горящий индикатор комбо означает, что сегодня вы в ударе.',
  'Фраза, набранная без единой опечатки, дороже тысячи случайных символов.',
];

export const SENTENCES_EN = [
  'A typing trainer turns mistakes into data, and data into reflexes.',
  'Every letter you print brings the hero closer to the next mastery level.',
  'The steadier the rhythm, the calmer the screen glows and the brighter the caret.',
  'Mental code never fails, but fingers fail far more often.',
  'Speed without accuracy is just fast disappointment.',
  'The keyboard remembers your weak spots better than you do.',
  'A calm tempo earns more points than frantic attempts to speed up.',
  'A real master types blind, looking not at the letters but at the whole screen.',
  'Gold fever is a temporary anomaly, but the experience really is doubled.',
  'Code mode teaches patience: one extra space here costs more than a whole line.',
  'The aurora above the night city looks like an interface from a sci-fi novel.',
  'Good statistics begin with an honest count of your own mistakes.',
  'Repetition is the only reliable way to train the speed of your hands.',
  'A glowing combo indicator means you are in the zone today.',
  'A phrase typed without a single typo is worth a thousand random symbols.',
];

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Сниппеты кода хранятся в JSON — так их проще расширять и валидировать. */
export const CODE_SNIPPETS = JSON.parse(
  readFileSync(resolve(__dirname, 'data', 'code_snippets.json'), 'utf8'),
);


export const SYMBOL_CHARS =
  'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM0123456789!@#$%^&*()-_=+[]{};:\'",.<>/?~`\\|';
