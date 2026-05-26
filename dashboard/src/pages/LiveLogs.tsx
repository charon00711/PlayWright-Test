import { useEffect, useRef, useState } from 'react';
import {
  clearLiveLogs,
  fetchLiveLogEvents,
  fetchLiveLogStatus,
  fetchLiveTraces,
} from '../api';
import { ApiBanner } from '../components/ApiBanner';
import { useApiHealth } from '../hooks/useApiHealth';
import type { LiveLogEvent, TraceArtifact } from '../types';

type LogTab = 'console' | 'api' | 'trace' | 'network';

const TABS: { id: LogTab; label: string }[] = [
  { id: 'console', label: 'Console' },
  { id: 'api', label: 'API Log' },
  { id: 'trace', label: 'Playwright Trace' },
  { id: 'network', label: '网络请求' },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour12: false });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function traceViewerUrl(publicPath: string) {
  const traceUrl = `${window.location.origin}${publicPath}`;
  return `https://trace.playwright.dev/?trace=${encodeURIComponent(traceUrl)}`;
}

function levelClass(level?: string) {
  if (level === 'error') return 'log-level-error';
  if (level === 'warn') return 'log-level-warn';
  if (level === 'info') return 'log-level-info';
  return '';
}

function statusClass(status?: number) {
  if (!status) return '';
  if (status >= 500) return 'log-level-error';
  if (status >= 400) return 'log-level-warn';
  return 'log-level-ok';
}

function ConsoleLine({ event }: { event: LiveLogEvent }) {
  return (
    <div className={`live-log-line ${levelClass(event.level)}`}>
      <span className="live-log-time">{formatTime(event.ts)}</span>
      <span className="live-log-tag">{event.type === 'process' ? 'PW' : 'JS'}</span>
      {event.test && <span className="live-log-test">{event.test}</span>}
      <span className="live-log-message">{event.message}</span>
    </div>
  );
}

function ApiLine({ event }: { event: LiveLogEvent }) {
  return (
    <div className={`live-log-line ${statusClass(event.status)}`}>
      <span className="live-log-time">{formatTime(event.ts)}</span>
      <span className="live-log-method">{event.method}</span>
      <span className="live-log-url">{event.url}</span>
      <span className="live-log-meta">
        {event.status ? `${event.status}` : '—'}
        {event.durationMs != null ? ` · ${event.durationMs}ms` : ''}
        {event.source === 'platform' ? ' · 平台' : event.test ? ` · ${event.test}` : ' · 浏览器'}
      </span>
    </div>
  );
}

function NetworkLine({ event }: { event: LiveLogEvent }) {
  return (
    <div className={`live-log-line ${statusClass(event.status)}`}>
      <span className="live-log-time">{formatTime(event.ts)}</span>
      <span className="live-log-method">{event.method}</span>
      <span className="live-log-url">{event.url}</span>
      <span className="live-log-meta">
        {event.status ?? '—'}
        {event.resourceType ? ` · ${event.resourceType}` : ''}
        {event.durationMs != null ? ` · ${event.durationMs}ms` : ''}
      </span>
    </div>
  );
}

function TraceCard({ trace }: { trace: TraceArtifact }) {
  return (
    <div className="trace-card">
      <div className="trace-card-main">
        <strong>{trace.name}</strong>
        <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
          {trace.path} · {formatSize(trace.size)} · {formatTime(trace.updatedAt)}
        </div>
        {trace.status && (
          <span className={`badge ${trace.status === 'passed' ? 'pass' : 'fail'}`}>
            {trace.status}
          </span>
        )}
      </div>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <a
          className="btn btn-sm primary"
          href={traceViewerUrl(trace.publicPath)}
          target="_blank"
          rel="noreferrer"
        >
          在线查看 Trace
        </a>
        <a className="btn btn-sm" href={trace.publicPath} download>
          下载 zip
        </a>
      </div>
    </div>
  );
}

