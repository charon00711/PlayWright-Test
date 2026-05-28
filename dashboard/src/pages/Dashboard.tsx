import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchCases,
  fetchRunDetail,
  fetchRunIndex,
  fetchRunJobStatus,
  startRun,
} from '../api';
import { ApiBanner } from '../components/ApiBanner';
import { ModuleStats } from '../components/ModuleStats';
import { PassRateChart } from '../components/PassRateChart';
import { useApiHealth } from '../hooks/useApiHealth';
import { useToast } from '../hooks/useToast';
import type { RunDetail, RunSummary, TestCase } from '../types';

const RUN_POLL_MS = 700;

export function Dashboard() {
  const navigate = useNavigate();
  const apiAvailable = useApiHealth();
  const toast = useToast();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [latestDetail, setLatestDetail] = useState<RunDetail | null>(null);
  const [chartLimit, setChartLimit] = useState(7);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningCases, setRunningCases] = useState<TestCase[]>([]);
  const [runLog, setRunLog] = useState('');
  const [runExitCode, setRunExitCode] = useState<number | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

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

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [runLog]);

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
    setRunLog('');
    setRunExitCode(null);
    setLastRunId(null);
    try {
      const casesData = await fetchCases();
      const smokeCases = casesData.cases.filter(
        (c) => c.module === 'smoke' || c.tags.includes('@smoke'),
      );
      setRunningCases(smokeCases);

      if (smokeCases.length === 0) {
        setRunning(false);
        toast.showError('没有找到冒烟用例（module=smoke 或 @smoke）');
        return;
      }

      await startRun({ specPaths: smokeCases.map((c) => c.specPath) });

      if (pollRef.current) clearInterval(pollRef.current);
      const poll = async () => {
        const st = await fetchRunJobStatus();
        setRunLog(st.output);
        setRunExitCode(st.exitCode);
        if (st.lastRunId) setLastRunId(st.lastRunId);
        if (!st.running) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setRunning(false);
          const idx = await fetchRunIndex();
          setRuns(idx.runs);
          if (idx.runs[0]) {
            const detail = await fetchRunDetail(idx.runs[0].id);
            setLatestDetail(detail);
          }
          if (st.exitCode === 0) {
            toast.showSuccess('冒烟用例执行通过');
          } else {
            toast.showError(`冒烟用例执行失败，退出码 ${st.exitCode ?? 1}`);
          }
        }
      };
      void poll();
      pollRef.current = setInterval(poll, RUN_POLL_MS);
    } catch (e) {
      setRunning(false);
      const msg = e instanceof Error ? e.message : String(e);
      setRunLog(msg);
      toast.showError(`启动冒烟用例失败：${msg}`);
    }
  }

  if (loading) return <p>加载中…</p>;

  return (
    <div>
      <h2>仪表盘</h2>
      <ApiBanner />

      {(running || runLog || runningCases.length > 0) && (
        <div className="card run-log-panel">
          <div className="card-header-row">
            <h3>冒烟运行情况</h3>
            <div className="btn-row" style={{ marginTop: 0 }}>
              {running && <span className="badge pass">运行中</span>}
              {!running && runExitCode !== null && (
                <span className={`badge ${runExitCode === 0 ? 'pass' : 'fail'}`}>
                  退出码 {runExitCode}
                </span>
              )}
              {!running && lastRunId && (
                <Link to={`/reports/runs/${lastRunId}`}>查看测试报告 →</Link>
              )}
            </div>
          </div>

          <div className="run-case-list">
            <strong>本次运行用例：</strong>
            {runningCases.length > 0 ? (
              <ul>
                {runningCases.map((c) => (
                  <li key={c.id}>
                    {c.title}
                    <code>{c.specPath}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="muted">暂无匹配用例</span>
            )}
          </div>

          <pre ref={logRef} className="log-panel log-panel-tall">
            {runLog || '等待输出…'}
          </pre>
        </div>
      )}

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
