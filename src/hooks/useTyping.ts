import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorLogEntry, Language, Mode } from '../api/types';

export type CharState = 'pending' | 'correct' | 'error' | 'extra';

export interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  life: number;
}

export interface TypingStats {
  wpm: number;
  rawWpm: number;
  cpm: number;
  accuracy: number;
  chars: number;
  correct: number;
  errors: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  elapsed: number;
  remaining: number;
}

export interface Bonus {
  id: string;
  kind: 'nitro' | 'gold';
  label: string;
  word: string;
  expiresAt: number;
}

export interface TypingFinishPayload {
  mode: Mode;
  language: Language;
  duration: number;
  wpm: number;
  rawWpm: number;
  cpm: number;
  accuracy: number;
  chars: number;
  errors: number;
  maxCombo: number;
  comboMultiplier: number;
  errorLog: ErrorLogEntry[];
  bonusXp: number;
}

export const COMBO_TIERS = [
  { combo: 50, multiplier: 5, tone: 'frenzy' },
  { combo: 25, multiplier: 3, tone: 'orange' },
  { combo: 10, multiplier: 2, tone: 'yellow' },
] as const;

export type ComboTone = 'idle' | 'yellow' | 'orange' | 'frenzy';

export function multiplierFor(combo: number): number {
  let mult = 1;
  for (const t of COMBO_TIERS) if (combo >= t.combo) mult = t.multiplier;
  return mult;
}

export function comboTone(combo: number): ComboTone {
  for (const t of COMBO_TIERS) if (combo >= t.combo) return t.tone;
  return 'idle';
}

export const COMBO_COLORS: Record<ComboTone, string> = {
  idle: '#7df9ff',
  yellow: '#ffd93d',
  orange: '#ff9f1c',
  frenzy: '#ff2e63',
};

export interface UseTypingOptions {
  text: string;
  mode: Mode;
  language: Language;
  duration: number;
  onFinish?: (payload: TypingFinishPayload) => void;
}

const BONUS_WORDS_RU = ['скорость', 'неон', 'пламя', 'орбита', 'взрыв', 'молния'];
const BONUS_WORDS_EN = ['speed', 'neon', 'flame', 'orbit', 'blast', 'bolt'];

function accuracyFactor(accuracy: number) {
  return Math.max(0.3, accuracy / 100);
}

const INITIAL_STATS: Omit<TypingStats, 'remaining'> = {
  wpm: 0,
  rawWpm: 0,
  cpm: 0,
  accuracy: 100,
  chars: 0,
  correct: 0,
  errors: 0,
  combo: 0,
  maxCombo: 0,
  multiplier: 1,
  elapsed: 0,
};

