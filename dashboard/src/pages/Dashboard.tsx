import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchRunDetail,
  fetchRunIndex,
  fetchRunJobStatus,
  startRun,
} from '../api';
import { ApiBanner } from '../components/ApiBanner';
import { ModuleStats } from '../components/ModuleStats';
import { PassRateChart } from '../components/PassRateChart';
import { useApiHealth } from '../hooks/useApiHealth';
import type { RunDetail, RunSummary } from '../types';

export function Dashboard() {
  const navigate = useNavigate();
  const apiAvailable = useApiHealth();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [latestDetail, setLatestDetail] = useState<RunDetail | null>(null);
  const [chartLimit, setChartLimit] = useState(7);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchRunIndex()
      .then(async (data) => {
        setRuns(data.runs);
        if (data.runs[0]) {
          const detail = await fetchRunDetail(data.runs[0].id);
          setLatestDetail(detail);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const latest = runs[0];
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentRuns = runs.filter(
    (r) => new Date(r.startedAt).getTime() >= sevenDaysAgo,
  );
  const avgPassRate =
    recentRuns.length > 0
      ? Math.round(
          recentRuns.reduce((sum, r) => {
            const t = r.passed + r.failed + (r.skipped ?? 0);
            return sum + (t ? (r.passed / t) * 100 : 0);
          }, 0) / recentRuns.length,
        )
      : 0;
  const avgDuration =
    runs.length > 0
      ? runs.reduce((s, r) => s + r.durationMs, 0) / Math.min(runs.length, 10)
      : 0;
  const recentFails = runs.filter((r) => r.failed > 0).length;

  async function handleRunSmoke() {
    if (!apiAvailable) return;
    setRunning(true);
    try {
      await startRun({ grep: 'smoke' });
      const poll = setInterval(async () => {
        const st = await fetchRunJobStatus();
        if (!st.running) {
          clearInterval(poll);
          setRunning(false);
          const idx = await fetchRunIndex();
          setRuns(idx.runs);
        }
      }, 2000);
    } catch {
      setRunning(false);
    }
  }

  if (loading) return <p>加载中…</p>;

  return (
    <div>
      <h2>仪表盘</h2>
      <ApiBanner />

      {!latest ? (
        <div className="card empty">
          暂无测试运行记录。请执行：
          <pre style={{ textAlign: 'left', marginTop: '1rem' }}>
            npm run test:ci
          </pre>
          {apiAvailable && (
            <button type="button" className="btn primary" onClick={handleRunSmoke}>
              运行冒烟测试
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <div className="label">总运行次数</div>
              <div className="value">{runs.length}</div>
            </div>
            <div className="stat">
              <div className="label">7 日平均通过率</div>
              <div className="value">{avgPassRate}%</div>
            </div>
            <div className="stat">
              <div className="label">平均耗时</div>
              <div className="value">{(avgDuration / 1000).toFixed(1)}s</div>
            </div>
            <div className="stat">
              <div className="label">失败运行数</div>
              <div className="value" style={{ color: 'var(--fail)' }}>
                {recentFails}
              </div>
            </div>
          </div>

          <div className="card quick-actions">
            <h3>快捷操作</h3>
            <div className="btn-row">
              <button
                type="button"
                className="btn primary"
                disabled={!apiAvailable || running}
                onClick={handleRunSmoke}
              >
                {running ? '测试运行中…' : '运行冒烟'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={!apiAvailable}
                onClick={() => navigate('/recorder')}
              >
                录制测试
              </button>
              <button
                type="button"
                className="btn"
                disabled={!apiAvailable}
                onClick={() => navigate('/cases/new')}
              >
                新建用例
              </button>
              <Link to="/reports" className="btn">
                测试报告
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-header-row">
              <h3>通过率趋势</h3>
              <select
                value={chartLimit}
                onChange={(e) => setChartLimit(Number(e.target.value))}
              >
                <option value={7}>近 7 次</option>
                <option value={30}>近 30 次</option>
              </select>
            </div>
            <PassRateChart runs={runs} maxBars={chartLimit} />
          </div>

          {latestDetail && <ModuleStats tests={latestDetail.tests} />}

          <div className="card">
            <h3>最近运行</h3>
            <p>
              {new Date(latest.startedAt).toLocaleString('zh-CN')} ·{' '}
              <span className={latest.failed ? 'badge fail' : 'badge pass'}>
                {latest.passed}/{latest.passed + latest.failed}
              </span>
            </p>
            <Link to={`/reports/runs/${latest.id}`}>查看详情 →</Link>
          </div>
        </>
      )}
    </div>
  );
}
