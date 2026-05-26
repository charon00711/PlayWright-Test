import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBusinessReports, fetchRunIndex } from '../api';
import type { BusinessReport, RunSummary } from '../types';

type Tab = 'runs' | 'business';
type Filter = 'all' | 'pass' | 'fail';

export function Reports() {
  const [tab, setTab] = useState<Tab>('runs');
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [business, setBusiness] = useState<BusinessReport[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchRunIndex(), fetchBusinessReports()])
      .then(([idx, biz]) => {
        setRuns(idx.runs);
        setBusiness(biz.reports);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = runs.filter((r) => {
    if (filter === 'pass') return r.failed === 0;
    if (filter === 'fail') return r.failed > 0;
    return true;
  });

  if (loading) return <p>加载中…</p>;

  return (
    <div>
      <h2>测试报告</h2>

      <div className="tabs">
        <button
          type="button"
          className={tab === 'runs' ? 'active' : ''}
          onClick={() => setTab('runs')}
        >
          执行报告
        </button>
        <button
          type="button"
          className={tab === 'business' ? 'active' : ''}
          onClick={() => setTab('business')}
        >
          业务报告
        </button>
      </div>

      {tab === 'runs' && (
        <>
          <div className="filter-bar">
            <button
              type="button"
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              全部
            </button>
            <button
              type="button"
              className={filter === 'pass' ? 'active' : ''}
              onClick={() => setFilter('pass')}
            >
              通过
            </button>
            <button
              type="button"
              className={filter === 'fail' ? 'active' : ''}
              onClick={() => setFilter('fail')}
            >
              失败
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="card empty">暂无执行报告</div>
          ) : (
            <div className="card">
              <table>
                <thead>
                  <tr>
                    <th>运行 ID</th>
                    <th>环境</th>
                    <th>时间</th>
                    <th>结果</th>
                    <th>耗时</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((run) => {
                    const total = run.passed + run.failed + (run.skipped ?? 0);
                    return (
                      <tr key={run.id}>
                        <td>
                          <code>{run.id}</code>
                        </td>
                        <td>{run.env}</td>
                        <td>
                          {new Date(run.startedAt).toLocaleString('zh-CN')}
                        </td>
                        <td>
                          <span
                            className={
                              run.failed ? 'badge fail' : 'badge pass'
                            }
                          >
                            {run.passed}/{total}
                          </span>
                        </td>
                        <td>{(run.durationMs / 1000).toFixed(1)}s</td>
                        <td>
                          <Link to={`/reports/runs/${run.id}`}>详情</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'business' && (
        <div className="report-cards">
          {business.length === 0 ? (
            <div className="card empty">暂无业务 Markdown 报告</div>
          ) : (
            business.map((r, i) => (
              <div key={i} className="card">
                <h4>
                  {r.caseName}{' '}
                  <span
                    className={`badge ${r.status === '通过' ? 'pass' : 'fail'}`}
                  >
                    {r.status}
                  </span>
                </h4>
                <p className="muted">
                  {r.executedAt}
                  {r.runId && (
                    <>
                      {' '}
                      · <Link to={`/reports/runs/${r.runId}`}>{r.runId}</Link>
                    </>
                  )}
                </p>
                <ol className="steps">
                  {r.steps.map((s, j) => (
                    <li key={j}>{s}</li>
                  ))}
                </ol>
                <p>
                  <strong>预期：</strong>
                  {r.expected}
                </p>
                <p>
                  <strong>实际：</strong>
                  {r.actual}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
