import { test as base } from './test.fixture.js';

/** 已登录 admin 的测试（依赖 storageState，无需重复登录） */
export const authenticatedTest = base.extend({
  page: async ({ page }, use) => {
    await page.goto('/');
    await use(page);
  },
});

export { expect } from '@playwright/test';
