import { test as setup } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { getEnv } from '../utils/helpers.js';

const authFile = '.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  const email = getEnv('TEST_USER_EMAIL');
  const password = getEnv('TEST_USER_PASSWORD');
  if (!email || !password) {
    throw new Error('请在 .env 中配置 TEST_USER_EMAIL 和 TEST_USER_PASSWORD');
  }

  const loginPage = new LoginPage(page);
  await loginPage.open();
  await loginPage.login(email, password);
  await loginPage.expectLoginSuccess();
  await page.context().storageState({ path: authFile });
});
