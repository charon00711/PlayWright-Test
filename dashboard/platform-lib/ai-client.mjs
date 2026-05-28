import { loadEnv } from './utils.mjs';

export function getAiConfig(projectRoot) {
  const env = loadEnv(projectRoot);
  const provider = (env.AI_PROVIDER || 'openai').toLowerCase();
  const openaiKey = env.OPENAI_API_KEY || '';
  const anthropicKey = env.ANTHROPIC_API_KEY || '';

  let configured = false;
  let model = '';

  if (provider === 'anthropic') {
    configured = Boolean(anthropicKey);
    model = env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
  } else {
    configured = Boolean(openaiKey);
    model = env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  return {
    provider,
    configured,
    model,
    baseURL: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    openaiKey,
    anthropicKey,
    baseUrl: env.BASE_URL || 'https://wellcoin.711621.xyz/',
  };
}

export function parseJsonFromResponse(text) {
  if (!text) throw new Error('AI 返回为空');
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error('无法解析 AI 返回的 JSON');
}

async function chatOpenAI(config, { messages, jsonMode }) {
  const url = `${config.baseURL.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: config.model,
    messages,
    temperature: 0.2,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API 错误 (${res.status}): ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function chatAnthropic(config, { messages, jsonMode }) {
  const system = messages.find((m) => m.role === 'system')?.content || '';
  const userMessages = messages.filter((m) => m.role !== 'system');

  const body = {
    model: config.model,
    max_tokens: 8192,
    temperature: 0.2,
    system: jsonMode
      ? `${system}\n\n你必须只输出合法 JSON，不要包含 markdown 代码块或其他文字。`
      : system,
    messages: userMessages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API 错误 (${res.status}): ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  const block = data.content?.find((c) => c.type === 'text');
  return block?.text || '';
}

export async function chatCompletion(projectRoot, { messages, jsonMode = false }) {
  const config = getAiConfig(projectRoot);
  if (!config.configured) {
    throw new Error(
      'AI 未配置。请在 .env 中设置 AI_PROVIDER 及 OPENAI_API_KEY 或 ANTHROPIC_API_KEY',
    );
  }

  const text =
    config.provider === 'anthropic'
      ? await chatAnthropic(config, { messages, jsonMode })
      : await chatOpenAI(config, { messages, jsonMode });

  return { text, provider: config.provider, model: config.model };
}

const rateLimitMap = new Map();

export function checkAiRateLimit(key, windowMs = 10_000) {
  const now = Date.now();
  const last = rateLimitMap.get(key) || 0;
  if (now - last < windowMs) {
    throw new Error('请求过于频繁，请稍后再试');
  }
  rateLimitMap.set(key, now);
}
