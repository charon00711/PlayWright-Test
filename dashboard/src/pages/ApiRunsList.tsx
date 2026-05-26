import { useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { fetchApiRuns } from '../api';
import type { ApiRunResult, ApiRunSummary } from '../types';

const staticBase = import.meta.env.BASE_URL;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN');
}

async function fetchApiRunDetail(id: string): Promise<ApiRunResult | null> {
  try {
    const res = await fetch(`/api/api-cases/runs/${id}`);
    if (res.ok) return res.json();
  } catch {
    /* fallback */
  }
  const res = await fetch(`${staticBase}api-runs/${id}.json`);
  if (!res.ok) return null;
  return res.json();
}

export function ApiRunsList() {
  const [runs, setRuns] = useState<ApiRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ApiRunResult>>({});

  useEffect(() => {
    fetchApiRuns()
      .then((d) => setRuns(d.runs))
      .finally(() => setLoading(false));
  }, []);

  async function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!details[id]) {
      const detail = await fetchApiRunDetail(id);
      if (detail) {
        setDetails((prev) => ({ ...prev, [id]: detail }));
      }
    }
  }

  return (
    <div className="page api-runs-page">
      <p>
        <Link to="/api-cases">← 接口用例列表</Link>
      </p>
      <h2>接口运行历史</h2>

      {loading ? (
        <p>加载中…</p>
      ) : runs.length === 0 ? (
        <p className="muted">暂无运行记录。</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>开始时间</th>
                <th>总数</th>
                <th>通过</th>
                <th>失败</th>
                <th>错误</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <Fragment key={run.id}>
                  <tr>
                    <td className="mono">{run.id}</td>
                    <td>{formatTime(run.startedAt)}</td>
                    <td>{run.summary.total}</td>
                    <td className="perf-good">{run.summary.passed}</td>
                    <td className="perf-bad">{run.summary.failed}</td>
                    <td className="perf-warn">{run.summary.error}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => void toggleExpand(run.id)}
                      >
                        {expanded === run.id ? '收起' : '详情'}
                      </button>
                    </td>
                  </tr>
                  {expanded === run.id && details[run.id] && (
                    <tr key={`${run.id}-detail`}>
                      <td colSpan={7}>
                        <div className="response-preview">
                          {details[run.id].results.map((r) => (
                            <div key={r.caseId} className="api-run-detail-item">
                              <h4>
                                {r.name}{' '}
                                <span className={r.status === 'passed' ? 'perf-good' : 'perf-bad'}>
                                  {r.status}
                                </span>{' '}
                                ({r.durationMs}ms)
                              </h4>
                              {r.error && <p className="perf-bad">{r.error}</p>}
                              {r.response && (
                                <p>
                                  HTTP {r.response.status} — {r.request.method} {r.request.url}
                                </p>
                              )}
                              <ul>
                                {r.assertions.map((a) => (
                                  <li
                                    key={a.desc}
                                    className={a.passed ? 'perf-good' : 'perf-bad'}
                                  >
                                    {a.passed ? '✓' : '✗'} {a.desc}
                                    {a.message ? ` — ${a.message}` : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
