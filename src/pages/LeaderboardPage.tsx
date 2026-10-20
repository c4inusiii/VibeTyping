import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { LeaderboardData } from '../api/types';

const SORTS = [
  { id: 'wpm', label: 'Скорость' },
  { id: 'accuracy', label: 'Точность' },
  { id: 'xp', label: 'Опыт' },
];

const PERIODS = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'all', label: 'Всё время' },
];

const UNIT: Record<string, string> = {
  wpm: 'WPM',
  accuracy: '%',
  xp: 'XP',
};

export default function LeaderboardPage() {
  const [sort, setSort] = useState('wpm');
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.leaderboard(sort, period));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sort, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const top3 = data?.rows.slice(0, 3) ?? [];
  const rest = data?.rows.slice(3) ?? [];

  return (
    <div className="page">
      <h1 className="page__title">Таблица лидеров</h1>
      <p className="page__subtitle">Рейтинг операторов киберпанк-сети</p>

      <div className="lb">
        <div className="lb__controls">
          <div className="segmented">
            {SORTS.map((s) => (
              <button
                key={s.id}
                className={`segmented__item${sort === s.id ? ' segmented__item--active' : ''}`}
                onClick={() => setSort(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="segmented">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                className={`segmented__item${period === p.id ? ' segmented__item--active' : ''}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loader">Загрузка рейтинга</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="card empty">В этом периоде пока нет результатов</div>
        ) : (
          <>
            {top3.length === 3 && (
              <div className="podium">
                {top3.map((r, i) => (
                  <div key={r.id} className={`podium__item podium__item--${i + 1}`}>
                    <div className="podium__avatar">{r.nickname.slice(0, 1).toUpperCase()}</div>
                    <p className="podium__name">{r.nickname}</p>
                    <div className="podium__value">{r.value}</div>
                    <div className="podium__unit">{UNIT[sort]}</div>
                  </div>
                ))}
              </div>
            )}

            {data.me && (
              <div className="card" style={{ borderColor: 'rgba(181, 123, 255, 0.4)' }}>
                <h3 className="card__title">Ваш результат</h3>
                <div className="row">
                  <span className="rank">{data.me.rank}</span>
                  <strong>{data.me.nickname}</strong>
                  <span className="muted">
                    {data.me.value} {UNIT[sort]} · сессий: {data.me.sessions} · лучший:{' '}
                    {data.me.bestWpm} WPM
                  </span>
                </div>
              </div>
            )}

            <div className="card">
              <h3 className="card__title">Полный рейтинг</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Оператор</th>
                    <th>Значение</th>
                    <th>Лучший WPM</th>
                    <th>Средний</th>
                    <th>Точность</th>
                    <th>Сессий</th>
                    <th>XP</th>
                  </tr>
                </thead>
                <tbody>
                  {[...top3, ...rest].map((r) => (
                    <tr key={r.id} className={r.isMe ? 'table__me' : ''}>
                      <td>
                        <span className={`rank${r.rank <= 3 ? ` rank--${r.rank}` : ''}`}>{r.rank}</span>
                      </td>
                      <td>{r.nickname}</td>
                      <td>
                        <strong>
                          {r.value} {UNIT[sort]}
                        </strong>
                      </td>
                      <td>{r.bestWpm}</td>
                      <td>{r.avgWpm}</td>
                      <td>{r.accuracy}%</td>
                      <td>{r.sessions}</td>
                      <td>{r.totalXp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
