import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createApiCase,
  debugApiCase,
  fetchApiCase,
  runApiCase,
  updateApiCase,
} from '../api';
import { ApiBanner } from '../components/ApiBanner';
import { useApiHealth } from '../hooks/useApiHealth';
import type {
  ApiBodyType,
  ApiCaseRunResult,
  ApiHttpMethod,
  Assertion,
  KeyValuePair,
} from '../types';

const METHODS: ApiHttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const BODY_TYPES: ApiBodyType[] = ['none', 'json', 'form', 'text'];
const MODULES = ['auth', 'admin', 'smoke', 'mail', 'api'];

function emptyKv(): KeyValuePair {
  return { key: '', value: '' };
}

function defaultAssertion(): Assertion {
  return { type: 'status', op: 'eq', value: 200 };
}

export function ApiCaseForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id && id !== 'new');
  const navigate = useNavigate();
  const apiAvailable = useApiHealth();

  const [name, setName] = useState('');
  const [module, setModule] = useState('smoke');
  const [tagsStr, setTagsStr] = useState('@regression');
  const [method, setMethod] = useState<ApiHttpMethod>('GET');
  const [url, setUrl] = useState('${BASE_URL}');
  const [headers, setHeaders] = useState<KeyValuePair[]>([emptyKv()]);
  const [query, setQuery] = useState<KeyValuePair[]>([emptyKv()]);
  const [bodyType, setBodyType] = useState<ApiBodyType>('none');
  const [body, setBody] = useState('{\n  \n}');
  const [timeoutMs, setTimeoutMs] = useState(15000);
  const [assertions, setAssertions] = useState<Assertion[]>([defaultAssertion()]);
  const [bodyTab, setBodyTab] = useState<'query' | 'body'>('query');

  const [saving, setSaving] = useState(false);
  const [debugging, setDebugging] = useState(false);
  const [error, setError] = useState('');
  const [debugResult, setDebugResult] = useState<ApiCaseRunResult | null>(null);

  useEffect(() => {
    if (!isEdit || !id) return;
    fetchApiCase(id).then((c) => {
      if (!c) return;
      setName(c.name);
      setModule(c.module);
      setTagsStr(c.tags.join(' '));
      setMethod(c.method);
      setUrl(c.url);
      setHeaders(c.headers.length ? c.headers : [emptyKv()]);
      setQuery(c.query.length ? c.query : [emptyKv()]);
      setBodyType(c.bodyType);
      setBody(c.body || '');
      setTimeoutMs(c.timeoutMs ?? 15000);
      setAssertions(c.assertions.length ? c.assertions : [defaultAssertion()]);
    });
  }, [id, isEdit]);

  function buildPayload() {
    return {
      name,
      module,
      tags: tagsStr.split(/\s+/).filter(Boolean),
      method,
      url,
      headers: headers.filter((h) => h.key.trim()),
      query: query.filter((q) => q.key.trim()),
      body,
      bodyType,
      timeoutMs,
      assertions,
    };
  }

  async function handleSave(runAfter = false) {
    if (!apiAvailable) return;
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload();
      if (isEdit && id) {
        await updateApiCase(id, payload);
        if (runAfter) {
          await runApiCase(id);
        }
      } else {
        const created = await createApiCase(payload);
        if (runAfter) {
          await runApiCase(created.id);
        }
      }
      navigate('/api-cases');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDebug() {
    if (!apiAvailable) return;
    setDebugging(true);
    setError('');
    setDebugResult(null);
    try {
      const result = await debugApiCase(buildPayload());
      setDebugResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDebugging(false);
    }
  }

  function updateKv(
    list: KeyValuePair[],
    setList: (v: KeyValuePair[]) => void,
    index: number,
    field: 'key' | 'value',
    val: string,
  ) {
    setList(list.map((row, i) => (i === index ? { ...row, [field]: val } : row)));
  }

  function updateAssertion(index: number, patch: Partial<Assertion>) {
    setAssertions((rows) =>
      rows.map((row, i) => (i === index ? ({ ...row, ...patch } as Assertion) : row)),
    );
  }

  return (
    <div className="page api-case-form">
      <p>
        <Link to="/api-cases">← 接口用例列表</Link>
      </p>
      <h2>{isEdit ? '编辑接口用例' : '新建接口用例'}</h2>
      <ApiBanner requireWrite />

      {error && <div className="alert alert-error">{error}</div>}

      <form
        className="form api-form"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave(false);
        }}
      >
        <section className="api-form-section">
          <h3>基础信息</h3>
          <label>
            名称
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <div className="api-form-grid">
            <label>
              模块
              <select value={module} onChange={(e) => setModule(e.target.value)}>
                {MODULES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              方法
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as ApiHttpMethod)}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              超时 (ms)
              <input
                type="number"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            标签（空格分隔）
            <input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} />
          </label>
          <label>
            URL（支持 ${'${BASE_URL}'} 等变量）
            <input value={url} onChange={(e) => setUrl(e.target.value)} required />
          </label>
        </section>

        <section className="api-form-section">
          <h3>Headers</h3>
          {headers.map((row, i) => (
            <div key={`h-${i}`} className="kv-row">
              <input
                placeholder="Key"
                value={row.key}
                onChange={(e) => updateKv(headers, setHeaders, i, 'key', e.target.value)}
              />
              <input
                placeholder="Value"
                value={row.value}
                onChange={(e) => updateKv(headers, setHeaders, i, 'value', e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setHeaders(headers.filter((_, j) => j !== i))}
              >
                删除
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setHeaders([...headers, emptyKv()])}>
            + Header
          </button>
        </section>

        <section className="api-form-section">
          <div className="tabs">
            <button
              type="button"
              className={bodyTab === 'query' ? 'active' : ''}
              onClick={() => setBodyTab('query')}
            >
              Query
            </button>
            <button
              type="button"
              className={bodyTab === 'body' ? 'active' : ''}
              onClick={() => setBodyTab('body')}
            >
              Body
            </button>
          </div>

          {bodyTab === 'query' && (
            <>
              {query.map((row, i) => (
                <div key={`q-${i}`} className="kv-row">
                  <input
                    placeholder="Key"
                    value={row.key}
                    onChange={(e) => updateKv(query, setQuery, i, 'key', e.target.value)}
                  />
                  <input
                    placeholder="Value"
                    value={row.value}
                    onChange={(e) => updateKv(query, setQuery, i, 'value', e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setQuery(query.filter((_, j) => j !== i))}
                  >
                    删除
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" onClick={() => setQuery([...query, emptyKv()])}>
                + Query
              </button>
            </>
          )}

          {bodyTab === 'body' && (
            <>
              <label>
                Body 类型
                <select
                  value={bodyType}
                  onChange={(e) => setBodyType(e.target.value as ApiBodyType)}
                >
                  {BODY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              {bodyType !== 'none' && (
                <label>
                  Body 内容
                  <textarea
                    className="code-area"
                    rows={8}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </label>
              )}
            </>
          )}
        </section>

        <section className="api-form-section">
          <h3>断言</h3>
          {assertions.map((a, i) => (
            <div key={`a-${i}`} className="assertion-row">
              <select
                value={a.type}
                onChange={(e) => {
                  const type = e.target.value as Assertion['type'];
                  if (type === 'status') updateAssertion(i, { type, op: 'eq', value: 200 });
                  else if (type === 'json')
                    updateAssertion(i, { type, path: 'data.id', op: 'exists' });
                  else if (type === 'header')
                    updateAssertion(i, { type, name: 'content-type', op: 'contains', value: 'json' });
                  else if (type === 'body')
                    updateAssertion(i, { type, op: 'contains', value: '' });
                  else updateAssertion(i, { type, op: 'lt', value: 3000 });
                }}
              >
                <option value="status">status</option>
                <option value="json">json</option>
                <option value="header">header</option>
                <option value="body">body</option>
                <option value="responseTime">responseTime</option>
              </select>

              {a.type === 'json' && (
                <input
                  placeholder="path e.g. data.id"
                  value={a.path}
                  onChange={(e) => updateAssertion(i, { path: e.target.value })}
                />
              )}
              {a.type === 'header' && (
                <input
                  placeholder="header name"
                  value={a.name}
                  onChange={(e) => updateAssertion(i, { name: e.target.value })}
                />
              )}

              <select
                value={a.op}
                onChange={(e) =>
                  updateAssertion(i, { op: e.target.value as Assertion['op'] })
                }
              >
                {a.type === 'status' && (
                  <>
                    <option value="eq">eq</option>
                    <option value="in">in</option>
                  </>
                )}
                {a.type === 'json' && (
                  <>
                    <option value="exists">exists</option>
                    <option value="eq">eq</option>
                    <option value="neq">neq</option>
                    <option value="contains">contains</option>
                    <option value="regex">regex</option>
                  </>
                )}
                {a.type === 'header' && (
                  <>
                    <option value="eq">eq</option>
                    <option value="contains">contains</option>
                  </>
                )}
                {a.type === 'body' && (
                  <>
                    <option value="contains">contains</option>
                    <option value="regex">regex</option>
                  </>
                )}
                {a.type === 'responseTime' && <option value="lt">lt</option>}
              </select>

              {a.type !== 'responseTime' && a.op !== 'exists' && (
                <input
                  placeholder="value"
                  value={String(a.value ?? '')}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (a.type === 'status' && a.op === 'in') {
                      updateAssertion(i, {
                        value: raw.split(',').map((v) => Number(v.trim())).filter(Boolean),
                      });
                    } else if (a.type === 'status') {
                      updateAssertion(i, { value: Number(raw) || 0 });
                    } else {
                      updateAssertion(i, { value: raw });
                    }
                  }}
                />
              )}
              {a.type === 'responseTime' && (
                <input
                  type="number"
                  value={a.value}
                  onChange={(e) => updateAssertion(i, { value: Number(e.target.value) })}
                />
              )}

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setAssertions(assertions.filter((_, j) => j !== i))}
              >
                删除
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setAssertions([...assertions, defaultAssertion()])}
          >
            + 断言
          </button>
        </section>

        <div className="btn-row">
          <button type="submit" className="btn primary" disabled={!apiAvailable || saving}>
            保存
          </button>
          <button
            type="button"
            className="btn"
            disabled={!apiAvailable || saving}
            onClick={() => void handleSave(true)}
          >
            保存并运行
          </button>
          <button
            type="button"
            className="btn"
            disabled={!apiAvailable || debugging}
            onClick={() => void handleDebug()}
          >
            {debugging ? '调试中…' : '仅调试'}
          </button>
        </div>
      </form>

      {debugResult && (
        <section className="response-preview">
          <h3>
            调试结果 —{' '}
            <span className={debugResult.status === 'passed' ? 'perf-good' : 'perf-bad'}>
              {debugResult.status}
            </span>{' '}
            ({debugResult.durationMs}ms)
          </h3>
          {debugResult.error && <p className="perf-bad">{debugResult.error}</p>}
          {debugResult.response && (
            <>
              <p>
                Status: <strong>{debugResult.response.status}</strong>
              </p>
              <pre>{debugResult.response.body.slice(0, 4000)}</pre>
            </>
          )}
          <ul>
            {debugResult.assertions.map((a) => (
              <li key={a.desc} className={a.passed ? 'perf-good' : 'perf-bad'}>
                {a.passed ? '✓' : '✗'} {a.desc}
                {a.message ? ` — ${a.message}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
