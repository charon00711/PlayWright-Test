import { useEffect, useState } from 'react';
import { fetchAiStatus } from '../api';
import type { AiStatus } from '../types';

export function AiStatusBanner() {
  const [status, setStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    fetchAiStatus().then(setStatus);
  }, []);

  if (!status) return null;

  if (status.configured) {
    return (
      <div className="banner ai-banner-ok">
        AI 已就绪 · Provider: <strong>{status.provider}</strong> · Model:{' '}
        <strong>{status.model}</strong>
      </div>
    );
  }

  return (
    <div className="banner banner-warn">
      AI 未配置。请在项目根目录 <code>.env</code> 中设置{' '}
      <code>AI_PROVIDER</code> 及 <code>OPENAI_API_KEY</code> 或{' '}
      <code>ANTHROPIC_API_KEY</code>，参考 <code>.env.example</code>。
    </div>
  );
}
