# Playwright测试平台

纯前端 Web 应用的 Playwright 自动化框架 + **可视化测试平台**（仪表盘、录制、用例管理、Markdown 导入、测试报告）。

## 启动测试平台（推荐）

```bash
cd playwright-e2e
cp .env.example .env
npm install
npm install --prefix dashboard
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium

# 一键：本地 API + 看板（http://localhost:5173）
npm run platform:dev
```

浏览器打开 **http://localhost:5173**，侧边栏包含：

| 菜单 | 功能 |
|------|------|
| 仪表盘 | KPI、趋势图、模块分布、快捷运行冒烟 |
| 录制测试 | 启动 Playwright Codegen，登记为用例 |
| 测试用例 | 列表、新建、编辑、删除，自动生成 spec |
| Markdown 导入 | 粘贴/上传 MD，导入用例或归档报告 |
| 测试报告 | 执行报告 + 业务 Markdown 报告 |

> 写操作（录制、新建用例、导入）需 `npm run platform:dev`。静态构建 `dashboard:build` 后仅可查看仪表盘与报告。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run platform:dev` | 测试平台（Vite + 本地 API） |
| `npm run test:ci` | 跑测试 + 同步报告到看板 |
| `npm run test:smoke` | 仅 `@smoke` |
| `npm run reports:sync` | 同步 `reports/runs` → `dashboard/public` |
| `npm run dashboard:build` | 构建静态看板 |

## 目录结构

```
playwright-e2e/
├── dashboard/              # 可视化 SPA + Vite API 插件
├── data/cases.json         # 用例元数据索引
├── reporters/              # JSON 运行报告
├── scripts/sync-reports.mjs
├── tests/                  # Playwright 用例
└── pages/                  # Page Object
```

## Markdown 导入格式

```markdown
# 用例标题
**模块:** admin
**标签:** @smoke @regression

## 步骤
1. 打开登录页
2. 点击登录

## 预期
登录成功
```

## 用例标签

- `@smoke` — 冒烟
- `@regression` — 回归
- `@critical` — 核心路径

## CI / GitHub Pages

见 [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml)。

本地 Apple Silicon：

```bash
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=0 npm run test:ci
```
