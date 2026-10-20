import { COMBO_TIERS, comboTone } from '../hooks/useTyping';

interface Props {
  combo: number;
  multiplier: number;
}

export default function ComboMeter({ combo, multiplier }: Props) {
  const tone = comboTone(combo);
  const next = COMBO_TIERS.find((t) => combo < t.combo);
  const progress = next ? Math.min(1, combo / next.combo) : 1;

  return (
    <div>
      <div className="combo">
        <div
          className={`combo__fill${tone === 'idle' ? '' : ` combo__fill--${tone}`}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="combo__labels">
        <span>Комбо ×{multiplier}</span>
        <span>
          {next ? `До ×${next.multiplier}: ${next.combo - combo} симв.` : 'Максимальный множитель ×5'}
        </span>
      </div>
    </div>
  );
}
