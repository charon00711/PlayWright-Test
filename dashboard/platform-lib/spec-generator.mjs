export function generateSpec(caseData) {
  const tags = (caseData.tags || ['@regression']).join(' ');
  const module = caseData.module || 'smoke';
  const useAuth = caseData.useAuth !== false;
  const steps = caseData.steps || [];
  const title = caseData.title || '未命名用例';

  const importLine = useAuth
    ? "import { authenticatedTest as test, expect } from '../../fixtures/auth.fixture.js';"
    : "import { test, expect } from '../../fixtures/test.fixture.js';";

  const stepComments = steps
    .map((s, i) => `    // ${i + 1}. ${s.replace(/'/g, "\\'")}`)
    .join('\n');

  return `${importLine}

test.describe('${title.replace(/'/g, "\\'")}', () => {
  test('${tags} ${title.replace(/'/g, "\\'")}', async ({ page }) => {
${stepComments || '    // TODO: 实现测试步骤'}
    await page.goto('/');
    expect(true).toBeTruthy();
  });
});
`;
}

export function getSpecPath(module, id) {
  return `tests/${module}/${id}.spec.ts`;
}
