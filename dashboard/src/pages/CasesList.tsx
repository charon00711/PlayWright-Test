import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  deleteCase,
  fetchCaseRunMap,
  fetchCases,
  fetchRunJobStatus,
  startRun,
} from '../api';
import { ApiBanner } from '../components/ApiBanner';
import { IconPlay } from '../components/NavIcons';
import { useApiHealth } from '../hooks/useApiHealth';
import { useToast } from '../hooks/useToast';
import type { CaseRunMap, RunStatus, TestCase } from '../types';

const POLL_MS_RUNNING = 500;

export function CasesList() {
  const navigate = useNavigate();
  const toast = useToast();
  const apiAvailable = useApiHealth();
  const [cases, setCases] = useState<TestCase[]>([]);
  const [caseRunMap, setCaseRunMap] = useState<CaseRunMap>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningSpec, setRunningSpec] = useState<string | null>(null);
  const [logOutput, setLogOutput] = useState('');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [logExpanded, setLogExpanded] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalToastShownRef = useRef(false);
  const logRef = useRef<HTMLPreElement>(null);

  async function reload() {
    const [casesData, runMap] = await Promise.all([
      fetchCases(),
      fetchCaseRunMap(),
    ]);
    setCases(casesData.cases);
    setCaseRunMap(runMap);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (logRef.current && logExpanded) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logOutput, logExpanded]);

  function refreshRunMapForSpec(specPath: string, runId: string, st: RunStatus) {
    setCaseRunMap((prev) => ({
      ...prev,
      [specPath]: {
        runId,
        passed: st.exitCode === 0 ? 1 : 0,
        failed: st.exitCode === 0 ? 0 : 1,
        skipped: 0,
        startedAt: new Date().toISOString(),
      },
    }));
  }

  function startPolling(specPath: string | null) {
    if (pollRef.current) clearInterval(pollRef.current);
    finalToastShownRef.current = false;
    const poll = async () => {
      const st = await fetchRunJobStatus();
      setLogOutput(st.output);
      if (st.lastRunId) setLastRunId(st.lastRunId);
      if (!st.running) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setRunning(false);
        setRunningSpec(null);
        setExitCode(st.exitCode);
        await reload();
        if (st.lastRunId && specPath) {
          refreshRunMapForSpec(specPath, st.lastRunId, st);
        }
        if (!finalToastShownRef.current) {
          finalToastShownRef.current = true;
          if (st.exitCode === 0) {
            toast.showSuccess(
              st.lastRunId
                ? `测试通过。报告 ID: ${st.lastRunId}`
                : '测试通过',
            );
          } else {
            toast.showError(
              st.lastRunId
                ? `测试失败（退出码 ${st.exitCode ?? 1}）。报告 ID: ${st.lastRunId}`
                : `测试失败，退出码 ${st.exitCode ?? 1}`,
            );
          }
        }
      }
    };
    void poll();
    pollRef.current = setInterval(poll, POLL_MS_RUNNING);
  }

  async function handleRunAll() {
    if (!apiAvailable || running) return;
    const specPaths = cases.map((c) => c.specPath);
    if (specPaths.length === 0) return;
    setRunning(true);
    setRunningSpec(null);
    setLogOutput('');
    setExitCode(null);
    setLastRunId(null);
    setLogExpanded(true);
    try {
      await startRun({ specPaths });
      startPolling(null);
    } catch (e) {
      setRunning(false);
      const msg = e instanceof Error ? e.message : String(e);
      setLogOutput(msg);
      toast.showError(`启动失败：${msg}`);
    }
  }

  async function handleRunOne(specPath: string) {
    if (!apiAvailable || running) return;
    setRunning(true);
    setRunningSpec(specPath);
    setLogOutput('');
    setExitCode(null);
    setLastRunId(null);
    setLogExpanded(true);
    try {
      await startRun({ specPath });
      startPolling(specPath);
    } catch (e) {
      setRunning(false);
      setRunningSpec(null);
      const msg = e instanceof Error ? e.message : String(e);
      setLogOutput(msg);
      toast.showError(`启动失败：${msg}`);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`确定删除用例「${title}」及 spec 文件？`)) return;
    try {
      await deleteCase(id);
      toast.showSuccess(`已删除用例：${title}`);
      await reload();
    } catch (e) {
      toast.showError(
        `删除失败：${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  if (loading) return <p>加载中…</p>;

  return (
    <div>
      <div className="page-header">
        <h2>用例管理</h2>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn"
            disabled={!apiAvailable || running || cases.length === 0}
            onClick={() => void handleRunAll()}
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
                const runInfo = caseRunMap[c.specPath];
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
                          onClick={() => void handleRunOne(c.specPath)}
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
                      {runInfo ? (
                        <Link
                          to={`/reports/runs/${runInfo.runId}`}
                          className="btn btn-sm"
                          title={`最近运行：${runInfo.passed} 通过 / ${runInfo.failed} 失败`}
                        >
                          报告
                        </Link>
                      ) : (
                        <span
                          className="btn btn-sm muted-btn"
                          title="该用例暂无运行记录"
                        >
                          报告
                        </span>
                      )}
                      <Link to={`/cases/${encodeURIComponent(c.id)}/edit`}>
                        编辑
                      </Link>
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
                            onClick={() => void handleDelete(c.id, c.title)}
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
            {!running && lastRunId && (
              <Link
                to={`/reports/runs/${lastRunId}`}
                className="log-report-link"
                onClick={(e) => e.stopPropagation()}
              >
                查看测试报告 →
              </Link>
            )}
          </button>
          {logExpanded && (
            <pre ref={logRef} className="log-panel log-panel-tall">
              {logOutput || '等待输出…'}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
