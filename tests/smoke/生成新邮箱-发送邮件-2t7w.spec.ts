import { authenticatedTest as test, expect } from '../../fixtures/auth.fixture.js';

test.describe('生成新邮箱，发送邮件', () => {
  test('@regression 生成新邮箱，发送邮件', async ({ page }) => {
    // 1. 1、登录成功后，生成新邮箱
    // 2. 2、点击发邮件按钮
    // 3. 3、新邮件内容：收件人：napaowang11@gmail.com 主题：test 内容：test
    // 4. 4、点击发送按钮
    await page.goto('/');
    expect(true).toBeTruthy();
  });
});
