import { useEffect, useMemo } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { DayStat } from '../api/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface Props {
  data: DayStat[];
}

export default function WpmChart({ data }: Props) {
  const chartData = useMemo(() => {
    const points = data.slice(-30);
    return {
      labels: points.map((d) => d.day.slice(5)),
      datasets: [
        {
          label: 'Лучший WPM',
          data: points.map((d) => Number(d.best_wpm ?? 0)),
          borderColor: '#7df9ff',
          backgroundColor: 'rgba(125, 249, 255, 0.14)',
          pointBackgroundColor: '#7df9ff',
          pointBorderColor: '#07070c',
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 2,
          tension: 0.35,
          fill: true,
        },
      ],
    };
  }, [data]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(8, 9, 17, 0.95)',
          borderColor: 'rgba(125, 249, 255, 0.35)',
          borderWidth: 1,
          titleColor: '#7df9ff',
          bodyColor: '#d8e6ff',
          padding: 10,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(125, 249, 255, 0.07)' },
          ticks: { color: '#6f7fa8', font: { size: 10 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(125, 249, 255, 0.07)' },
          ticks: { color: '#6f7fa8', font: { size: 10 } },
        },
      },
    }),
    [],
  );

  useEffect(() => {
    // Chart.js требует явного пересчёта при смене размера контейнера.
    window.dispatchEvent(new Event('resize'));
  }, [data]);

  if (data.length === 0) {
    return <div className="empty">Пока нет данных — проведите первую тренировку</div>;
  }

  return (
    <div style={{ height: 220 }}>
      <Line data={chartData} options={options} />
    </div>
  );
}
