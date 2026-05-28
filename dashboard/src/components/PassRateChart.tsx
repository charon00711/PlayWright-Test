import type { RunSummary } from '../types';

type Props = {
  runs: RunSummary[];
  maxBars?: number;
};

export function PassRateChart({ runs, maxBars = 10 }: Props) {
  const slice = runs.slice(0, maxBars).reverse();
  if (slice.length === 0) {
    return <p className="empty">暂无历史数据，请先执行 npm run test:ci</p>;
  }

  const maxRate = 100;

  return (
    <div>
      <div className="chart">
        {slice.map((run) => {
          const total = run.passed + run.failed + (run.skipped ?? 0);
          const rate = total > 0 ? Math.round((run.passed / total) * 100) : 0;
          const height = `${Math.max((rate / maxRate) * 100, 4)}%`;
          const isFail = run.failed > 0;
          return (
            <div key={run.id} className="chart-item">
              <div
                className={`chart-bar ${isFail ? 'fail' : ''}`}
                style={{ height }}
                title={`${rate}%`}
              />
              <div className="chart-label">{run.id.slice(-6)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
