import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createApiCase,
  deleteApiCase,
  fetchApiCases,
  runApiCase,
  runApiCasesBatch,
} from '../api';
import { ApiBanner } from '../components/ApiBanner';
import { IconPlay } from '../components/NavIcons';
import { useApiHealth } from '../hooks/useApiHealth';
import { useToast } from '../hooks/useToast';
import type { ApiBodyType, ApiCase, ApiHttpMethod, KeyValuePair } from '../types';

function tokenizeCurl(input: string) {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escape = false;

  for (const ch of input.replace(/\\\r?\n/g, ' ')) {
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens.filter((t) => t && t !== 'curl');
}

function splitHeader(header: string): KeyValuePair | null {
  const idx = header.indexOf(':');
  if (idx < 0) return null;
  const key = header.slice(0, idx).trim();
  const value = header.slice(idx + 1).trim();
  if (!key) return null;
  return { key, value };
}

function parseCurl(input: string): Partial<ApiCase> & { name: string } {
  const tokens = tokenizeCurl(input);
  let method: ApiHttpMethod = 'GET';
  let url = '';
  const headers: KeyValuePair[] = [];
  let body = '';

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const next = tokens[i + 1];
    if ((token === '-X' || token === '--request') && next) {
      method = next.toUpperCase() as ApiHttpMethod;
      i += 1;
    } else if ((token === '-H' || token === '--header') && next) {
      const header = splitHeader(next);
      if (header) headers.push(header);
      i += 1;
    } else if (
      ['-d', '--data', '--data-raw', '--data-binary', '--data-urlencode'].includes(token) &&
      next != null
    ) {
      body = body ? `${body}&${next}` : next;
      if (method === 'GET') method = 'POST';
      i += 1;
    } else if (!token.startsWith('-')) {
      url = token;
    }
  }

  if (!url) throw new Error('未识别到 cURL URL');

  let query: KeyValuePair[] = [];
  try {
    const parsed = new URL(url);
    query = Array.from(parsed.searchParams.entries()).map(([key, value]) => ({
      key,
      value,
    }));
    parsed.search = '';
    url = parsed.toString();
  } catch {
    const [base, qs] = url.split('?');
    url = base;
    query =
      qs?.split('&').filter(Boolean).map((pair) => {
        const [key, value = ''] = pair.split('=');
        return {
          key: decodeURIComponent(key),
          value: decodeURIComponent(value),
        };
      }) ?? [];
  }

  const contentType =
    headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? '';
  const trimmedBody = body.trim();
  const bodyType: ApiBodyType = !trimmedBody
    ? 'none'
    : contentType.includes('application/json') ||
        trimmedBody.startsWith('{') ||
        trimmedBody.startsWith('[')
      ? 'json'
      : contentType.includes('application/x-www-form-urlencoded')
        ? 'form'
        : 'text';
  const namePath = (() => {
    try {
      const parsed = new URL(url);
      return parsed.pathname === '/' ? parsed.hostname : parsed.pathname;
    } catch {
      return url;
    }
  })();

  return {
    name: `cURL ${method} ${namePath}`.slice(0, 80),
    module: 'api',
    tags: ['@regression'],
    method,
    url,
    headers,
    query,
    body: trimmedBody,
    bodyType,
    timeoutMs: 15000,
    assertions: [{ type: 'status', op: 'eq', value: 200 }],
  };
}

