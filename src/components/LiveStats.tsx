import { comboTone } from '../hooks/useTyping';
import type { TypingStats } from '../hooks/useTyping';

interface Props {
  stats: TypingStats;
  combo: number;
}

export default function LiveStats({ stats }: Props) {
  const tone = comboTone(stats.combo);
  const remaining = Math.max(0, Math.ceil(stats.remaining));

  return (
    <div className="livebar">
      <div className="live">
        <div className="live__label">WPM</div>
        <div className="live__value live__value--accent">{stats.wpm}</div>
      </div>
      <div className="live">
        <div className="live__label">Сырой</div>
        <div className="live__value">{stats.rawWpm}</div>
      </div>
      <div className="live">
        <div className="live__label">Точность</div>
        <div
          className={`live__value${
            stats.accuracy >= 95 ? ' live__value--accent' : stats.accuracy >= 85 ? '' : ' live__value--red'
          }`}
        >
          {stats.accuracy.toFixed(1)}%
        </div>
      </div>
      <div className="live">
        <div className="live__label">Комбо</div>
        <div className={`live__value live__value--combo-${tone}`}>
          {stats.combo}
          {stats.multiplier > 1 && <span className="tile__unit">×{stats.multiplier}</span>}
        </div>
      </div>
      <div className="live">
        <div className="live__label">Ошибки</div>
        <div className={`live__value${stats.errors > 0 ? ' live__value--red' : ''}`}>{stats.errors}</div>
      </div>
      <div className="live">
        <div className="live__label">Осталось</div>
        <div className="live__value live__value--gold">{remaining}с</div>
      </div>
    </div>
  );
}
