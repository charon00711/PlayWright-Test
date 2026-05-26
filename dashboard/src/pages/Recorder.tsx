import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchConfig,
  fetchRecordStatus,
  registerRecordedCase,
  startRecord,
  stopRecord,
} from '../api';
import { ApiBanner } from '../components/ApiBanner';
import { useApiHealth } from '../hooks/useApiHealth';

// Built-in BASE_URL injected at build time (Cloudflare/GitHub Pages); fallback to dev API
const BUILD_BASE_URL = import.meta.env.VITE_BASE_URL ?? '';

export function Recorder() {
  const navigate = useNavigate();
  const apiAvailable = useApiHealth();
  const [baseURL, setBaseURL] = useState(BUILD_BASE_URL);
  const [status, setStatus] = useState({
    running: false,
    output: '',
    outputFile: null as string | null,
  });
  const [title, setTitle] = useState('录制用例');

  useEffect(() => {
    // Override with live API config when running platform:dev
    fetchConfig().then((c) => {
      if (c?.BASE_URL) setBaseURL(c.BASE_URL);
    });
  }, []);

  useEffect(() => {
    if (!apiAvailable) return;
    const t = setInterval(() => {
      fetchRecordStatus().then(setStatus);
    }, 1500);
    return () => clearInterval(t);
  }, [apiAvailable]);

  async function handleStart() {
    await startRecord();
    const s = await fetchRecordStatus();
    setStatus(s);
  }

  async function handleStop() {
    const r = await stopRecord();
    setStatus((prev) => ({
      ...prev,
      running: false,
      outputFile: r.outputFile,
    }));
  }

  async function handleRegister() {
    if (!status.outputFile) return;
    await registerRecordedCase({
      title,
      outputFile: status.outputFile,
    });
    navigate('/cases');
  }

  return (
    <div>
      <h2>录制测试</h2>
      <ApiBanner requireWrite />

      <div className="card">
        <p>
          <strong>测试目标：</strong>
          {baseURL ? (
            <a className="env-var" href={baseURL} target="_blank" rel="noreferrer">
              {baseURL}
            </a>
          ) : (
            <code className="env-var">未配置</code>
          )}
        </p>
        <p className="muted">
          来源：本地 <code>.env</code> 中的 BASE_URL，或 CI 构建时注入的 VITE_BASE_URL。
          将启动 Playwright Codegen 并弹出浏览器窗口，请在浏览器中操作后关闭或点击停止。
        </p>

        <div className="btn-row">
          <button
            type="button"
            className="btn primary"
            disabled={!apiAvailable || status.running}
            onClick={handleStart}
          >
            开始录制
          </button>
          <button
            type="button"
            className="btn"
            disabled={!apiAvailable || !status.running}
            onClick={handleStop}
          >
            停止录制
          </button>
        </div>

        {status.running && (
          <p className="badge pass">录制中…</p>
        )}

        {status.outputFile && !status.running && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <p>
              <strong>生成文件：</strong>
              <code>{status.outputFile}</code>
            </p>
            <label>
              用例标题
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn primary"
              disabled={!apiAvailable}
              onClick={handleRegister}
            >
              登记为用例
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h3>输出日志</h3>
        <pre className="log-panel">{status.output || '（无输出）'}</pre>
      </div>

      <p>
        <Link to="/">返回仪表盘</Link>
      </p>
    </div>
  );
}
