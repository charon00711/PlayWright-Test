import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { importMarkdown } from '../api';
import { ApiBanner } from '../components/ApiBanner';
import { useApiHealth } from '../hooks/useApiHealth';
import { parseMarkdownCase } from '../lib/markdown-case-parser';
import type { ParsedCasePreview, ParsedReportPreview } from '../types';

const SAMPLE = `# 用例标题
**模块:** admin
**标签:** @smoke @regression

## 步骤
1. 打开登录页
2. 输入用户名和密码
3. 点击登录

## 预期
登录成功，进入首页
`;

export function ImportMarkdown() {
  const navigate = useNavigate();
  const apiAvailable = useApiHealth();
  const [markdown, setMarkdown] = useState(SAMPLE);
  const [mode, setMode] = useState<'case' | 'report'>('case');
  const [preview, setPreview] = useState<
    ParsedCasePreview | ParsedReportPreview | null
  >(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  function handlePreview() {
    const p = parseMarkdownCase(markdown, mode);
    setPreview(p);
    setMessage('');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMarkdown(String(reader.result));
    };
    reader.readAsText(file);
  }

  async function handleConfirm() {
    if (!apiAvailable) return;
    setImporting(true);
    setMessage('');
    try {
      const res = await importMarkdown(markdown, mode, true);
      if (res.case) {
        setMessage(`已导入用例：${res.case.title}`);
        setTimeout(() => navigate('/cases'), 800);
      } else {
        setMessage('报告已归档到 reports/ 目录');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <p>
        <Link to="/cases">← 用例列表</Link>
      </p>
      <h2>Markdown 导入</h2>
      <ApiBanner requireWrite />

      <div className="card">
        <div className="filter-bar">
          <button
            type="button"
            className={mode === 'case' ? 'active' : ''}
            onClick={() => setMode('case')}
          >
            导入为用例
          </button>
          <button
            type="button"
            className={mode === 'report' ? 'active' : ''}
            onClick={() => setMode('report')}
          >
            归档为报告
          </button>
        </div>

        <label>
          上传 .md 文件
          <input type="file" accept=".md,text/markdown" onChange={handleFile} />
        </label>

        <label>
          Markdown 内容
          <textarea
            className="code-area"
            rows={14}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
          />
        </label>

        <div className="btn-row">
          <button type="button" className="btn" onClick={handlePreview}>
            预览解析
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!apiAvailable || importing}
            onClick={handleConfirm}
          >
            {importing ? '导入中…' : '确认导入'}
          </button>
        </div>
        {message && <p className="success-text">{message}</p>}
      </div>

      {preview && (
        <div className="card">
          <h3>解析预览</h3>
          <pre>{JSON.stringify(preview, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
