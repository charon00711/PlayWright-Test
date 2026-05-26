import type { Locator, Page } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
  }

  protected locator(selector: string): Locator {
    return this.page.locator(selector);
  }
}
