import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Language, Mode, SessionResult } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTyping } from '../hooks/useTyping';
import type { TypingFinishPayload } from '../hooks/useTyping';
import TypingText from '../components/TypingText';
import LiveStats from '../components/LiveStats';
import ResultOverlay from '../components/ResultOverlay';
import ComboMeter from '../components/ComboMeter';

interface ModeDef {
  id: Mode;
  label: string;
  minLevel: number;
  hint: string;
}

export const MODES: ModeDef[] = [
  { id: 'words', label: 'Слова', minLevel: 1, hint: 'Короткие слова, растущая сложность' },
  { id: 'sentences', label: 'Предложения', minLevel: 1, hint: 'Связный текст с пунктуацией' },
  { id: 'code', label: 'Код', minLevel: 1, hint: 'Python, JavaScript, HTML, CSS' },
  { id: 'symbols', label: 'Символы', minLevel: 5, hint: 'Хаотичная механика и символы' },
];

// Персональное упражнение — не переключатель в тулбаре, а отдельный режим,
// который запускается из профиля по рекомендации.
export const DRILL_MODE: ModeDef = {
  id: 'drill',
  label: 'Упражнение',
  minLevel: 1,
  hint: 'Персональное упражнение на ваши слабые клавиши',
};

const DURATIONS = [15, 30, 60, 120];
const CODE_VARIANTS = ['python', 'javascript', 'html', 'css'];