export function ApiCasesList() {
  const navigate = useNavigate();
  const apiAvailable = useApiHealth();
  const toast = useToast();
  const [cases, setCases] = useState<ApiCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [curlOpen, setCurlOpen] = useState(false);
  const [curlText, setCurlText] = useState('');
  const [importingCurl, setImportingCurl] = useState(false);

  function reload() {
    fetchApiCases()
      .then((d) => setCases(d.cases))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleRunOne(id: string) {
    if (!apiAvailable || running) return;
    setRunning(true);
    setRunningId(id);
    setError('');
    try {
      const result = await runApiCase(id);
      setLastRunId(result.id);
      toast.showSuccess(`接口用例运行完成：${result.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.showError(`运行失败：${msg}`);
    } finally {
      setRunning(false);
      setRunningId(null);
    }
  }

  async function handleRunBatch(tag?: string) {
    if (!apiAvailable || running) return;
    setRunning(true);
    setRunningId(null);
    setError('');
    try {
      const result = await runApiCasesBatch(tag ? { tag } : {});
      setLastRunId(result.id);
      toast.showSuccess(`批量运行完成：${result.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.showError(`批量运行失败：${msg}`);
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!apiAvailable) return;
    if (!confirm(`确定删除接口用例「${name}」？`)) return;
    try {
      await deleteApiCase(id);
      toast.showSuccess(`已删除接口用例：${name}`);
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.showError(`删除失败：${msg}`);
    }
  }

  async function handleImportCurl() {
    if (!apiAvailable || !curlText.trim()) return;
    setImportingCurl(true);
    setError('');
    try {
      const payload = parseCurl(curlText);
      const created = await createApiCase(payload);
      toast.showSuccess(`已导入接口用例：${created.name}`);
      setCurlText('');
      setCurlOpen(false);
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.showError(`cURL 导入失败：${msg}`);
    } finally {
      setImportingCurl(false);
    }
  }

  return (
    <div className="page api-cases-page">
      <div className="page-header">
        <div>
          <h2>接口管理</h2>
          <p className="muted">单接口自动化：配置请求与断言，支持批量回归</p>
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn"
            disabled={!apiAvailable}
            onClick={() => setCurlOpen((v) => !v)}
          >
            cURL 导入
          </button>
          <Link to="/api-cases/new" className="btn primary">
            新建接口
          </Link>
          <Link to="/api-cases/runs" className="btn">
            运行历史
          </Link>
        </div>
      </div>

      <ApiBanner requireWrite />

      {error && <div className="alert alert-error">{error}</div>}
      {curlOpen && (
        <div className="card curl-import-panel">
          <h3>cURL 导入</h3>
          <p className="muted">
            粘贴浏览器或 Postman 复制的 cURL，平台会自动识别 Method、URL、Headers、Query 和 Body。
          </p>
          <textarea
            className="code-area"
            rows={6}
            value={curlText}
            onChange={(e) => setCurlText(e.target.value)}
            placeholder={`curl 'https://api.example.com/users?page=1' \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"demo"}'`}
          />
          <div className="btn-row">
            <button
              type="button"
              className="btn primary"
              disabled={!apiAvailable || importingCurl || !curlText.trim()}
              onClick={() => void handleImportCurl()}
            >
              {importingCurl ? '导入中…' : '导入为接口用例'}
            </button>
            <button type="button" className="btn" onClick={() => setCurlOpen(false)}>
              取消
            </button>
          </div>
        </div>
      )}
      {lastRunId && (
        <div className="alert alert-ok">
          运行完成。
          <Link to="/api-cases/runs"> 查看历史 </Link>
          （{lastRunId}）
        </div>
      )}

      <div className="btn-row">
        <button
          type="button"
          className="btn"
          disabled={!apiAvailable || running}
          onClick={() => void handleRunBatch('@smoke')}
        >
          批量运行 @smoke
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!apiAvailable || running}
          onClick={() => void handleRunBatch()}
        >
          运行全部
        </button>
      </div>

      {loading ? (
        <p>加载中…</p>
      ) : cases.length === 0 ? (
        <p className="muted">暂无接口，请点击「新建接口」或「cURL 导入」开始。</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>模块</th>
                <th>方法</th>
                <th>URL</th>
                <th>标签</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.module}</td>
                  <td>
                    <span className="badge">{c.method}</span>
                  </td>
                  <td className="mono">{c.url}</td>
                  <td>{c.tags.join(' ')}</td>
                  <td>
                    <div className="btn-row" style={{ marginTop: 0 }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={!apiAvailable || running}
                        onClick={() => void handleRunOne(c.id)}
                        title="运行"
                      >
                        <IconPlay className="nav-icon" />
                        {runningId === c.id ? '…' : '运行'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => navigate(`/api-cases/${c.id}/edit`)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={!apiAvailable}
                        onClick={() => void handleDelete(c.id, c.name)}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
