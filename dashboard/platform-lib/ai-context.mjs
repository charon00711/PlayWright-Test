import fs from 'fs';
import path from 'path';
import { readJson, safePath } from './utils.mjs';
import { readFileEvents } from './live-logs.mjs';

export function buildPageObjectsContext(projectRoot) {
  const pagesDir = path.join(projectRoot, 'pages');
  if (!fs.existsSync(pagesDir)) return '无 Page Object 文件';

  const summaries = [];
  for (const file of fs.readdirSync(pagesDir).filter((f) => f.endsWith('.page.ts'))) {
    const content = fs.readFileSync(path.join(pagesDir, file), 'utf-8');
    const classMatch = content.match(/export class (\w+)/);
    const pathMatch = content.match(/static readonly path = ['"]([^'"]+)['"]/);
    const locators = [...content.matchAll(/readonly (\w+) = this\.page\.(locator|getByRole)\([^)]+\)/g)]
      .map((m) => m[1])
      .slice(0, 12);
    const methods = [...content.matchAll(/async (\w+)\(/g)]
      .map((m) => m[1])
      .filter((n) => !['goto', 'open'].includes(n))
      .slice(0, 10);

    summaries.push(
      `- ${classMatch?.[1] || file}: path=${pathMatch?.[1] || '?'}, locators=[${locators.join(', ')}], methods=[${methods.join(', ')}]`,
    );
  }
  return summaries.join('\n');
}

export function buildCasesExamples(projectRoot, limit = 3) {
  const data = readJson(path.join(projectRoot, 'data', 'cases.json'), { cases: [] });
  return data.cases.slice(0, limit).map((c) => ({
    title: c.title,
    module: c.module,
    tags: c.tags,
    steps: c.steps,
    expected: c.expected,
    useAuth: c.useAuth,
    specPath: c.specPath,
  }));
}

export function buildCaseContext(projectRoot, caseId) {
  const data = readJson(path.join(projectRoot, 'data', 'cases.json'), { cases: [] });
  const testCase = data.cases.find((c) => c.id === caseId);
  if (!testCase) return null;

  let specContent = '';
  try {
    const specFull = safePath(projectRoot, testCase.specPath);
    if (fs.existsSync(specFull)) {
      specContent = fs.readFileSync(specFull, 'utf-8').slice(0, 8000);
    }
  } catch (_) {}

  return { testCase, specContent };
}

export function buildFailureContext(projectRoot, runId, testTitle) {
  const runPath = path.join(projectRoot, 'reports', 'runs', `${runId}.json`);
  if (!fs.existsSync(runPath)) return null;

  const run = readJson(runPath, null);
  if (!run) return null;

  let failedTests = (run.tests || []).filter((t) => t.status === 'failed');
  if (testTitle) {
    failedTests = failedTests.filter((t) => t.title === testTitle);
  }

  const bizPath = path.join(projectRoot, 'reports', 'runs', `${runId}-biz.json`);
  const businessReports = fs.existsSync(bizPath) ? readJson(bizPath, []) : [];

  const liveEvents = readFileEvents(projectRoot, { limit: 200 })
    .filter((e) => ['console', 'api', 'network', 'process'].includes(e.type))
    .slice(-80);

  return {
    run: {
      id: run.id,
      baseURL: run.baseURL,
      env: run.env,
      passed: run.passed,
      failed: run.failed,
      startedAt: run.startedAt,
    },
    failedTests,
    businessReports,
    liveEvents,
  };
}

export const SPEC_RULES = `
Playwright Spec 编写规范：
1. 已登录场景使用: import { authenticatedTest as test, expect } from '../../fixtures/auth.fixture.js';
2. 未登录/登录测试使用: import { test, expect } from '../../fixtures/test.fixture.js';
3. 必须使用 Page Object：LoginPage, HomePage, AdminPage（位于 pages/ 目录）
4. 禁止硬编码与 Page Object 重复的 selector
5. 测试标题包含 tags，如 @smoke @regression
6. 使用 test.describe 包裹，test 内实现真实步骤而非仅 expect(true)
`;

export function buildGenerateCasePrompt(projectRoot, { prompt, module, useAuth, baseURL }) {
  const pages = buildPageObjectsContext(projectRoot);
  const examples = buildCasesExamples(projectRoot);

  return {
    system: `你是 Playwright E2E 测试专家，为临时邮箱系统 (${baseURL}) 生成测试用例。
${SPEC_RULES}
只输出 JSON，格式：
{
  "preview": { "title": "...", "module": "auth|admin|smoke|mailbox|recorded", "tags": ["@regression"], "steps": ["..."], "expected": "...", "useAuth": true },
  "specCode": "完整 TypeScript spec 文件内容",
  "explanation": "简要说明"
}`,
    user: `用户需求：${prompt}
偏好模块：${module || '自动选择'}
需要登录态：${useAuth !== false ? '是' : '否'}

Page Objects：
${pages}

现有用例示例：
${JSON.stringify(examples, null, 2)}`,
  };
}

export function buildFixCasePrompt(projectRoot, { testCase, specContent, failure, errorHint }) {
  const pages = buildPageObjectsContext(projectRoot);

  return {
    system: `你是 Playwright 测试修复专家。分析失败原因并给出修复后的完整 spec 文件。
${SPEC_RULES}
只输出 JSON：
{
  "diagnosis": "失败原因分析",
  "suggestedSteps": ["步骤1", "步骤2"],
  "specPatch": "修复后的完整 spec 文件内容",
  "confidence": "high|medium|low"
}`,
    user: `用例信息：
${JSON.stringify(testCase, null, 2)}

当前 Spec：
\`\`\`typescript
${specContent}
\`\`\`

失败信息：
${failure ? JSON.stringify(failure, null, 2) : '无运行记录，请根据用例和 spec 推断可能问题'}

额外提示：${errorHint || '无'}

Page Objects：
${pages}`,
  };
}

export function buildAnalyzeBugPrompt(projectRoot, failureCtx) {
  return {
    system: `你是 QA 与 Playwright 专家。根据测试失败信息输出 Bug 分析报告。
只输出 JSON：
{
  "summary": "一句话摘要",
  "rootCause": "根因分析",
  "reproSteps": ["复现步骤"],
  "fixSuggestions": ["修复建议"],
  "relatedLogs": ["相关日志摘要"],
  "markdown": "# Bug 分析\\n\\n## 摘要\\n..."
}`,
    user: `失败上下文：
${JSON.stringify(failureCtx, null, 2)}`,
  };
}