export default function TrainPage() {
  const { user, setUser } = useAuth();
  const { push } = useToast();

  const [mode, setMode] = useState<Mode>('words');
  const [language, setLanguage] = useState<Language>('ru');
  const [duration, setDuration] = useState(60);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [finalStats, setFinalStats] = useState<TypingFinishPayload | null>(null);
  const [codeVariant, setCodeVariant] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [lockedInfo, setLockedInfo] = useState<{ required: number } | null>(null);
  const location = useLocation();

  const level = user?.level ?? 1;
  // Активное персональное упражнение. Пока оно задано, обычная генерация
  // текста не должна его перезаписывать (в т.ч. поздний ответ первого запроса).
  const drillRef = useRef<string | null>(null);

  const loadText = useCallback(
    async (m: Mode, lang: Language, levelNum: number) => {
      setLoading(true);
      setLockedInfo(null);
      try {
        if (m === 'drill' || drillRef.current) {
          // Текст упражнения уже пришёл из профиля — генерировать нечего.
          setStarted(false);
          setResult(null);
          setFinalStats(null);
          return;
        }
        const res = await api.text(m, lang, { level: levelNum });
        if (drillRef.current) return; // пока шёл запрос, стартовало упражнение
        setText(res.text);
        setCodeVariant(m === 'code' ? (res.variant ?? null) : null);
        setStarted(false);
        setResult(null);
        setFinalStats(null);
      } catch (err) {
        if (err instanceof ApiError && err.payload?.error === 'mode_locked') {
          setLockedInfo({ required: err.payload.required_level });
          setText('');
        } else {
          push('Не удалось загрузить текст для тренировки', 'error');
          setText('');
        }
      } finally {
        setLoading(false);
      }
    },
    [push],
  );

  // Текст перезагружается при смене режима/языка. Рост уровня сам по себе
  // текст не сбрасывает — иначе результат только что завершённой сессии
  // исчезал бы с экрана. Перезагрузка нужна только когда режим открывается
  // или закрывается.
  const prevConfig = useRef<{ mode: Mode; language: Language; level: number } | null>(null);
  useEffect(() => {
    const prev = prevConfig.current;
    prevConfig.current = { mode, language, level };

    if (!prev) {
      void loadText(mode, language, level);
      return;
    }

    const changed = prev.mode !== mode || prev.language !== language;
    const levelOf = (m: Mode) => (m === 'drill' ? 1 : MODES.find((x) => x.id === m)!.minLevel);
    const wasLocked = levelOf(prev.mode) > prev.level;
    const nowLocked = levelOf(mode) > level;
    const unlockedNow = wasLocked && !nowLocked;

    if (changed || unlockedNow || nowLocked) {
      void loadText(mode, language, level);
    }
  }, [mode, language, level, loadText]);

  // Персональное упражнение приходит из профиля через state навигации.
  // Его текст задаётся напрямую — серверный генератор здесь не нужен.
  const drillText = (location.state as { drillText?: string } | null)?.drillText ?? null;
  const drillApplied = useRef(false);
  useEffect(() => {
    if (!drillText || drillApplied.current) return;
    drillApplied.current = true;
    drillRef.current = drillText;
    setText(drillText);
    setMode('drill');
    setStarted(false);
    setResult(null);
    setFinalStats(null);
  }, [drillText]);

  const onFinish = useCallback(
    async (payload: TypingFinishPayload) => {
      try {
        const res = await api.saveSession({
          mode: payload.mode,
          language: payload.language,
          duration: payload.duration,
          wpm: payload.wpm,
          rawWpm: payload.rawWpm,
          cpm: payload.cpm,
          accuracy: payload.accuracy,
          chars: payload.chars,
          errors: payload.errors,
          maxCombo: payload.maxCombo,
          comboMultiplier: payload.comboMultiplier,
          bonusXp: payload.bonusXp,
          errorLog: payload.errorLog,
        });
        setResult(res);
        setFinalStats(payload);
        setUser(res.user);
        if (res.bonusFromAchievements > 0) {
          push(`Достижение открыто! +${res.bonusFromAchievements} XP`, 'gold');
        }
      } catch {
        push('Сессия не сохранена: сервер недоступен', 'error');
      }
    },
    [push, setUser],
  );

  const typing = useTyping({ text, mode, language, duration, onFinish });
  const typingRef = useRef(typing);
  typingRef.current = typing;

  const restart = useCallback(() => {
    typingRef.current.reset();
    setResult(null);
    setFinalStats(null);
    setStarted(false);
    if (mode === 'drill') {
      // Выход из персонального упражнения: возвращаем обычный режим.
      drillRef.current = null;
      drillApplied.current = false;
      setMode('words');
      return;
    }
    void loadText(mode, language, level);
  }, [loadText, mode, language, level]);

  // Глобальный обработчик клавиатуры.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === 'Escape') {
        restart();
        return;
      }

      if (!started) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setStarted(true);
          typingRef.current.start();
        }
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        typingRef.current.handleKey(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [started, restart]);

  const currentMode = useMemo(
    () => (mode === 'drill' ? DRILL_MODE : MODES.find((m) => m.id === mode)!),
    [mode],
  );

  if (lockedInfo) {
    return (
      <div className="page">
        <h1 className="page__title">Режим заблокирован</h1>
        <p className="page__subtitle">Открывайте новые возможности, повышая уровень.</p>
        <div className="card locked">
          <div className="locked__icon">🔒</div>
          <h2 className="locked__title">{currentMode.label}</h2>
          <p className="locked__text">
            Режим «{currentMode.label}» открывается с уровня {lockedInfo.required}. Ваш уровень — {level}.
          </p>
          <button className="btn btn--primary" onClick={() => setMode('words')}>
            Вернуться к словам
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page__title">Тренировка</h1>
      <p className="page__subtitle">
        {currentMode.hint} · Уровень {level} · комбо-множитель до ×5
      </p>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <span className="toolbar__label">Режим</span>
        <div className="segmented">
          {MODES.map((m) => {
            const locked = m.minLevel > level;
            return (
              <button
                key={m.id}
                className={`segmented__item${mode === m.id ? ' segmented__item--active' : ''}`}
                disabled={locked}
                onClick={() => setMode(m.id)}
                title={locked ? `Открывается с уровня ${m.minLevel}` : m.hint}
              >
                {m.label}
                {locked && <span className="segmented__lock">🔒{m.minLevel}</span>}
              </button>
            );
          })}
        </div>

        {mode === 'drill' && (
          <>
            <span className="segmented__item segmented__item--active" style={{ cursor: 'default' }}>
              Упражнение
            </span>
            <button className="btn btn--ghost" onClick={restart}>
              Выйти из упражнения
            </button>
          </>
        )}

        <span className="toolbar__label">Язык</span>
        <div className="segmented">
          {(['ru', 'en'] as Language[]).map((l) => (
            <button
              key={l}
              className={`segmented__item${language === l ? ' segmented__item--active' : ''}`}
              onClick={() => setLanguage(l)}
            >
              {l === 'ru' ? 'RU' : 'EN'}
            </button>
          ))}
        </div>

        <span className="toolbar__label">Длительность</span>
        <div className="segmented">
          {DURATIONS.map((d) => (
            <button
              key={d}
              className={`segmented__item${duration === d ? ' segmented__item--active' : ''}`}
              onClick={() => setDuration(d)}
            >
              {d}с
            </button>
          ))}
        </div>

        <div className="toolbar__spacer" />

        <button className="btn btn--ghost" onClick={restart}>
          ⟳ Новый текст
        </button>
      </div>

      {mode === 'code' && (
        <div className="row" style={{ marginBottom: 12 }}>
          <span className="toolbar__label">Язык кода</span>
          <div className="segmented">
            {CODE_VARIANTS.map((v) => (
              <button
                key={v}
                className={`segmented__item${codeVariant === v ? ' segmented__item--active' : ''}`}
                onClick={() => {
                  setCodeVariant(v);
                  api
                    .text('code', language, { level, variant: v })
                    .then((res) => {
                      setText(res.text);
                      setStarted(false);
                      typingRef.current.reset();
                    })
                    .catch(() => push('Не удалось загрузить сниппет', 'error'));
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="arena">
        <div
          className={`arena__shell${
            typing.shake ? ' arena__shell--shake' : ''
          }${typing.nitroActive ? ' arena__shell--nitro' : ''}${typing.goldActive ? ' arena__shell--gold' : ''}`}
        >
          <LiveStats stats={typing.stats} combo={typing.stats.combo} />
          <div style={{ margin: '16px 0' }}>
            <ComboMeter combo={typing.stats.combo} multiplier={typing.stats.multiplier} />
          </div>

          {loading ? (
            <div className="loader">Генерация текста</div>
          ) : (
            <div
              onClick={() => {
                if (!started) {
                  setStarted(true);
                  typingRef.current.start();
                }
              }}
            >
              <TypingText text={text} typed={typing.typed} states={typing.states} />
            </div>
          )}

          {!started && !loading && text && (
            <div className="startpad">
              <div className="startpad__inner">
                <h2>Готов к печати?</h2>
                <p>
                  Нажмите <span className="kbd">Enter</span> или коснитесь текста, чтобы начать.
                  Ошибка фиксируется, но не проходит — придётся исправить.
                </p>
                <button
                  className="btn btn--primary"
                  onClick={() => {
                    setStarted(true);
                    typingRef.current.start();
                  }}
                >
                  Начать
                </button>
              </div>
            </div>
          )}

          {typing.bonus && (
            <div style={{ marginTop: 14 }}>
              <span className={`bonus bonus--${typing.bonus.kind}`}>
                ⚡ {typing.bonus.label}: <span className="bonus__word">{typing.bonus.word}</span>
              </span>
            </div>
          )}

          {result && finalStats && (
            <ResultOverlay
              result={result}
              stats={finalStats}
              onRestart={restart}
              onAgain={() => {
                typingRef.current.reset();
                setResult(null);
                setFinalStats(null);
                setStarted(true);
                typingRef.current.start();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
