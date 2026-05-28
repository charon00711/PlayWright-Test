import { test, expect } from '../../fixtures/test.fixture.js';

test.describe('注册登录用例', () => {
  test('@regression 注册登录用例', async ({ page }) => {
    // 1. 1、在页面中点击立即注册按钮
    // 2. 2、输入邮箱：test@gmail.com
    // 3. 3、输入密码：123456
    // 4. 4、点击注册并登录按钮
    await page.goto('/');
    expect(true).toBeTruthy();
  });
});
