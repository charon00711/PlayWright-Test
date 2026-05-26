import { expect } from '@playwright/test';
import { BasePage } from './base.page.js';

/**
 * 临时邮箱登录页：https://mail.711621.xyz/html/login.html
 * DOM 来源：login.html + login.js
 */
export class LoginPage extends BasePage {
  /** 登录页路径 */
  static readonly path = '/html/login.html';

  readonly heading = this.page.getByRole('heading', { name: '登录到临时邮箱' });
  readonly usernameInput = this.page.locator('#username');
  readonly passwordInput = this.page.locator('#pwd');
  readonly submitButton = this.page.locator('#login');
  readonly errorMessage = this.page.locator('#err');
  readonly toast = this.page.locator('#toast');

  async open() {
    await this.goto(LoginPage.path);
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectLoginSuccess() {
    await expect(this.page).not.toHaveURL(/\/html\/login/, { timeout: 20_000 });
    await expect
      .poll(async () => {
        const cookies = await this.page.context().cookies();
        return cookies.some((c) => c.name === 'iding-session');
      })
      .toBe(true);
  }

  async expectLoginError(message?: string | RegExp) {
    if (message) {
      await expect(this.errorMessage).toContainText(message, { timeout: 5_000 });
    } else {
      await expect(this.errorMessage).not.toBeEmpty({ timeout: 5_000 });
    }
  }
}
