import { expect } from '@playwright/test';
import { deleteUserByUsername } from '../utils/test-data.js';
import { BasePage } from './base.page.js';

export class AdminPage extends BasePage {
  static readonly path = '/html/admin.html';

  readonly createUserButton = this.page.locator('#u-open');
  readonly createModal = this.page.locator('#u-modal');
  readonly usernameInput = this.page.locator('#u-name');
  readonly passwordInput = this.page.locator('#u-pass');
  readonly roleSelect = this.page.locator('#u-role');
  readonly submitCreateButton = this.page.locator('#u-create');
  readonly usersTable = this.page.locator('#users-tbody');
  readonly toast = this.page.locator('#toast');

  async expectLoaded() {
    await expect(this.createUserButton).toBeVisible({ timeout: 15_000 });
  }

  async openCreateUserModal() {
    await this.createUserButton.click();
    await expect(this.createModal).toHaveClass(/show/);
  }

  async fillCreateUserForm(username: string, password: string, role: 'user' | 'admin' = 'user') {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.roleSelect.selectOption(role);
  }

  async submitCreateUser() {
    await this.submitCreateButton.click();
  }

  async expectCreateSuccess(username: string) {
    await expect(this.toast).toContainText('用户创建成功', { timeout: 10_000 });
    await expect(this.createModal).not.toHaveClass(/show/);
    await expect(this.usersTable).toContainText(username, { timeout: 10_000 });
  }

  async deleteUserByUsername(username: string) {
    await deleteUserByUsername(this.page.request, username);
  }
}
