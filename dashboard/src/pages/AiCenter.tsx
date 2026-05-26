import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  aiAnalyzeBug,
  aiApplyFix,
  aiFixCase,
  aiGenerateCase,
  fetchCases,
  fetchRunIndex,
} from '../api';
import { AiStatusBanner } from '../components/AiStatusBanner';
import { ApiBanner } from '../components/ApiBanner';
import { useApiHealth } from '../hooks/useApiHealth';
import type {
  AiBugAnalysisResult,
  AiFixCaseResult,
  AiGenerateCaseResult,
  RunSummary,
  TestCase,
} from '../types';

type AiTab = 'generate' | 'fix' | 'analyze';

const MODULES = ['auth', 'admin', 'smoke', 'mailbox', 'recorded'];
const TABS: { id: AiTab; label: string }[] = [
  { id: 'generate', label: '生成用例' },
  { id: 'fix', label: '自动修复' },
  { id: 'analyze', label: 'Bug 分析' },
];

export function AiCenter() {
  const apiAvailable = useApiHealth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<AiTab>(
    (searchParams.get('tab') as AiTab) || 'generate',
  );
  const [cases, setCases] = useState<TestCase[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Generate
  const [prompt, setPrompt] = useState('');
  const [genModule, setGenModule] = useState('smoke');
  const [genUseAuth, setGenUseAuth] = useState(true);
  const [genResult, setGenResult] = useState<AiGenerateCaseResult | null>(null);

  // Fix
  const [fixCaseId, setFixCaseId] = useState(searchParams.get('caseId') || '');
  const [fixRunId, setFixRunId] = useState('');
  const [fixHint, setFixHint] = useState('');
  const [fixResult, setFixResult] = useState<AiFixCaseResult | null>(null);

  // Analyze
  const [analyzeRunId, setAnalyzeRunId] = useState('');
  const [analyzeTestTitle, setAnalyzeTestTitle] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState<AiBugAnalysisResult | null>(null);

  useEffect(() => {
    fetchCases().then((d) => setCases(d.cases));
    fetchRunIndex().then((d) => setRuns(d.runs));
  }, []);

  useEffect(() => {
    const t = searchParams.get('tab') as AiTab;
    if (t) setTab(t);
    const cid = searchParams.get('caseId');
    if (cid) setFixCaseId(cid);
    const rid = searchParams.get('runId');
    if (rid) setAnalyzeRunId(rid);
  }, [searchParams]);

  async function handleGenerate(confirm = false) {
    setLoading(true);
    setError('');
    try {
      const result = await aiGenerateCase({
        prompt,
        module: genModule,
        useAuth: genUseAuth,
        confirm,
      });
      if (confirm && result.case) {
        navigate('/cases');
        return;
      }
      setGenResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleFix() {
    if (!fixCaseId) {
      setError('请选择用例');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await aiFixCase({
        caseId: fixCaseId,
        runId: fixRunId || undefined,
        errorHint: fixHint || undefined,
      });
      setFixResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyFix() {
    if (!fixResult) return;
    setLoading(true);
    setError('');
    try {
      await aiApplyFix({
        caseId: fixResult.caseId,
        specPatch: fixResult.specPatch,
        suggestedSteps: fixResult.suggestedSteps,
      });
      navigate('/cases');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!analyzeRunId) {
      setError('请选择运行记录');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await aiAnalyzeBug({
        runId: analyzeRunId,
        testTitle: analyzeTestTitle || undefined,
      });
      setAnalyzeResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function copyMarkdown() {
    if (analyzeResult?.markdown) {
      navigator.clipboard.writeText(analyzeResult.markdown);
    }
  }

  const failedRuns = runs.filter((r) => r.failed > 0);

  return (
    <div>
      <h2>AI 中心</h2>
      <ApiBanner />
      <AiStatusBanner />

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
      </div>

      {error && <p className="error-text">{error}</p>}

      {tab === 'generate' && (
        <div className="card form">
          <label>
            用例需求描述
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：错误密码登录应显示错误提示，且停留在登录页"
              disabled={!apiAvailable}
            />
          </label>
          <div className="ai-form-row">
            <label>
              模块
              <select
                value={genModule}
                onChange={(e) => setGenModule(e.target.value)}
                disabled={!apiAvailable}
              >
                {MODULES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={genUseAuth}
                onChange={(e) => setGenUseAuth(e.target.checked)}
                disabled={!apiAvailable}
              />
              使用已登录态
            </label>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn primary"
              disabled={!apiAvailable || loading || !prompt.trim()}
              onClick={() => handleGenerate(false)}
            >
              {loading ? '生成中…' : 'AI 生成预览'}
            </button>
          </div>

          {genResult && (
            <div className="ai-result">
              <p className="muted">{genResult.explanation}</p>
              <h4>{genResult.preview.title}</h4>
              <p>
                <strong>模块：</strong>
                {genResult.preview.module} · <strong>标签：</strong>
                {genResult.preview.tags.join(' ')}
              </p>
              <ol className="steps">
                {genResult.preview.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <p>
                <strong>预期：</strong>
                {genResult.preview.expected}
              </p>
              <details>
                <summary>Spec 预览</summary>
                <pre className="code-block">{genResult.specCode}</pre>
              </details>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn primary"
                  disabled={loading}
                  onClick={() => handleGenerate(true)}
                >
                  保存为用例
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'fix' && (
        <div className="card form">
          <label>
            选择用例
            <select
              value={fixCaseId}
              onChange={(e) => setFixCaseId(e.target.value)}
              disabled={!apiAvailable}
            >
              <option value="">请选择</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.specPath})
                </option>
              ))}
            </select>
          </label>
          <label>
            关联失败 Run（可选）
            <select
              value={fixRunId}
              onChange={(e) => setFixRunId(e.target.value)}
              disabled={!apiAvailable}
            >
              <option value="">无</option>
              {failedRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} · 失败 {r.failed}
                </option>
              ))}
            </select>
          </label>
          <label>
            额外提示（可选）
            <input
              value={fixHint}
              onChange={(e) => setFixHint(e.target.value)}
              placeholder="例如：selector 可能已变更"
              disabled={!apiAvailable}
            />
          </label>
          <div className="btn-row">
            <button
              type="button"
              className="btn primary"
              disabled={!apiAvailable || loading || !fixCaseId}
              onClick={handleFix}
            >
              {loading ? '分析中…' : 'AI 修复'}
            </button>
          </div>

          {fixResult && (
            <div className="ai-result">
              <p>
                <span className={`badge ${fixResult.confidence === 'high' ? 'pass' : 'skip'}`}>
                  置信度: {fixResult.confidence}
                </span>
              </p>
              <h4>诊断</h4>
              <p>{fixResult.diagnosis}</p>
              <h4>建议步骤</h4>
              <ol className="steps">
                {fixResult.suggestedSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <details open>
                <summary>修复后 Spec</summary>
                <pre className="code-block">{fixResult.specPatch}</pre>
              </details>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn primary"
                  disabled={loading}
                  onClick={handleApplyFix}
                >
                  应用修复
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'analyze' && (
        <div className="card form">
          <label>
            运行记录
            <select
              value={analyzeRunId}
              onChange={(e) => setAnalyzeRunId(e.target.value)}
              disabled={!apiAvailable}
            >
              <option value="">请选择</option>
              {failedRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} · 失败 {r.failed} · {new Date(r.startedAt).toLocaleString('zh-CN')}
                </option>
              ))}
            </select>
          </label>
          <label>
            指定失败用例（可选，留空分析全部失败）
            <input
              value={analyzeTestTitle}
              onChange={(e) => setAnalyzeTestTitle(e.target.value)}
              placeholder="用例标题关键字"
              disabled={!apiAvailable}
            />
          </label>
          <div className="btn-row">
            <button
              type="button"
              className="btn primary"
              disabled={!apiAvailable || loading || !analyzeRunId}
              onClick={handleAnalyze}
            >
              {loading ? '分析中…' : 'AI Bug 分析'}
            </button>
          </div>

          {analyzeResult && (
            <div className="ai-result">
              <div className="card-header-row">
                <h4 style={{ margin: 0 }}>{analyzeResult.summary}</h4>
                <button type="button" className="btn btn-sm" onClick={copyMarkdown}>
                  复制 Markdown
                </button>
              </div>
              <div className="ai-markdown">
                <pre>{analyzeResult.markdown}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
