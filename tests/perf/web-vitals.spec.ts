import { test, expect } from '../../fixtures/test.fixture.js';
import { LoginPage } from '../../pages/login.page.js';

test.describe('Web Vitals @perf', () => {
  test('登录页 Web Vitals', async ({ page, context, measureVitals }) => {
    // Clear auth state so the login page is reachable (chromium project is pre-authenticated)
    await context.clearCookies();
    await page.goto(LoginPage.path, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: '登录到临时邮箱' })).toBeVisible({
      timeout: 15_000,
    });

    const metrics = await measureVitals(page.url());

    expect(metrics.ttfb, 'TTFB should be recorded').toBeDefined();
    expect(metrics.fcp, 'FCP should be recorded').toBeGreaterThan(0);
    expect(metrics.lcp, 'LCP should be recorded').toBeGreaterThan(0);
  });

  test('首页 Web Vitals', async ({ page, homePage, measureVitals }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await homePage.expectLoaded();

    const homeUrl = page.url();
    const metrics = await measureVitals(homeUrl);

    expect(metrics.ttfb, 'TTFB should be recorded').toBeDefined();
    expect(metrics.domContentLoaded, 'DCL should be recorded').toBeGreaterThan(0);
  });

  test('管理页 Web Vitals', async ({ page, homePage, measureVitals }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await homePage.openUserManagement();

    const adminUrl = page.url();
    const metrics = await measureVitals(adminUrl);

    expect(metrics.lcp, 'LCP should be recorded').toBeGreaterThan(0);
    expect(metrics.cls, 'CLS should be recorded').toBeDefined();
  });
});
