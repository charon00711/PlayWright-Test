# Playwright 测试平台

面向 Web 应用的 **Playwright E2E 自动化测试框架** + **可视化测试管理平台**。  
在浏览器中完成用例管理、测试执行、报告查看、定时调度、性能监控与 AI 辅助，并支持 GitHub Actions CI/CD 与 Cloudflare Pages 静态部署。

---

## 1. 平台作用

| 场景 | 说明 |
|------|------|
| **统一测试入口** | 测试人员无需记忆命令行，在 Web 看板中一键运行冒烟 / 回归 / 单用例 |
| **用例全生命周期** | 录制 → 编辑 → 标签分类 → 定时执行 → 报告归档，闭环管理 |
| **多类型测试** | UI E2E、接口自动化、Web Vitals 性能、k6 负载测试，集中展示 |
| **CI/CD 集成** | PR 冒烟、Merge 全量、定时回归，自动上传报告并部署看板 |
| **AI 提效** | 自然语言生成用例、失败自动修复建议、Bug 根因分析 |

默认被测目标：`https://mail.711621.xyz/`（临时邮箱系统），可通过 `.env` 切换任意 Web 应用。

---

## 2. 功能模块

### 仪表盘
- KPI 概览、通过率趋势、模块分布
- 快捷运行冒烟测试

### 录制测试
- 启动 Playwright Codegen 录制浏览器操作
- 一键登记为平台用例并生成 `.spec.ts`

### 测试用例（UI E2E）
- 用例 CRUD、按模块 / 标签管理
- 自动生成 Page Object 风格 spec 骨架
- 支持 `@smoke` / `@regression` / `@critical` 标签过滤运行

### 接口用例
- 单接口用例：Method / URL / Headers / Query / Body / 断言
- 支持 `${BASE_URL}` 等环境变量
- 断言类型：status、json path、header、body、responseTime
- 单条运行、批量回归、即时调试、运行历史

### Markdown 导入
- 粘贴或上传 Markdown，解析为用例或业务测试报告
- 支持预览后确认导入

### 测试报告
- 每次运行的 JSON 报告列表与详情
- 内嵌 Playwright HTML 报告、失败截图 / 视频 / Trace
- 业务 Markdown 报告归档

### 定时中心
- 每日定时 / Cron 表达式调度
- 目标：全量 / 冒烟 / 回归 / 指定 spec
- 执行历史与手动触发

### 实时日志
- 测试运行中的 Console、API、Network、Trace 事件流
- 平台 API 调用日志

### AI 中心
- **生成用例**：自然语言描述 → 用例元数据 + spec 代码
- **自动修复**：结合失败报告给出修复建议并可应用
- **Bug 分析**：对失败用例做根因分析与复现步骤

### 性能中心
- **Web Vitals**：Playwright 采集 LCP / FCP / CLS / TTFB / TTI，趋势图展示
- **负载测试**：k6 脚本压测，RPS / p95 / 错误率可视化

---

## 3. 技术栈

