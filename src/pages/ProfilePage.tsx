import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ProfileData } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import WpmChart from '../components/WpmChart';
import ActivityHeatmap from '../components/ActivityHeatmap';

const MODE_LABEL: Record<string, string> = {
  words: 'Слова',
  sentences: 'Предложения',
  code: 'Код',
  symbols: 'Символы',
  drill: 'Упражнение',
};

export default function ProfilePage() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfile(await api.profile());
    } catch {
      push('Не удалось загрузить профиль', 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startDrill(chars: string) {
    try {
      const res = await api.drill(chars, 'ru');
      navigate('/train', { state: { drillText: res.text } });
    } catch {
      push('Не удалось построить упражнение', 'error');
    }
  }

  if (loading) return <div className="loader">Загрузка профиля</div>;
  if (!profile) {
    return (
      <div className="page">
        <div className="empty">Профиль недоступен</div>
      </div>
    );
  }

  const { summary, byDay, byMode, keyErrors, recent, recommendations, achievements } = profile;
  const lvl = profile.user.levelInfo;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="page">
      <h1 className="page__title">Профиль</h1>
      <p className="page__subtitle">
        {user?.nickname} · уровень {profile.user.level} · {unlockedCount} из {achievements.length} достижений
      </p>

      <div className="profile">
        <div className="stack">
          <div className="card identity">
            <div className="avatar">{profile.user.nickname.slice(0, 1).toUpperCase()}</div>
            <h2 className="identity__name">{profile.user.nickname}</h2>
            <p className="identity__email">{profile.user.email}</p>

            <div className="level">
              <div className="level__head">
                <span className="level__num">LVL {lvl.level}</span>
                <span className="level__xp">
                  {lvl.current} / {lvl.needed} XP
                </span>
              </div>
              <div className="xpbar">
                <div
                  className="xpbar__fill"
                  style={{ width: `${Math.min(100, (lvl.current / Math.max(1, lvl.needed)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="streak">🔥 Ударный режим: {summary.streak} дн.</div>
          </div>

          <div className="card">
            <h3 className="card__title">Сводка</h3>
            <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="tile">
                <div className="tile__label">Тренировок</div>
                <div className="tile__value">{summary.totalSessions}</div>
              </div>
              <div className="tile">
                <div className="tile__label">Символов</div>
                <div className="tile__value">{summary.totalChars}</div>
              </div>
              <div className="tile">
                <div className="tile__label">Средний WPM</div>
                <div className="tile__value">{summary.avgWpm}</div>
              </div>
              <div className="tile">
                <div className="tile__label">Рекорд WPM</div>
                <div className="tile__value tile__value--gold">{summary.bestWpm}</div>
              </div>
              <div className="tile">
                <div className="tile__label">Точность</div>
                <div className="tile__value">{summary.accuracy}%</div>
              </div>
              <div className="tile">
                <div className="tile__label">Ошибок</div>
                <div className="tile__value">{summary.totalErrors}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3 className="card__title">Динамика скорости</h3>
            <WpmChart data={byDay} />
          </div>

          <div className="card">
            <h3 className="card__title">Активность</h3>
            <ActivityHeatmap data={byDay} />
          </div>

          <div className="grid-2">
            <div className="card">
              <h3 className="card__title">По режимам</h3>
              {byMode.length === 0 ? (
                <div className="empty">Нет данных</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Режим</th>
                      <th>Сессий</th>
                      <th>Средний</th>
                      <th>Лучший</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byMode.map((m) => (
                      <tr key={m.mode}>
                        <td>{MODE_LABEL[m.mode] ?? m.mode}</td>
                        <td>{m.sessions}</td>
                        <td>{Number(m.avg_wpm ?? 0).toFixed(1)}</td>
                        <td>{Number(m.best_wpm ?? 0).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <h3 className="card__title">Частые ошибки</h3>
              {keyErrors.length === 0 ? (
                <div className="empty">Ошибок не зафиксировано</div>
              ) : (
                <div className="keys">
                  {keyErrors.slice(0, 20).map((k) => (
                    <button
                      key={k.key_char}
                      className={`key${k.count >= 5 ? ' key--hot' : ''}`}
                      title="Сгенерировать упражнение на эту букву"
                      onClick={() => startDrill(k.key_char)}
                    >
                      <div className="key__char">{k.key_char}</div>
                      <div className="key__count">{k.count}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {recommendations.length > 0 && (
            <div className="card">
              <h3 className="card__title">Умные рекомендации</h3>
              {recommendations.map((r) => (
                <div key={r.id} className="rec">
                  <div className="rec__chars">{r.chars.join(' / ').toUpperCase()}</div>
                  <div className="rec__text">{r.text}</div>
                  <div className="rec__count">{r.count} промахов</div>
                  <button className="btn" onClick={() => startDrill(r.drillChars)}>
                    Упражнение
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h3 className="card__title">Последние сессии</h3>
            {recent.length === 0 ? (
              <div className="empty">Сессий пока нет</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Режим</th>
                    <th>WPM</th>
                    <th>Точность</th>
                    <th>Ошибки</th>
                    <th>Комбо</th>
                    <th>XP</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id}>
                      <td>{new Date(s.finished_at).toLocaleString('ru-RU')}</td>
                      <td>{MODE_LABEL[s.mode] ?? s.mode}</td>
                      <td>{Number(s.wpm).toFixed(0)}</td>
                      <td>{Number(s.accuracy).toFixed(1)}%</td>
                      <td>{s.errors}</td>
                      <td>{s.max_combo}</td>
                      <td>+{s.xp_earned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
