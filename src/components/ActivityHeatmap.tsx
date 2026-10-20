import { useMemo } from 'react';
import type { DayStat } from '../api/types';

interface Props {
  data: DayStat[];
}

const DAY_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

/** GitHub-подобная тепловая карта активности за последние N недель. */
export default function ActivityHeatmap({ data }: Props) {
  const cells = useMemo(() => {
    const map = new Map(data.map((d) => [d.day, d.sessions ?? 0]));
    const out: { day: string; sessions: number; level: number }[] = [];

    // Привязка к понедельнику: неделя начинается с понедельника.
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - ((end.getDay() + 6) % 7)));

    const weeks = 18;
    const start = new Date(end);
    start.setDate(start.getDate() - (weeks * 7 - 1));

    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`;
      const sessions = map.get(key) ?? 0;
      const level = sessions === 0 ? 0 : sessions <= 1 ? 1 : sessions <= 2 ? 2 : sessions <= 4 ? 3 : 4;
      out.push({ day: key, sessions, level });
    }
    return out;
  }, [data]);

  return (
    <div>
      <div className="heatmap">
        {cells.map((c) => (
          <div
            key={c.day}
            className={`heat heat--${c.level}`}
            title={`${c.day}: ${c.sessions} тренировок`}
          />
        ))}
      </div>
      <div className="heat-legend">
        <span>Меньше</span>
        <span className="heat heat--0" />
        <span className="heat heat--1" />
        <span className="heat heat--2" />
        <span className="heat heat--3" />
        <span className="heat heat--4" />
        <span>Больше</span>
      </div>
      <div className="chart-labels">
        {DAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </div>
  );
}
