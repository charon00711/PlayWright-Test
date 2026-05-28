import { test, expect } from '../../fixtures/test.fixture.js';

test.describe('Web Vitals @perf', () => {
  test('落地页 Web Vitals', async ({ page, measureVitals }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('button', { name: '立即注册' }).or(
        page.getByRole('link', { name: '立即注册' }),
      ),
    ).toBeVisible({ timeout: 15_000 });

    const metrics = await measureVitals(page.url());

    expect(metrics.ttfb, 'TTFB should be recorded').toBeDefined();
    expect(metrics.fcp, 'FCP should be recorded').toBeGreaterThan(0);
    expect(metrics.lcp, 'LCP should be recorded').toBeGreaterThan(0);
  });

  test('注册页 Web Vitals', async ({ page, measureVitals }) => {
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('textbox', { name: '邮箱' })).toBeVisible({
      timeout: 15_000,
    });

    const metrics = await measureVitals(page.url());

    expect(metrics.ttfb, 'TTFB should be recorded').toBeDefined();
    expect(metrics.domContentLoaded, 'DCL should be recorded').toBeGreaterThan(0);
  });

  test('交易页 Web Vitals', async ({ page, measureVitals }) => {
    const email = `perf-vitals-${Date.now()}@gmail.com`;

    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await page.getByRole('textbox', { name: '邮箱' }).fill(email);
    await page.getByRole('textbox', { name: /密码/ }).fill('123456');
    await page.getByRole('button', { name: '注册并登录' }).click();
    await page.waitForURL(/\/trade/, { timeout: 20_000 });

    const metrics = await measureVitals(page.url());

    expect(metrics.lcp, 'LCP should be recorded').toBeGreaterThan(0);
    expect(metrics.cls, 'CLS should be recorded').toBeDefined();
  });
});
