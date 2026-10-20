import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { AchievementSpec } from '../api/types';
import { useToast } from '../context/ToastContext';

const ICONS: Record<string, string> = {
  bolt: '⚡',
  shield: '🛡',
  mask: '🎭',
  scales: '⚖',
  calendar: '📅',
  star: '⭐',
};

const CATEGORY_LABEL: Record<string, string> = {
  speed: 'Скорость',
  combo: 'Комбо',
  accuracy: 'Точность',
  streak: 'Ударный режим',
  custom: 'Особые',
};

export default function AchievementsPage() {
  const { push } = useToast();
  const [items, setItems] = useState<AchievementSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyUnlocked, setOnlyUnlocked] = useState(false);

  useEffect(() => {
    api
      .achievements()
      .then((res) => setItems(res.achievements))
      .catch(() => push('Не удалось загрузить достижения', 'error'))
      .finally(() => setLoading(false));
  }, [push]);

  const visible = useMemo(
    () => (onlyUnlocked ? items.filter((a) => a.unlocked) : items),
    [items, onlyUnlocked],
  );

  const unlocked = items.filter((a) => a.unlocked).length;

  return (
    <div className="page">
      <h1 className="page__title">Достижения</h1>
      <p className="page__subtitle">
        Открыто {unlocked} из {items.length} · награда — дополнительный XP
      </p>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div className="segmented">
          <button
            className={`segmented__item${!onlyUnlocked ? ' segmented__item--active' : ''}`}
            onClick={() => setOnlyUnlocked(false)}
          >
            Все
          </button>
          <button
            className={`segmented__item${onlyUnlocked ? ' segmented__item--active' : ''}`}
            onClick={() => setOnlyUnlocked(true)}
          >
            Открытые
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loader">Загрузка достижений</div>
      ) : (
        <div className="achievements">
          {visible.map((a) => (
            <div key={a.achievement_id} className={`ach ${a.unlocked ? 'ach--unlocked' : 'ach--locked'}`}>
              <div className="ach__head">
                <div className="ach__icon">{ICONS[a.icon] ?? '🏅'}</div>
                <div>
                  <h4 className="ach__title">{a.title}</h4>
                  <span className="ach__cat">{CATEGORY_LABEL[a.category] ?? a.category}</span>
                </div>
              </div>
              <p className="ach__desc">{a.description}</p>
              <div className="ach__progress">
                <div
                  className="ach__progress-fill"
                  style={{ width: a.unlocked ? '100%' : `${Math.min(95, a.metric_target)}%` }}
                />
              </div>
              <div className="ach__meta">
                <span>{a.unlocked ? '✓ Открыто' : `Цель: ${a.metric_target}`}</span>
                <span className="ach__reward">+{a.reward_xp} XP</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
