import type { SessionResult } from '../api/types';
import type { TypingFinishPayload } from '../hooks/useTyping';

interface Props {
  result: SessionResult;
  stats: TypingFinishPayload;
  onRestart: () => void;
  onAgain: () => void;
}

export default function ResultOverlay({ result, stats, onRestart, onAgain }: Props) {
  return (
    <div className="result">
      <div className="result__panel">
        <p className="result__title">Сессия завершена</p>
        <div className="result__wpm">{stats.wpm}</div>
        <p className="muted">слов в минуту</p>

        <div className="result__grid">
          <div className="result__cell">
            <div className="result__cell-label">Точность</div>
            <div className="result__cell-value">{stats.accuracy.toFixed(1)}%</div>
          </div>
          <div className="result__cell">
            <div className="result__cell-label">Сырой WPM</div>
            <div className="result__cell-value">{stats.rawWpm}</div>
          </div>
          <div className="result__cell">
            <div className="result__cell-label">CPM</div>
            <div className="result__cell-value">{stats.cpm}</div>
          </div>
          <div className="result__cell">
            <div className="result__cell-label">Макс. комбо</div>
            <div className="result__cell-value">{stats.maxCombo}</div>
          </div>
          <div className="result__cell">
            <div className="result__cell-label">Ошибки</div>
            <div className="result__cell-value">{stats.errors}</div>
          </div>
          <div className="result__cell">
            <div className="result__cell-label">Множитель</div>
            <div className="result__cell-value">×{stats.comboMultiplier}</div>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'center', marginBottom: 16 }}>
          <span className="xp-pop">+{result.xpEarned} XP</span>
          {result.bonusFromAchievements > 0 && (
            <span className="xp-pop">+{result.bonusFromAchievements} XP за ачивки</span>
          )}
          <span className="streak">🔥 Серия: {result.streak}</span>
        </div>

        {result.unlockedAchievements.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {result.unlockedAchievements.map((a) => (
              <div key={a.achievement_id} className="ach ach--unlocked" style={{ textAlign: 'left' }}>
                <div className="ach__head">
                  <div className="ach__icon">🏆</div>
                  <div>
                    <h4 className="ach__title">{a.title}</h4>
                    <span className="ach__cat">Достижение открыто</span>
                  </div>
                </div>
                <p className="ach__desc">{a.description}</p>
              </div>
            ))}
          </div>
        )}

        <div className="result__actions">
          <button className="btn btn--primary" onClick={onAgain}>
            Ещё раз
          </button>
          <button className="btn btn--ghost" onClick={onRestart}>
            Новый текст
          </button>
        </div>
      </div>
    </div>
  );
}
