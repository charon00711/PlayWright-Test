import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { aiAnalyzeBug, fetchRunDetail } from '../api';
import { AiStatusBanner } from '../components/AiStatusBanner';
import { useApiHealth } from '../hooks/useApiHealth';
import type { AiBugAnalysisResult, BusinessReport, RunDetail, RunTest } from '../types';

function TestRow({
  test,
  onAnalyze,
  analyzing,
}: {
  test: RunTest;
  onAnalyze: (title: string) => void;
  analyzing: boolean;
}) {
  const badge =
    test.status === 'passed'
      ? 'pass'
      : test.status === 'failed'
        ? 'fail'
        : 'skip';
  const apiAvailable = useApiHealth();

  return (
    <tr>
      <td>
        <span className={`badge ${badge}`}>{test.status}</span>
      </td>
      <td>{test.title}</td>
      <td>
        <code style={{ fontSize: '0.75rem' }}>{test.file}</code>
      </td>
      <td>{(test.durationMs / 1000).toFixed(2)}s</td>
      <td className="actions-cell">
        {test.screenshotPublic && (
          <a href={test.screenshotPublic} target="_blank" rel="noreferrer">
            截图
          </a>
        )}
        {test.status === 'failed' && apiAvailable && (
          <>
            {test.screenshotPublic && ' · '}
            <button
              type="button"
              className="link-btn"
              disabled={analyzing}
              onClick={() => onAnalyze(test.title)}
            >
              AI 分析
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

function BusinessBlock({ report }: { report: BusinessReport }) {
  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <h4>
        {report.caseName}{' '}
        <span className={`badge ${report.status === '通过' ? 'pass' : 'fail'}`}>
          {report.status}
        </span>
      </h4>
      <ol className="steps">
        {report.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <p>
        <strong>预期：</strong>
        {report.expected}
      </p>
      <p>
        <strong>实际：</strong>
        {report.actual}
      </p>
    </div>
  );
}

export function ReportsRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const apiAvailable = useApiHealth();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AiBugAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState('');

  useEffect(() => {
    if (!runId) return;
    fetchRunDetail(runId)
      .then(setRun)
      .finally(() => setLoading(false));
  }, [runId]);

  async function handleAnalyze(testTitle?: string) {
    if (!runId) return;
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const result = await aiAnalyzeBug({ runId, testTitle });
      setAnalysis(result);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) return <p>加载中…</p>;
  if (!run) return <p>未找到运行记录 {runId}</p>;

  const hasFailures = run.failed > 0;

  return (
    <div>
      <p>
        <Link to="/reports">← 测试报告</Link>
      </p>
      <h2>执行详情 · {run.id}</h2>
      <AiStatusBanner />

      <div className="stats">
        <div className="stat">
          <div className="label">环境</div>
          <div className="value" style={{ fontSize: '1rem' }}>
            {run.env}
          </div>
        </div>
        <div className="stat">
          <div className="label">通过 / 失败</div>
          <div className="value">
            {run.passed} / {run.failed}
          </div>
        </div>
        <div className="stat">
          <div className="label">总耗时</div>
          <div className="value">{(run.durationMs / 1000).toFixed(1)}s</div>
        </div>
      </div>

      {hasFailures && apiAvailable && (
        <div className="card">
          <div className="card-header-row">
            <h3 style={{ margin: 0 }}>AI Bug 分析</h3>
            <div className="btn-row" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="btn btn-sm primary"
                disabled={analyzing}
                onClick={() => handleAnalyze()}
              >
                {analyzing ? '分析中…' : '分析本次失败'}
              </button>
              <Link className="btn btn-sm" to={`/ai?tab=analyze&runId=${run.id}`}>
                在 AI 中心查看
              </Link>
            </div>
          </div>
          {analysisError && <p className="error-text">{analysisError}</p>}
          {analysis && (
            <div className="ai-result">
              <p>
                <strong>{analysis.summary}</strong>
              </p>
              <div className="ai-markdown">
                <pre>{analysis.markdown}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <p>
          <strong>Base URL：</strong>
          {run.baseURL}
        </p>
        <p>
          <a
            href={`/${run.playwrightReport}`}
            target="_blank"
            rel="noreferrer"
          >
            打开 Playwright HTML 报告 →
          </a>
        </p>
      </div>

      <div className="card">
        <h3>用例列表</h3>
        <table>
          <thead>
            <tr>
              <th>状态</th>
              <th>用例</th>
              <th>文件</th>
              <th>耗时</th>
              <th>附件 / AI</th>
            </tr>
          </thead>
          <tbody>
            {run.tests.map((t, i) => (
              <TestRow
                key={i}
                test={t}
                onAnalyze={handleAnalyze}
                analyzing={analyzing}
              />
            ))}
          </tbody>
        </table>

        {run.tests
          .filter((t) => t.screenshotPublic)
          .map((t, i) => (
            <div key={i} style={{ marginTop: '1rem' }}>
              <strong>{t.title}</strong>
              <img
                className="screenshot"
                src={t.screenshotPublic}
                alt={t.title}
              />
            </div>
          ))}
      </div>

      {run.businessReports && run.businessReports.length > 0 && (
        <div>
          <h3>业务报告</h3>
          {run.businessReports.map((r, i) => (
            <BusinessBlock key={i} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}