export function LiveLogs() {
  const apiAvailable = useApiHealth();
  const [tab, setTab] = useState<LogTab>('console');
  const [events, setEvents] = useState<LiveLogEvent[]>([]);
  const [traces, setTraces] = useState<TraceArtifact[]>([]);
  const [counts, setCounts] = useState({ console: 0, api: 0, network: 0, trace: 0 });
  const [testRunning, setTestRunning] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('');
  const cursorRef = useRef<string | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  async function reloadTraces() {
    const data = await fetchLiveTraces();
    setTraces(data.traces);
  }

  async function poll() {
    const status = await fetchLiveLogStatus();
    if (status) {
      setCounts(status.counts);
      setTestRunning(status.testRunning);
    }

    const data = await fetchLiveLogEvents(
      tab === 'trace' ? 'trace' : tab,
      cursorRef.current,
    );

    if (data.events.length > 0) {
      setEvents((prev) => {
        const merged = [...prev, ...data.events];
        const seen = new Set<string>();
        return merged.filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        }).slice(-1500);
      });
      cursorRef.current = data.cursor;
    }
    setTestRunning(data.testRunning);

    if (tab === 'trace') {
      await reloadTraces();
    }
  }

  useEffect(() => {
    setEvents([]);
    cursorRef.current = null;
    poll();
  }, [tab]);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, 1500);
    return () => clearInterval(timer);
  }, [tab, apiAvailable]);

  useEffect(() => {
    if (!autoScroll || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events, autoScroll, tab]);

  async function handleClear() {
    if (!confirm('确定清空所有实时日志？')) return;
    await clearLiveLogs();
    setEvents([]);
    cursorRef.current = null;
    await reloadTraces();
  }

  const keyword = filter.trim().toLowerCase();
  const filteredEvents = events.filter((e) => {
    if (!keyword) return true;
    return [e.message, e.url, e.test, e.method].some((v) =>
      (v || '').toLowerCase().includes(keyword),
    );
  });

  return (
    <div>
      <div className="page-header">
        <h2>实时日志</h2>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <label className="checkbox-label live-log-toggle">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            自动滚动
          </label>
          <button
            type="button"
            className="btn"
            disabled={!apiAvailable}
            onClick={handleClear}
          >
            清空日志
          </button>
        </div>
      </div>

      <ApiBanner />

      <div className="stats">
        <div className="stat">
          <div className="label">Console</div>
          <div className="value">{counts.console}</div>
        </div>
        <div className="stat">
          <div className="label">API Log</div>
          <div className="value">{counts.api}</div>
        </div>
        <div className="stat">
          <div className="label">网络请求</div>
          <div className="value">{counts.network}</div>
        </div>
        <div className="stat">
          <div className="label">Trace 文件</div>
          <div className="value">{counts.trace || traces.length}</div>
        </div>
      </div>

      <div className="card live-log-toolbar">
        <div className="tabs live-log-tabs">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="live-log-toolbar-right">
          {testRunning && (
            <span className="live-running">
              <span className="spinner" /> 测试运行中…
            </span>
          )}
          <input
            className="live-log-filter"
            placeholder="过滤关键字…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {tab === 'trace' ? (
        <div className="card">
          {traces.length === 0 ? (
            <p className="empty">
              暂无 Trace 文件。Playwright 在失败重试时会生成 trace（配置为 on-first-retry）。
              运行测试后刷新即可看到。
            </p>
          ) : (
            <div className="trace-list">
              {traces.map((trace) => (
                <TraceCard key={trace.id} trace={trace} />
              ))}
            </div>
          )}
          {events.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4>Trace 事件</h4>
              <div className="live-log-panel" ref={logRef}>
                {filteredEvents.map((event) => (
                  <div key={event.id} className="live-log-line">
                    <span className="live-log-time">{formatTime(event.ts)}</span>
                    <span className="live-log-message">
                      {event.message || event.tracePath}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card live-log-panel-wrap">
          <div className="live-log-panel" ref={logRef}>
            {filteredEvents.length === 0 ? (
              <p className="muted live-log-empty">
                {apiAvailable
                  ? '暂无日志。执行测试用例后，Console / API / 网络请求会在此实时更新。'
                  : '请使用 npm run platform:dev 启动本地 API 以采集实时日志。'}
              </p>
            ) : (
              filteredEvents.map((event) => {
                if (tab === 'console') return <ConsoleLine key={event.id} event={event} />;
                if (tab === 'api') return <ApiLine key={event.id} event={event} />;
                return <NetworkLine key={event.id} event={event} />;
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
