import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { aiGenerateCase, createCase, fetchCase, updateCase } from '../api';
import { AiStatusBanner } from '../components/AiStatusBanner';
import { ApiBanner } from '../components/ApiBanner';
import { useApiHealth } from '../hooks/useApiHealth';
import { useToast } from '../hooks/useToast';
import type { TestCase } from '../types';

const MODULES = ['auth', 'admin', 'smoke', 'mailbox', 'recorded'];

export function CaseForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id && id !== 'new');
  const navigate = useNavigate();
  const apiAvailable = useApiHealth();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [module, setModule] = useState('smoke');
  const [tagsStr, setTagsStr] = useState('@regression');
  const [stepsStr, setStepsStr] = useState('');
  const [expected, setExpected] = useState('');
  const [useAuth, setUseAuth] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loadingCase, setLoadingCase] = useState(isEdit);
  const [originalCase, setOriginalCase] = useState<TestCase | null>(null);

  useEffect(() => {
    if (!isEdit || !id) return;
    setLoadingCase(true);
    setError('');
    fetchCase(id)
      .then((c) => {
        if (!c) {
          setError('用例不存在或加载失败，请返回列表重试');
          return;
        }
        setOriginalCase(c);
        setTitle(c.title);
        setModule(c.module);
        setTagsStr(c.tags.join(' '));
        setStepsStr(c.steps.join('\n'));
        setExpected(c.expected);
        setUseAuth(c.useAuth);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoadingCase(false));
  }, [id, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiAvailable) return;
    setSaving(true);
    setError('');
    const body = {
      title,
      module,
      tags: tagsStr.split(/\s+/).filter(Boolean),
      steps: stepsStr.split('\n').filter(Boolean),
      expected,
      useAuth,
    };
    try {
      if (isEdit && id) {
        const shouldRegenerateSpec =
          originalCase?.module !== 'recorded' &&
          !originalCase?.specPath?.startsWith('tests/recorded/');
        await updateCase(id, { ...body, regenerateSpec: shouldRegenerateSpec });
        toast.showSuccess(
          shouldRegenerateSpec
            ? '用例已保存并更新 Spec'
            : '录制用例已保存，保留原始录制脚本',
        );
        navigate('/cases');
      } else {
        const created = await createCase(body);
        toast.showSuccess(`用例「${created.title}」创建成功`);
        navigate('/cases');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.showError(`保存失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setError('');
    try {
      const result = await aiGenerateCase({
        prompt: aiPrompt,
        module,
        useAuth,
      });
      setTitle(result.preview.title);
      setModule(result.preview.module);
      setTagsStr(result.preview.tags.join(' '));
      setStepsStr(result.preview.steps.join('\n'));
      setExpected(result.preview.expected);
      setUseAuth(result.preview.useAuth);
      setAiOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div>
      <p>
        <Link to="/cases">← 用例列表</Link>
      </p>
      <h2>{isEdit ? '编辑用例' : '新建用例'}</h2>
      <ApiBanner requireWrite />
      <AiStatusBanner />

      {!isEdit && apiAvailable && (
        <div className="card ai-inline-panel">
          <button
            type="button"
            className="btn btn-sm primary"
            onClick={() => setAiOpen((v) => !v)}
          >
            {aiOpen ? '收起 AI 生成' : 'AI 生成用例'}
          </button>
          {aiOpen && (
            <div className="ai-inline-form">
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="描述你想生成的测试场景…"
              />
              <button
                type="button"
                className="btn primary"
                disabled={aiLoading || !aiPrompt.trim()}
                onClick={handleAiGenerate}
              >
                {aiLoading ? '生成中…' : '生成并填充表单'}
              </button>
            </div>
          )}
        </div>
      )}

      {loadingCase && <p className="muted">加载用例中…</p>}

      <form className="card form" onSubmit={handleSubmit}>
        <label>
          标题
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={!apiAvailable || loadingCase}
          />
        </label>
        <label>
          模块
          <select
            value={module}
            onChange={(e) => setModule(e.target.value)}
            disabled={!apiAvailable || loadingCase}
          >
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          标签（空格分隔）
          <input
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            disabled={!apiAvailable || loadingCase}
          />
        </label>
        <label>
          步骤（每行一步）
          <textarea
            rows={6}
            value={stepsStr}
            onChange={(e) => setStepsStr(e.target.value)}
            disabled={!apiAvailable || loadingCase}
          />
        </label>
        <label>
          预期结果
          <textarea
            rows={3}
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            disabled={!apiAvailable || loadingCase}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={useAuth}
            onChange={(e) => setUseAuth(e.target.checked)}
            disabled={!apiAvailable || loadingCase}
          />
          使用已登录态（authenticatedTest）
        </label>
        {error && <p className="error-text">{error}</p>}
        <button
          type="submit"
          className="btn primary"
          disabled={!apiAvailable || saving || loadingCase}
        >
          {saving ? '保存中…' : '保存并生成 Spec'}
        </button>
      </form>
    </div>
  );
}