export function useTyping({ text, mode, language, duration, onFinish }: UseTypingOptions) {
  const [typed, setTyped] = useState('');
  const [states, setStates] = useState<CharState[]>([]);
  const [stats, setStats] = useState<TypingStats>({ ...INITIAL_STATS, remaining: duration });
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shake, setShake] = useState(0);
  const [bonus, setBonus] = useState<Bonus | null>(null);
  const [bonusFlash, setBonusFlash] = useState<'gold' | 'nitro' | null>(null);
  const [comboBroken, setComboBroken] = useState(0);
  const [nitroActive, setNitroActive] = useState(false);
  const [goldActive, setGoldActive] = useState(false);

  const errorLog = useRef<ErrorLogEntry[]>([]);
  const startTime = useRef(0);
  const lastKeyTime = useRef(0);
  const particleId = useRef(0);
  const bonusXp = useRef(0);
  const goldUntil = useRef(0);
  const nitroUntil = useRef(0);
  const bonusWordRef = useRef<string | null>(null);
  const finishedRef = useRef(false);
  const statsRef = useRef(stats);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const chars = useMemo(() => Array.from(text), [text]);

  /* ---------------- Таймер ---------------- */
  useEffect(() => {
    if (!running || finished) return;
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      setStats((s) => {
        const remaining = Math.max(0, duration - elapsed);
        const minutes = Math.max(elapsed / 60, 1 / 60);
        const accuracy =
          s.correct + s.errors > 0 ? (s.correct / (s.correct + s.errors)) * 100 : 100;
        return {
          ...s,
          elapsed,
          remaining,
          accuracy,
          wpm: Math.round((s.correct / 5 / minutes) * accuracyFactor(accuracy)),
          rawWpm: Math.round(s.correct / 5 / minutes),
          cpm: Math.round(s.correct / minutes),
        };
      });
      if (elapsed >= duration) finish();
    }, 120);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, finished, duration]);

  /* ---------------- Старт / сброс ---------------- */
  const start = useCallback(() => {
    setTyped('');
    setStates([]);
    errorLog.current = [];
    startTime.current = Date.now();
    lastKeyTime.current = Date.now();
    bonusXp.current = 0;
    goldUntil.current = 0;
    nitroUntil.current = 0;
    bonusWordRef.current = null;
    setBonus(null);
    setBonusFlash(null);
    setNitroActive(false);
    setGoldActive(false);
    setFinished(false);
    finishedRef.current = false;
    setRunning(true);
    setStats({ ...INITIAL_STATS, remaining: duration });
  }, [duration]);

  const reset = useCallback(() => {
    setRunning(false);
    setFinished(false);
    setTyped('');
    setStates([]);
    setParticles([]);
    setBonus(null);
    setBonusFlash(null);
    setNitroActive(false);
    setGoldActive(false);
    setStats({ ...INITIAL_STATS, remaining: duration });
  }, [duration]);

  /* ---------------- Завершение ---------------- */
  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRunning(false);
    setFinished(true);
    const elapsed = Math.max(1, (Date.now() - startTime.current) / 1000);
    const final = statsRef.current;
    const minutes = elapsed / 60;
    const accuracy =
      final.correct + final.errors > 0 ? (final.correct / (final.correct + final.errors)) * 100 : 100;
    onFinish?.({
      mode,
      language,
      duration,
      wpm: Math.round((final.correct / 5 / minutes) * accuracyFactor(accuracy)),
      rawWpm: Math.round(final.correct / 5 / minutes),
      cpm: Math.round(final.correct / minutes),
      accuracy: Number(accuracy.toFixed(2)),
      chars: final.correct,
      errors: final.errors,
      maxCombo: final.maxCombo,
      comboMultiplier: final.multiplier,
      errorLog: errorLog.current,
      bonusXp: bonusXp.current,
    });
  }

  /* ---------------- Бонусы ---------------- */
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (goldUntil.current && Date.now() > goldUntil.current) {
        goldUntil.current = 0;
        setGoldActive(false);
        setBonusFlash(null);
      }
      if (nitroUntil.current && Date.now() > nitroUntil.current) {
        nitroUntil.current = 0;
        setNitroActive(false);
      }
      if (!bonusWordRef.current && Math.random() < 0.07) {
        const pool = language === 'en' ? BONUS_WORDS_EN : BONUS_WORDS_RU;
        const kind: Bonus['kind'] = Math.random() < 0.5 ? 'nitro' : 'gold';
        const word = pool[Math.floor(Math.random() * pool.length)];
        bonusWordRef.current = word;
        setBonus({
          id: `${kind}-${Date.now()}`,
          kind,
          word,
          label: kind === 'nitro' ? 'Закись азота' : 'Золотая лихорадка',
          expiresAt: Date.now() + 12000,
        });
      }
    }, 700);
    return () => window.clearInterval(id);
  }, [running, language]);

  /* ---------------- Ввод ---------------- */
  function isWordBoundary(all: string[], index: number) {
    const next = all[index + 1];
    return next === undefined || next === ' ';
  }

  const handleKey = useCallback(
    (key: string): void => {
      if (!running || finishedRef.current) return;
      const index = typed.length;
      if (index >= chars.length) return;

      const expected = chars[index];
      const now = Date.now();
      const delayMs = Math.max(0, now - lastKeyTime.current);
      lastKeyTime.current = now;

      if (key === expected) {
        // Бонус засчитывается, только если слово набрано безупречно
        if (bonusWordRef.current) {
          const word = bonusWordRef.current;
          const typedNow = typed + key;
          if (typedNow.endsWith(word) && isWordBoundary(chars, index)) {
            if (bonus?.kind === 'nitro') {
              nitroUntil.current = Date.now() + 10000;
              setNitroActive(true);
              setBonusFlash('nitro');
            } else {
              goldUntil.current = Date.now() + 10000;
              bonusXp.current += 250;
              setGoldActive(true);
              setBonusFlash('gold');
            }
            setBonus(null);
            bonusWordRef.current = null;
          }
        }

        const newCombo = statsRef.current.combo + 1;
        setTyped((t) => t + key);
        setStates((s) => {
          const next = [...s];
          next[index] = 'correct';
          return next;
        });
        setStats((s) => ({
          ...s,
          correct: s.correct + 1,
          chars: s.correct + s.errors + 1,
          combo: newCombo,
          maxCombo: Math.max(s.maxCombo, newCombo),
          multiplier: multiplierFor(newCombo),
        }));
        spawnParticles(index, true);
      } else {
        // Некорректный ввод блокируется, но промах жёстко фиксируется
        errorLog.current.push({ expected, pressed: key, delayMs });
        setStates((s) => {
          const next = [...s];
          next[index] = 'error';
          return next;
        });
        setStats((s) => ({
          ...s,
          errors: s.errors + 1,
          chars: s.correct + s.errors + 1,
          combo: 0,
          multiplier: 1,
        }));
        setShake((v) => v + 1);
        setComboBroken((v) => v + 1);
        spawnParticles(index, false);
      }
    },
    [chars, running, typed, bonus],
  );

  /* ---------------- Частицы ---------------- */
  function spawnParticles(index: number, isCorrect: boolean) {
    const tone = comboTone(statsRef.current.combo);
    const color = COMBO_COLORS[tone];
    const count = isCorrect ? (tone === 'frenzy' ? 7 : tone === 'idle' ? 3 : 4) : 2;
    const created: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const speed = 1.4 + Math.random() * 2.2;
      created.push({
        id: particleId.current++,
        x: index,
        y: 0,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        color: isCorrect ? color : '#ff5a6e',
        life: 1,
      });
    }
    setParticles((p) => [...p.slice(-120), ...created]);
  }

  useEffect(() => {
    if (particles.length === 0) return;
    const id = window.setInterval(() => {
      setParticles((p) => {
        if (p.length === 0) return p;
        const next: Particle[] = [];
        for (const pt of p) {
          pt.life -= 0.12;
          if (pt.life <= 0) continue;
          pt.dx *= 0.92;
          pt.dy = pt.dy * 0.92 - 0.12;
          next.push(pt);
        }
        return next;
      });
    }, 30);
    return () => window.clearInterval(id);
  }, [particles.length > 0]);

  return {
    typed,
    states,
    stats,
    running,
    finished,
    particles,
    shake,
    bonus,
    bonusFlash,
    comboBroken,
    nitroActive,
    goldActive,
    start,
    reset,
    handleKey,
  };
}
