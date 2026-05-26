import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchPerfLoad,
  fetchPerfLoadStatus,
  fetchPerfVitals,
  triggerLoadTest,
} from '../api';
import { ApiBanner } from '../components/ApiBanner';
import { useApiHealth } from '../hooks/useApiHealth';
import type {
  LoadTestEntry,
  PerfLoadStatus,
  PerfVitalsReport,
  WebVitalsEntry,
} from '../types';

type PerfTab = 'vitals' | 'load';

const TABS: { id: PerfTab; label: string }[] = [
  { id: 'vitals', label: 'Web Vitals' },
  { id: 'load', label: '负载测试' },
];

function formatMs(value?: number) {
  if (value == null || Number.isNaN(value)) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function vitalsRating(metric: 'lcp' | 'cls', value?: number) {
  if (value == null) return '';
  if (metric === 'lcp') {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'warn';
    return 'bad';
  }
  if (value <= 0.1) return 'good';
  if (value <= 0.25) return 'warn';
  return 'bad';
}

export function PerfCenter() {
  const apiAvailable = useApiHealth();
  const [tab, setTab] = useState<PerfTab>('vitals');
  const [vitalsReports, setVitalsReports] = useState<PerfVitalsReport[]>([]);
  const [loadReports, setLoadReports] = useState<LoadTestEntry[]>([]);
  const [loadStatus, setLoadStatus] = useState<PerfLoadStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vus, setVus] = useState(10);
  const [duration, setDuration] = useState('30s');

  const refresh = useCallback(async () => {
    const [vitals, load] = await Promise.all([
      fetchPerfVitals(),
      fetchPerfLoad(),
    ]);
    setVitalsReports(vitals.reports);
    setLoadReports(load.reports);
    if (apiAvailable) {
      const status = await fetchPerfLoadStatus();
      setLoadStatus(status);
    }
  }, [apiAvailable]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!loadStatus?.running) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [loadStatus?.running, refresh]);

  const vitalsChartData = useMemo(() => {
    const points: Array<Record<string, string | number>> = [];
    for (const report of vitalsReports) {
      for (const entry of report.entries) {
        points.push({
          time: formatTime(entry.collectedAt),
          collectedAt: entry.collectedAt,
          label: `${entry.testTitle} @ ${formatTime(entry.collectedAt)}`,
          lcp: entry.metrics.lcp ?? 0,
          fcp: entry.metrics.fcp ?? 0,
          ttfb: entry.metrics.ttfb ?? 0,
          cls: entry.metrics.cls ?? 0,
          tti: entry.metrics.tti ?? 0,
        });
      }
    }
    return points.sort(
      (a, b) =>
        new Date(String(a.collectedAt)).getTime() -
        new Date(String(b.collectedAt)).getTime(),
    );
  }, [vitalsReports]);

  const loadChartData = useMemo(
    () =>
      [...loadReports]
        .sort(
          (a, b) =>
            new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
        )
        .map((entry) => ({
          time: formatTime(entry.startedAt),
          rps: Number(entry.metrics.rps.toFixed(2)),
          p50: Number(entry.metrics.p50.toFixed(0)),
          p95: Number(entry.metrics.p95.toFixed(0)),
          p99: Number(entry.metrics.p99.toFixed(0)),
          errorRate: Number((entry.metrics.errorRate * 100).toFixed(2)),
        })),
    [loadReports],
  );

  const latestVitals = vitalsReports[0]?.entries ?? [];

  async function handleRunLoadTest() {
    if (!apiAvailable) return;
    setLoading(true);
    setError('');
    try {
      await triggerLoadTest({ vus, duration });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page perf-center">
      <div className="page-header">
        <div>
          <h2>性能中心</h2>
          <p className="muted">Web Vitals 页面性能与 k6 接口负载测试</p>
        </div>
        <button type="button" className="btn" onClick={() => void refresh()}>
          刷新
        </button>
      </div>

      <ApiBanner available={apiAvailable} />

      <div className="tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {tab === 'vitals' && (
        <div className="perf-panel">
          <div className="perf-summary-grid">
            <div className="perf-card">
              <span className="perf-card-label">最近报告</span>
              <strong>{vitalsReports.length}</strong>
            </div>
            <div className="perf-card">
              <span className="perf-card-label">采样点数</span>
              <strong>{vitalsChartData.length}</strong>
            </div>
            <div className="perf-card">
              <span className="perf-card-label">LCP 阈值</span>
              <strong>≤ 2.5s 良好</strong>
            </div>
            <div className="perf-card">
              <span className="perf-card-label">CLS 阈值</span>
              <strong>≤ 0.1 良好</strong>
            </div>
          </div>

          <div className="perf-chart-card">
            <h3>Web Vitals 趋势</h3>
            {vitalsChartData.length === 0 ? (
              <p className="muted">暂无 Web Vitals 数据。运行 `npm run test:perf` 采集。</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={vitalsChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v))}ms`} />
                  <Tooltip formatter={(value) => formatMs(Number(value))} />
                  <Legend />
                  <ReferenceLine y={2500} stroke="#16a34a" strokeDasharray="4 4" label="LCP 2.5s" />
                  <ReferenceLine y={4000} stroke="#dc2626" strokeDasharray="4 4" label="LCP 4s" />
                  <Line type="monotone" dataKey="lcp" name="LCP" stroke="#6366f1" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="fcp" name="FCP" stroke="#0ea5e9" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="ttfb" name="TTFB" stroke="#f59e0b" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="tti" name="TTI" stroke="#8b5cf6" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="perf-chart-card">
            <h3>CLS 趋势</h3>
            {vitalsChartData.length === 0 ? (
              <p className="muted">暂无 CLS 数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={vitalsChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={0.1} stroke="#16a34a" strokeDasharray="4 4" label="0.1" />
                  <ReferenceLine y={0.25} stroke="#dc2626" strokeDasharray="4 4" label="0.25" />
                  <Line type="monotone" dataKey="cls" name="CLS" stroke="#ef4444" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {latestVitals.length > 0 && (
            <div className="table-wrap">
              <h3>最近一次采样明细</h3>
              <table>
                <thead>
                  <tr>
                    <th>用例</th>
                    <th>URL</th>
                    <th>LCP</th>
                    <th>FCP</th>
                    <th>TTFB</th>
                    <th>CLS</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {latestVitals.map((entry: WebVitalsEntry) => (
                    <tr key={`${entry.testTitle}-${entry.collectedAt}`}>
                      <td>{entry.testTitle}</td>
                      <td className="mono">{entry.url}</td>
                      <td className={`perf-${vitalsRating('lcp', entry.metrics.lcp)}`}>
                        {formatMs(entry.metrics.lcp)}
                      </td>
                      <td>{formatMs(entry.metrics.fcp)}</td>
                      <td>{formatMs(entry.metrics.ttfb)}</td>
                      <td className={`perf-${vitalsRating('cls', entry.metrics.cls)}`}>
                        {entry.metrics.cls?.toFixed(3) ?? '—'}
                      </td>
                      <td>{formatTime(entry.collectedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'load' && (
        <div className="perf-panel">
          {apiAvailable && (
            <div className="perf-form-card">
              <h3>触发负载测试</h3>
              <div className="perf-form-row">
                <label>
                  虚拟用户 (VUs)
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={vus}
                    onChange={(e) => setVus(Number(e.target.value))}
                  />
                </label>
                <label>
                  持续时间
                  <input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="30s / 1m / 5m"
                  />
                </label>
                <button
                  type="button"
                  className="btn primary"
                  disabled={loading || loadStatus?.running}
                  onClick={() => void handleRunLoadTest()}
                >
                  {loadStatus?.running ? '运行中…' : '开始负载测试'}
                </button>
              </div>
              {loadStatus?.running && (
                <pre className="log-panel perf-log">{loadStatus.output || 'k6 正在运行…'}</pre>
              )}
            </div>
          )}

          <div className="perf-summary-grid">
            <div className="perf-card">
              <span className="perf-card-label">负载报告</span>
              <strong>{loadReports.length}</strong>
            </div>
            <div className="perf-card">
              <span className="perf-card-label">最近 RPS</span>
              <strong>{loadReports[0]?.metrics.rps.toFixed(2) ?? '—'}</strong>
            </div>
            <div className="perf-card">
              <span className="perf-card-label">最近 p95</span>
              <strong>{formatMs(loadReports[0]?.metrics.p95)}</strong>
            </div>
            <div className="perf-card">
              <span className="perf-card-label">错误率</span>
              <strong>
                {loadReports[0]
                  ? `${(loadReports[0].metrics.errorRate * 100).toFixed(2)}%`
                  : '—'}
              </strong>
            </div>
          </div>

          <div className="perf-chart-card">
            <h3>负载测试趋势</h3>
            {loadChartData.length === 0 ? (
              <p className="muted">暂无负载测试数据。运行 `npm run perf:load` 或在上方触发。</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={loadChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="rps" name="RPS" stroke="#6366f1" strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="p95" name="p95 (ms)" stroke="#f59e0b" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="errorRate" name="错误率 (%)" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {loadReports.length > 0 && (
            <div className="table-wrap">
              <h3>负载测试历史</h3>
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>VUs</th>
                    <th>时长</th>
                    <th>RPS</th>
                    <th>p50</th>
                    <th>p95</th>
                    <th>p99</th>
                    <th>错误率</th>
                    <th>请求数</th>
                  </tr>
                </thead>
                <tbody>
                  {loadReports.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatTime(entry.startedAt)}</td>
                      <td>{entry.metrics.vus}</td>
                      <td>{entry.metrics.duration}</td>
                      <td>{entry.metrics.rps.toFixed(2)}</td>
                      <td>{formatMs(entry.metrics.p50)}</td>
                      <td>{formatMs(entry.metrics.p95)}</td>
                      <td>{formatMs(entry.metrics.p99)}</td>
                      <td>{(entry.metrics.errorRate * 100).toFixed(2)}%</td>
                      <td>{entry.metrics.totalRequests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
