import { test as base } from '@playwright/test';
import { AdminPage } from '../pages/admin.page.js';
import { HomePage } from '../pages/home.page.js';
import { LoginPage } from '../pages/login.page.js';
import { appendLiveLog } from '../utils/live-log.js';

type Fixtures = {
  loginPage: LoginPage;
  homePage: HomePage;
  adminPage: AdminPage;
};

export const test = base.extend<Fixtures>({
  context: async ({ context }, use, testInfo) => {
    const api = context.request;
    const wrapMethod = (
      method: string,
      original: (...args: never[]) => Promise<{ status: () => number; url: () => string }>,
    ) => {
      return async (...args: never[]) => {
        const start = Date.now();
        const response = await original(...args);
        appendLiveLog({
          type: 'api',
          method: method.toUpperCase(),
          url: typeof args[0] === 'string' ? args[0] : response.url(),
          status: response.status(),
          durationMs: Date.now() - start,
          test: testInfo.title,
          source: 'browser',
        });
        return response;
      };
    };

    api.get = wrapMethod('get', api.get.bind(api)) as typeof api.get;
    api.post = wrapMethod('post', api.post.bind(api)) as typeof api.post;
    api.put = wrapMethod('put', api.put.bind(api)) as typeof api.put;
    api.patch = wrapMethod('patch', api.patch.bind(api)) as typeof api.patch;
    api.delete = wrapMethod('delete', api.delete.bind(api)) as typeof api.delete;
    api.fetch = wrapMethod('fetch', api.fetch.bind(api)) as typeof api.fetch;

    await use(context);
  },
  page: async ({ page }, use, testInfo) => {
    const testName = testInfo.title;
    const pendingRequests = new Map<
      string,
      { method: string; url: string; resourceType: string; startedAt: number }
    >();

    page.on('console', (msg) => {
      appendLiveLog({
        type: 'console',
        level: msg.type() as 'log' | 'info' | 'warn' | 'error' | 'debug',
        message: msg.text(),
        test: testName,
        source: 'browser',
      });
    });

    page.on('request', (req) => {
      pendingRequests.set(req.url() + req.method(), {
        method: req.method(),
        url: req.url(),
        resourceType: req.resourceType(),
        startedAt: Date.now(),
      });
    });

    page.on('response', async (res) => {
      const req = res.request();
      const key = req.url() + req.method();
      const pending = pendingRequests.get(key);
      pendingRequests.delete(key);
      const durationMs = pending ? Date.now() - pending.startedAt : undefined;

      appendLiveLog({
        type: 'network',
        method: req.method(),
        url: req.url(),
        status: res.status(),
        durationMs,
        resourceType: req.resourceType(),
        test: testName,
        source: 'browser',
      });

      const url = req.url();
      if (/\/api[\/?]|api\./i.test(url) || req.resourceType() === 'fetch') {
        appendLiveLog({
          type: 'api',
          method: req.method(),
          url,
          status: res.status(),
          durationMs,
          test: testName,
          source: 'browser',
        });
      }
    });

    page.on('pageerror', (err) => {
      appendLiveLog({
        type: 'console',
        level: 'error',
        message: err.message,
        test: testName,
        source: 'browser',
      });
    });

    await use(page);
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  adminPage: async ({ page }, use) => {
    await use(new AdminPage(page));
  },
});

export { expect } from '@playwright/test';
