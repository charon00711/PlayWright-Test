import { test, expect } from '../../fixtures/test.fixture.js';

test.describe('划转功能', () => {
  test('@regression 划转功能', async ({ page }) => {
    // 1. 1、调用下wellcoin注册登录用例
    // 2. 2、点击资产
    // 3. 3、模拟充值：选择usdt，金额：10000
    // 4. 4、点击确认充值按钮
    // 5. 5、资产划转：选择usdt，金额：1000
    // 6. 6、点击确认划转按钮
    const email = `transfer-${Date.now()}@gmail.com`;

    await page.goto('/register');
    await page.getByRole('textbox', { name: '邮箱' }).fill(email);
    await page.getByRole('textbox', { name: /密码/ }).fill('123456');
    await page.getByRole('button', { name: '注册并登录' }).click();
    await page.waitForURL(/\/trade/, { timeout: 20_000 });

    await page.getByRole('link', { name: '资产' }).click();
    await page.waitForURL(/\/assets/, { timeout: 10_000 });

    await page.locator('select').first().selectOption('USDT');
    await page.locator('input[type="number"]').first().fill('10000');
    await page.getByRole('button', { name: '确认充值' }).click();
    await expect(page.getByText('充值成功（模拟）')).toBeVisible({
      timeout: 10_000,
    });

    await page.locator('select').nth(1).selectOption('USDT');
    await page.locator('select').nth(2).selectOption('BTC');
    await page.locator('input[type="number"]').nth(1).fill('1000');
    await page.getByRole('button', { name: '确认划转' }).click();

    await expect(page.getByText(/1,000 USDT\s*→/)).toBeVisible({
      timeout: 10_000,
    });
  });
});
