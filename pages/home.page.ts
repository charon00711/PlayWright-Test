import { expect } from '@playwright/test';
import { BasePage } from './base.page.js';

export class HomePage extends BasePage {
  readonly userManagementLink = this.page.locator('#admin');

  async expectLoaded() {
    await expect(this.userManagementLink).toBeVisible({ timeout: 15_000 });
  }

  async openUserManagement() {
    await this.userManagementLink.click();
    await expect(this.page).toHaveURL(/\/html\/admin/, { timeout: 20_000 });
  }
}
