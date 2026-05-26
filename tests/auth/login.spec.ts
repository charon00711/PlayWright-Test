import { test, expect } from '../../fixtures/test.fixture.js';
import { getEnv } from '../../utils/helpers.js';

const email = getEnv('TEST_USER_EMAIL');
const password = getEnv('TEST_USER_PASSWORD');

test.describe('临时邮箱登录', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.open();
  });

  test('@smoke @critical admin 账号应登录成功并跳转离开登录页', async ({
    loginPage,
    page,
  }) => {
    test.skip(!email || !password, '请在 .env 中配置 TEST_USER_EMAIL 和 TEST_USER_PASSWORD');

    await loginPage.login(email, password);
    await loginPage.expectLoginSuccess();

    const session = await page.request.get('/api/session');
    expect(session.ok()).toBeTruthy();
  });

  test('@regression 错误密码应显示错误提示', async ({ loginPage, page }) => {
    await loginPage.login('admin', 'wrong-password-xyz');
    await loginPage.expectLoginError();
    await expect(page).toHaveURL(/\/html\/login/);
  });
});
