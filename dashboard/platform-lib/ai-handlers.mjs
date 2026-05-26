import fs from 'fs';
import path from 'path';
import {
  buildAnalyzeBugPrompt,
  buildCaseContext,
  buildFailureContext,
  buildFixCasePrompt,
  buildGenerateCasePrompt,
} from './ai-context.mjs';
import {
  chatCompletion,
  checkAiRateLimit,
  getAiConfig,
  parseJsonFromResponse,
} from './ai-client.mjs';
import { generateSpec, getSpecPath } from './spec-generator.mjs';
import { safePath, slugify } from './utils.mjs';

function validatePreview(preview) {
  if (!preview?.title || !preview?.module) {
    throw new Error('AI 返回缺少 title 或 module');
  }
  return {
    title: String(preview.title),
    module: String(preview.module),
    tags: Array.isArray(preview.tags) ? preview.tags.map(String) : ['@regression'],
    steps: Array.isArray(preview.steps) ? preview.steps.map(String) : [],
    expected: String(preview.expected || ''),
    useAuth: preview.useAuth !== false,
  };
}

function writeSpecFile(projectRoot, specPath, specCode, fallbackCase) {
  const specFull = safePath(projectRoot, specPath);
  fs.mkdirSync(path.dirname(specFull), { recursive: true });
  const content =
    specCode && specCode.includes('test(')
      ? specCode
      : generateSpec({ ...fallbackCase, title: fallbackCase.title });
  fs.writeFileSync(specFull, content, 'utf-8');
  return content;
}

export async function handleAiChat(projectRoot, body) {
  const { message, history = [] } = body || {};
  if (!message?.trim()) throw new Error('message 不能为空');

  checkAiRateLimit('chat', 2000);

  const messages = [
    {
      role: 'system',
      content:
        '你是 Playwright 测试平台的智能助手。帮助用户理解平台功能（用例管理、定时任务、AI 中心、性能、接口用例等），回答测试相关问题（Playwright、E2E、断言、调试），并能根据需求给出 Playwright spec 代码片段。回答简洁、用中文。',
    },
    ...(Array.isArray(history) ? history : []).slice(-10).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || ''),
    })),
    { role: 'user', content: String(message) },
  ];

  const { text, provider, model } = await chatCompletion(projectRoot, {
    messages,
  });
  return { text, provider, model };
}

export function handleAiStatus(projectRoot) {
  const config = getAiConfig(projectRoot);
  return {
    configured: config.configured,
    provider: config.provider,
    model: config.model,
  };
}

export async function handleAiGenerateCase(projectRoot, body, { readCases, writeCases }) {
  checkAiRateLimit('generate-case');
  const config = getAiConfig(projectRoot);
  const { system, user } = buildGenerateCasePrompt(projectRoot, {
    prompt: body.prompt || '',
    module: body.module,
    useAuth: body.useAuth,
    baseURL: config.baseUrl,
  });

  if (!body.prompt?.trim()) throw new Error('请提供用例需求描述');

  const { text } = await chatCompletion(projectRoot, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    jsonMode: true,
  });

  const parsed = parseJsonFromResponse(text);
  const preview = validatePreview(parsed.preview);

  if (body.confirm) {
    const data = readCases();
    const id = slugify(preview.title) + '-' + Date.now().toString(36).slice(-4);
    const specPath = getSpecPath(preview.module, id);
    writeSpecFile(projectRoot, specPath, parsed.specCode, preview);
    const entry = {
      id,
      ...preview,
      specPath,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    data.cases.push(entry);
    writeCases(data);
    return { ok: true, case: entry, explanation: parsed.explanation || '' };
  }

  return {
    preview,
    specCode: parsed.specCode || generateSpec(preview),
    explanation: parsed.explanation || '',
  };
}

export async function handleAiFixCase(projectRoot, body) {
  checkAiRateLimit('fix-case');
  if (!body.caseId) throw new Error('请指定 caseId');

  const ctx = buildCaseContext(projectRoot, body.caseId);
  if (!ctx) throw new Error('用例不存在');

  let failure = null;
  if (body.runId) {
    const failCtx = buildFailureContext(projectRoot, body.runId);
    const specFile = ctx.testCase.specPath;
    failure = failCtx?.failedTests?.find(
      (t) => t.file === specFile || t.title.includes(ctx.testCase.title),
    );
  }

  const { system, user } = buildFixCasePrompt(projectRoot, {
    testCase: ctx.testCase,
    specContent: ctx.specContent,
    failure,
    errorHint: body.errorHint,
  });

  const { text } = await chatCompletion(projectRoot, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    jsonMode: true,
  });

  const parsed = parseJsonFromResponse(text);
  return {
    diagnosis: parsed.diagnosis || '',
    suggestedSteps: Array.isArray(parsed.suggestedSteps) ? parsed.suggestedSteps : [],
    specPatch: parsed.specPatch || ctx.specContent,
    confidence: parsed.confidence || 'medium',
    caseId: body.caseId,
  };
}

export async function handleAiAnalyzeBug(projectRoot, body) {
  checkAiRateLimit('analyze-bug');
  if (!body.runId) throw new Error('请指定 runId');

  const failureCtx = buildFailureContext(projectRoot, body.runId, body.testTitle);
  if (!failureCtx) throw new Error('运行记录不存在');

  if (failureCtx.failedTests.length === 0 && !body.testTitle) {
    throw new Error('本次运行无失败用例');
  }

  const { system, user } = buildAnalyzeBugPrompt(projectRoot, failureCtx);

  const { text } = await chatCompletion(projectRoot, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    jsonMode: true,
  });

  const parsed = parseJsonFromResponse(text);
  return {
    summary: parsed.summary || '',
    rootCause: parsed.rootCause || '',
    reproSteps: Array.isArray(parsed.reproSteps) ? parsed.reproSteps : [],
    fixSuggestions: Array.isArray(parsed.fixSuggestions) ? parsed.fixSuggestions : [],
    relatedLogs: Array.isArray(parsed.relatedLogs) ? parsed.relatedLogs : [],
    markdown: parsed.markdown || `# Bug 分析\n\n${parsed.summary || ''}`,
    runId: body.runId,
    testTitle: body.testTitle || null,
  };
}

export function applyAiFix(projectRoot, body, { readCases, writeCases }) {
  const { caseId, specPatch, suggestedSteps, expected } = body;
  const data = readCases();
  const idx = data.cases.findIndex((c) => c.id === caseId);
  if (idx < 0) throw new Error('用例不存在');

  const updated = {
    ...data.cases[idx],
    steps: suggestedSteps?.length ? suggestedSteps : data.cases[idx].steps,
    expected: expected || data.cases[idx].expected,
    updatedAt: new Date().toISOString(),
  };
  data.cases[idx] = updated;
  writeCases(data);

  if (specPatch) {
    const specFull = safePath(projectRoot, updated.specPath);
    fs.writeFileSync(specFull, specPatch, 'utf-8');
  } else {
    const specFull = safePath(projectRoot, updated.specPath);
    fs.writeFileSync(specFull, generateSpec(updated), 'utf-8');
  }

  return updated;
}