### 测试层
| 技术 | 用途 |
|------|------|
| [Playwright](https://playwright.dev/) | E2E 浏览器自动化 |
| TypeScript | 用例与 Page Object 类型安全 |
| Page Object Model | `pages/` 页面对象封装 |
| 自定义 Reporter | JSON 报告、实时日志、Web Vitals |
| k6 | HTTP 负载 / 压力测试 |

### 平台层（Dashboard）
| 技术 | 用途 |
|------|------|
| React 19 + TypeScript | 前端 SPA |
| Vite 6 | 构建与 Dev Server |
| React Router 7 | 路由 |
| Recharts | 性能趋势图表 |
| Vite Plugin（`vite-plugin-platform-api.mjs`） | 本地 API 中间件 |
| node-cron + cron-parser | 定时任务调度 |

### CI/CD 与部署
| 技术 | 用途 |
|------|------|
| GitHub Actions | PR 测试、Merge 测试、定时回归 |
| Cloudflare Pages | 静态看板 + 报告 CDN 部署 |
| Wrangler | CI 中推送构建产物 |

### AI（可选）
- OpenAI 兼容 API / Anthropic Claude
- 通过 `.env` 配置，未配置时 AI 菜单只读提示

---

## 4. 本地开发与调试

### 环境要求
- Node.js 20+
- npm 9+
- Chromium（Playwright 自带）

### 首次安装

```bash
git clone https://github.com/charon00711/PlayWright-Test.git
cd PlayWright-Test

cp .env.example .env          # 按需修改 BASE_URL、账号、AI Key
npm install
npm install --prefix dashboard
npm run install:browsers        # 或 npx playwright install chromium
```

Apple Silicon 若遇浏览器路径问题：

```bash
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
```

### 启动测试平台（推荐）

```bash
npm run platform:dev
# 等价于 npm run dashboard:dev
```

浏览器打开 **http://localhost:5173**

> 写操作（录制、新建用例、定时任务、AI、接口运行等）依赖 Vite Dev Server 内置 API。  
> 仅 `dashboard:build` 的静态产物为只读模式（报告 / 性能 / 接口历史可查看）。

### 常用测试命令

| 命令 | 说明 |
|------|------|
| `npm run test` | 运行全部 Playwright 用例 |
| `npm run test:smoke` | 仅 `@smoke` |
| `npm run test:regression` | 仅 `@regression` |
| `npm run test:ci` | 全量测试 + 同步报告到看板 |
| `npm run test:perf` | Web Vitals 性能用例（`@perf`） |
| `npm run perf:load` | k6 负载测试（需本机安装 [k6](https://k6.io/)） |
| `npm run reports:sync` | 手动同步 `reports/` → `dashboard/public/` |
| `npm run report` | 打开 Playwright HTML 报告 |
| `npm run codegen` | 启动 Playwright 录制 |

### 环境变量（`.env`）

```env
BASE_URL=https://mail.711621.xyz/
TEST_USER_EMAIL=admin
TEST_USER_PASSWORD=admin
TEST_ENV=local

# AI（可选）
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

### 目录结构

```
PlayWright-Test/
├── dashboard/                 # React 看板 + Vite API 插件
│   ├── src/pages/             # 各功能页面
│   ├── platform-lib/          # 后端逻辑（调度、AI、接口、性能）
│   └── vite-plugin-platform-api.mjs
├── tests/                     # Playwright 用例
├── pages/                     # Page Object
├── fixtures/                  # 测试 Fixture（认证、实时日志、性能）
├── reporters/                 # 自定义 Reporter
├── perf/k6/                   # k6 负载脚本
├── data/
│   ├── cases.json             # UI 用例元数据
│   ├── api-cases.json         # 接口用例
│   └── schedules.json         # 定时任务
├── reports/
│   ├── runs/                  # E2E 运行 JSON
│   ├── api-runs/              # 接口运行历史
│   ├── perf/                  # 性能数据
│   └── live/                  # 实时日志
├── scripts/sync-reports.mjs   # 报告同步到 public/
└── .github/workflows/         # CI/CD
```

---

## 5. 部署

### 方案 A：GitHub Actions + Cloudflare Pages（推荐）

测试在 GitHub Actions 中执行，看板静态构建后部署到 Cloudflare Pages。

**Workflow 说明：**

| Workflow | 触发 | 行为 |
|----------|------|------|
| `pr-tests.yml` | Pull Request | 冒烟测试 `@smoke` |
| `merge-tests.yml` | push main/master | 全量 E2E + 性能 + k6 → 构建看板 → 部署 Cloudflare |
| `regression.yml` | 每天 02:00 北京 / 手动 | 回归测试 → 更新 Cloudflare 看板 |

**GitHub Secrets（Settings → Secrets and variables → Actions）：**

| Secret | 说明 |
|--------|------|
| `BASE_URL` | 被测地址 |
| `TEST_USER_EMAIL` | 测试账号 |
| `TEST_USER_PASSWORD` | 测试密码 |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需 Pages Edit 权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID |

**Cloudflare Pages 配置：**
1. 创建 Pages 项目（如 `playwright-test`）
2. CI 通过 Wrangler 推送 `dashboard/dist`，无需在 Cloudflare 配置 Build
3. 访问：`https://playwright-test.pages.dev`

**手动触发回归：**

GitHub → Actions → **Regression Tests** → **Run workflow** → 选择 `regression` / `smoke` / `all`

### 方案 B：纯本地 / 内网

```bash
npm run platform:dev          # 完整功能（含 API）
# 或
npm run dashboard:build && npm run dashboard:preview
```

内网暴露可用 nginx 反代，或通过 Cloudflare Tunnel 将本机 5173 端口安全暴露。

### 静态看板限制

Cloudflare Pages 部署的看板为**静态只读**：
- ✅ 测试报告、性能趋势、接口运行历史
- ❌ 录制、定时任务、AI 调用、接口即时运行（需本地 `platform:dev`）

---

## 6. 用例规范

### 标签

| 标签 | 含义 |
|------|------|
| `@smoke` | 冒烟，PR / 快速验证 |
| `@regression` | 回归，Merge / 定时任务 |
| `@critical` | 核心路径 |
| `@perf` | Web Vitals 性能用例 |

### Markdown 导入格式

```markdown
# 用例标题
**模块:** admin
**标签:** @smoke @regression

## 步骤
1. 打开登录页
2. 输入凭据并登录

## 预期
登录成功，session 有效
```

---

## 7. 常见问题

**Q: `browserType.launch: Executable doesn't exist`**  
A: 运行 `npm run install:browsers` 或 `npx playwright install chromium`

**Q: 看板上没有最新报告**  
A: 执行 `npm run test:ci` 或 `npm run reports:sync`

**Q: AI 功能不可用**  
A: 在 `.env` 中配置 `OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY` 后重启 `platform:dev`

**Q: k6 命令找不到**  
A: macOS：`brew install k6`；Linux 见 [k6 安装文档](https://grafana.com/docs/k6/latest/set-up/install-k6/)

**Q: GitHub push workflow 文件失败**  
A: Personal Access Token 需勾选 `workflow` scope

---

## License

Private — 内部测试平台使用。
