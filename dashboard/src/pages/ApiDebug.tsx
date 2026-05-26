import { useEffect, useState } from 'react';
import { ApiBanner } from '../components/ApiBanner';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const HISTORY_KEY = 'pw-platform-api-history';
const MAX_HISTORY = 20;

type HeaderRow = { id: string; key: string; value: string };
type HistoryItem = {
  method: string;
  url: string;
  headers: HeaderRow[];
  body: string;
  timestamp: string;
};

type ApiResponse = {
  status: number;
  statusText: string;
  durationMs: number;
  headers: Record<string, string>;
  body: string;
  error?: string;
};

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

function newHeaderRow(): HeaderRow {
  return { id: crypto.randomUUID(), key: '', value: '' };
}

export function ApiDebug() {
  const [method, setMethod] = useState<(typeof METHODS)[number]>('GET');
  const [url, setUrl] = useState('https://mail.711621.xyz/api/session');
  const [headers, setHeaders] = useState<HeaderRow[]>([newHeaderRow()]);
  const [body, setBody] = useState('{\n  \n}');
  const [headersOpen, setHeadersOpen] = useState(true);
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const showBody = ['POST', 'PUT', 'PATCH'].includes(method);

  function addHeader() {
    setHeaders((h) => [...h, newHeaderRow()]);
  }

  function removeHeader(id: string) {
    setHeaders((h) => h.filter((x) => x.id !== id));
  }

  function updateHeader(id: string, field: 'key' | 'value', val: string) {
    setHeaders((h) =>
      h.map((x) => (x.id === id ? { ...x, [field]: val } : x)),
    );
  }

  function applyHistory(item: HistoryItem) {
    setMethod(item.method as (typeof METHODS)[number]);
    setUrl(item.url);
    setHeaders(item.headers.length ? item.headers : [newHeaderRow()]);
    setBody(item.body);
  }

  async function handleSend() {
    if (!url.trim()) return;
    setSending(true);
    setResponse(null);
    const start = Date.now();

    const headerObj: Record<string, string> = {};
    for (const h of headers) {
      if (h.key.trim()) headerObj[h.key.trim()] = h.value;
    }

    const item: HistoryItem = {
      method,
      url: url.trim(),
      headers: headers.filter((h) => h.key.trim()),
      body: showBody ? body : '',
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [item, ...history.filter((h) => h.url !== item.url || h.method !== item.method)].slice(0, MAX_HISTORY);
    setHistory(nextHistory);
    saveHistory(nextHistory);

    try {
      const res = await fetch(url.trim(), {
        method,
        headers: headerObj,
        body: showBody ? body : undefined,
      });
      const text = await res.text();
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });
      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* keep raw */
      }
      setResponse({
        status: res.status,
        statusText: res.statusText,
        durationMs: Date.now() - start,
        headers: resHeaders,
        body: formatted,
      });
    } catch (e) {
      setResponse({
        status: 0,
        statusText: 'Error',
        durationMs: Date.now() - start,
        headers: {},
        body: '',
        error:
          e instanceof Error
            ? `${e.message}\n\n提示：跨域请求需在目标服务端配置 CORS，或在 vite.config.ts 中配置 proxy。`
            : String(e),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h2>接口请求</h2>
      <ApiBanner />

      <div className="card">
        <div className="api-request-row">
          <select
            className="method-select"
            value={method}
            onChange={(e) =>
              setMethod(e.target.value as (typeof METHODS)[number])
            }
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            className="url-input"
            type="url"
            placeholder="https://example.com/api/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="button"
            className="btn primary"
            disabled={sending || !url.trim()}
            onClick={handleSend}
          >
            {sending ? '发送中…' : '发送'}
          </button>
        </div>

        <div className="api-section">
          <button
            type="button"
            className="section-toggle"
            onClick={() => setHeadersOpen((v) => !v)}
          >
            Headers {headersOpen ? '▾' : '▸'}
          </button>
          {headersOpen && (
            <div className="headers-editor">
              {headers.map((h) => (
                <div key={h.id} className="header-row">
                  <input
                    placeholder="Key"
                    value={h.key}
                    onChange={(e) => updateHeader(h.id, 'key', e.target.value)}
                  />
                  <input
                    placeholder="Value"
                    value={h.value}
                    onChange={(e) => updateHeader(h.id, 'value', e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => removeHeader(h.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" onClick={addHeader}>
                + 新增 Header
              </button>
            </div>
          )}
        </div>

        {showBody && (
          <div className="api-section">
            <label>Body</label>
            <textarea
              className="code-area"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        )}
      </div>

      {response && (
        <div className="card">
          <div className="response-header">
            <span
              className={`badge ${response.status >= 200 && response.status < 300 ? 'pass' : response.status === 0 ? 'skip' : 'fail'}`}
            >
              {response.status || '—'} {response.statusText}
            </span>
            <span className="muted">{response.durationMs} ms</span>
          </div>
          {response.error ? (
            <pre className="log-panel">{response.error}</pre>
          ) : (
            <>
              <details className="response-details">
                <summary>Response Headers</summary>
                <pre className="code-block">
                  {JSON.stringify(response.headers, null, 2)}
                </pre>
              </details>
              <pre className="code-block response-body">{response.body}</pre>
            </>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <h3>请求历史</h3>
          <ul className="history-list">
            {history.map((item, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="history-item"
                  onClick={() => applyHistory(item)}
                >
                  <span className="badge skip">{item.method}</span>
                  <span className="history-url">{item.url}</span>
                  <span className="muted">
                    {new Date(item.timestamp).toLocaleString('zh-CN')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
