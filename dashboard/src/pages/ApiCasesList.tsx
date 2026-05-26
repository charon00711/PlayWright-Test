import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  deleteApiCase,
  fetchApiCases,
  runApiCase,
  runApiCasesBatch,
} from '../api';
import { ApiBanner } from '../components/ApiBanner';
import { IconPlay } from '../components/NavIcons';
import { useApiHealth } from '../hooks/useApiHealth';
import type { ApiCase } from '../types';

export function ApiCasesList() {
  const navigate = useNavigate();
  const apiAvailable = useApiHealth();
  const [cases, setCases] = useState<ApiCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lastRunId, setLastRunId] = useState<string | null>(null);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!apiAvailable) return;
    if (!confirm(`确定删除接口用例「${name}」？`)) return;
    try {
      await deleteApiCase(id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="page api-cases-page">
      <div className="page-header">
        <div>
          <h2>接口用例</h2>
          <p className="muted">单接口自动化：配置请求与断言，支持批量回归</p>
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <Link to="/api-cases/new" className="btn primary">
            新建接口用例
          </Link>
          <Link to="/api-cases/runs" className="btn">
            运行历史
          </Link>
        </div>
      </div>

      <ApiBanner requireWrite />

      {error && <div className="alert alert-error">{error}</div>}
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
        <p className="muted">暂无接口用例，点击「新建接口用例」开始。</p>
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
