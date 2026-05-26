import { authenticatedTest as test, expect } from '../../fixtures/auth.fixture.js';
import { getRunId, writeTestReport } from '../../utils/report.js';

const NEW_USER = {
  username: 'bill01',
  password: 'bill01',
  roleLabel: '普通用户',
  roleValue: 'user' as const,
};

test.describe('用户管理 - 创建用户', () => {
  test.beforeEach(async ({ page, adminPage }) => {
    await page.goto('/');
    await adminPage.deleteUserByUsername(NEW_USER.username);
  });

  test('@smoke @critical @regression 账号密码登录 → 用户管理 → 创建 bill01 普通用户 → 创建成功', async ({
    homePage,
    adminPage,
  }) => {
    const startedAt = Date.now();
    const runId = getRunId();
    const steps: string[] = [];
    let status: '通过' | '失败' = '通过';
    let actual = '';

    try {
      steps.push('使用 storageState 已登录 admin，进入首页');
      await homePage.expectLoaded();
      actual += '已登录，进入邮箱管理首页。\n';

      steps.push('点击「用户管理」');
      await homePage.openUserManagement();
      await adminPage.expectLoaded();
      actual += '已进入用户管理页面。\n';

      steps.push('点击「创建用户」');
      await adminPage.openCreateUserModal();

      steps.push(
        `填写用户名 ${NEW_USER.username}、密码 ${NEW_USER.password}、角色 ${NEW_USER.roleLabel}`,
      );
      await adminPage.fillCreateUserForm(
        NEW_USER.username,
        NEW_USER.password,
        NEW_USER.roleValue,
      );

      const roleText = await adminPage.roleSelect.locator('option:checked').textContent();
      expect(roleText?.trim()).toBe(NEW_USER.roleLabel);

      steps.push('点击「创建」按钮');
      await adminPage.submitCreateUser();

      steps.push('验证创建成功提示与用户列表');
      await adminPage.expectCreateSuccess(NEW_USER.username);
      actual += `Toast 显示「用户创建成功」，用户列表包含 ${NEW_USER.username}。`;
    } catch (e) {
      status = '失败';
      actual += `失败原因：${e instanceof Error ? e.message : String(e)}`;
      throw e;
    } finally {
      const reportPath = writeTestReport({
        caseName: '账号密码登录并创建普通用户 bill01',
        steps,
        expected:
          '登录成功；进入用户管理；创建用户 bill01/bill01（普通用户）后提示「用户创建成功」，列表可见 bill01。',
        actual: actual.trim() || '（未记录）',
        status,
        durationMs: Date.now() - startedAt,
        executedAt: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        runId,
      });
      test.info().attach('测试报告', {
        path: reportPath,
        contentType: 'text/markdown',
      });
    }
  });
});
