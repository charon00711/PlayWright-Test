import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteCase, fetchCases, fetchRunJobStatus, startRun } from '../api';
import { ApiBanner } from '../components/ApiBanner';
import { IconPlay } from '../components/NavIcons';
import { useApiHealth } from '../hooks/useApiHealth';
import type { TestCase } from '../types';

export function CasesList() {
  const navigate = useNavigate();
  const apiAvailable = useApiHealth();
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningSpec, setRunningSpec] = useState<string | null>(null);
  const [logOutput, setLogOutput] = useState('');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [logExpanded, setLogExpanded] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function reload() {
    fetchCases()
      .then((c) => setCases(c.cases))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const st = await fetchRunJobStatus();
      setLogOutput(st.output);
      if (!st.running) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setRunning(false);
        setRunningSpec(null);
        setExitCode(st.exitCode);
      }
    }, 1500);
  }

  async function handleRunAll() {
    if (!apiAvailable || running) return;
    setRunning(true);
    setRunningSpec(null);
    setLogOutput('');
    setExitCode(null);
    setLogExpanded(true);
    try {
      await startRun({ all: true });
      startPolling();
    } catch (e) {
      setRunning(false);
      setLogOutput(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRunOne(specPath: string) {
    if (!apiAvailable || running) return;
    setRunning(true);
    setRunningSpec(specPath);
    setLogOutput('');
    setExitCode(null);
    setLogExpanded(true);
    try {
      await startRun({ specPath });
      startPolling();
    } catch (e) {
      setRunning(false);
      setRunningSpec(null);
      setLogOutput(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除该用例及 spec 文件？')) return;
    await deleteCase(id);
    reload();
  }

  if (loading) return <p>加载中…</p>;

  return (
    <div>
      <div className="page-header">
        <h2>测试用例</h2>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn"
            disabled={!apiAvailable || running || cases.length === 0}
            onClick={handleRunAll}
          >
            {running && !runningSpec ? (
              <span className="btn-with-icon">
                <span className="spinner" /> 执行中…
              </span>
            ) : (
              <span className="btn-with-icon">
                <IconPlay /> 执行全部
              </span>
            )}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!apiAvailable}
            onClick={() => navigate('/cases/new')}
          >
            新建用例
          </button>
        </div>
      </div>
      <ApiBanner requireWrite />

      {cases.length === 0 ? (
        <div className="card empty">暂无用例，请新建或 Markdown 导入</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>标题</th>
                <th>模块</th>
                <th>标签</th>
                <th>Spec 路径</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const isRunningThis = running && runningSpec === c.specPath;
                return (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td>{c.module}</td>
                    <td>
                      {c.tags.map((t) => (
                        <span key={t} className="tag-chip">
                          {t}
                        </span>
                      ))}
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem' }}>{c.specPath}</code>
                    </td>
                    <td className="actions-cell">
                      {apiAvailable && (
                        <button
                          type="button"
                          className="btn btn-sm btn-run"
                          disabled={running}
                          onClick={() => handleRunOne(c.specPath)}
                          title="执行此用例"
                        >
                          {isRunningThis ? (
                            <span className="spinner" />
                          ) : (
                            <IconPlay />
                          )}
                          执行
                        </button>
                      )}
                      <Link to={`/cases/${c.id}/edit`}>编辑</Link>
                      {apiAvailable && (
                        <>
                          {' · '}
                          <Link to={`/ai?tab=fix&caseId=${c.id}`}>AI 修复</Link>
                        </>
                      )}
                      {apiAvailable && (
                        <>
                          {' · '}
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => handleDelete(c.id)}
                          >
                            删除
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(running || logOutput) && (
        <div className="card run-log-panel">
          <button
            type="button"
            className="log-panel-toggle"
            onClick={() => setLogExpanded((v) => !v)}
          >
            运行日志 {logExpanded ? '▾' : '▸'}
            {running && <span className="badge pass">运行中</span>}
            {!running && exitCode !== null && (
              <span className={`badge ${exitCode === 0 ? 'pass' : 'fail'}`}>
                退出码 {exitCode}
              </span>
            )}
          </button>
          {logExpanded && (
            <pre className="log-panel">{logOutput || '等待输出…'}</pre>
          )}
        </div>
      )}
    </div>
  );
}
