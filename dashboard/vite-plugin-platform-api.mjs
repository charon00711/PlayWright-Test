import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { parseMarkdownCase } from './platform-lib/markdown-parser.mjs';
import { generateSpec, getSpecPath } from './platform-lib/spec-generator.mjs';
import {
  createScheduleManager,
  enrichSchedule,
  readHistory,
  readSchedules,
  triggerToCron,
  validateCronExpression,
  writeSchedules,
} from './platform-lib/scheduler.mjs';
import {
  appendFileEvent,
  clearFileEvents,
  createPlatformApiLogger,
  listTraceArtifacts,
  readFileEvents,
  serveTestArtifact,
} from './platform-lib/live-logs.mjs';
import {
  applyAiFix,
  handleAiAnalyzeBug,
  handleAiChat,
  handleAiFixCase,
  handleAiGenerateCase,
  handleAiStatus,
} from './platform-lib/ai-handlers.mjs';
import { handlePerfApi } from './platform-lib/perf-handlers.mjs';
import { handleApiCasesApi } from './platform-lib/api-runner.mjs';
import {
  loadEnv,
  parseBody,
  readJson,
  safePath,
  sendJson,
  slugify,
  writeJson,
} from './platform-lib/utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const state = {
  record: { running: false, pid: null, output: '', outputFile: null },
  run: { running: false, output: '', exitCode: null },
};

let scheduleManager = null;
const platformApiLogger = createPlatformApiLogger();

function appendProcessLog(message, level = 'info') {
  appendFileEvent(PROJECT_ROOT, {
    type: 'process',
    level,
    message,
    source: 'playwright',
  });
}

function spawnTestRun(body, runState) {
  return new Promise((resolve, reject) => {
    if (runState.running) {
      reject(new Error('测试正在运行'));
      return;
    }
    clearFileEvents(PROJECT_ROOT);
    appendProcessLog('测试任务启动');
    const args = ['run', 'test:ci'];
    if (body.grep === 'smoke') args[1] = 'test:smoke';
    if (body.grep === 'regression') args[1] = 'test:regression';
    if (body.specPath) {
      args.length = 0;
      args.push('exec', 'playwright', 'test', body.specPath);
    }
    const child = spawn('npm', args, {
      cwd: PROJECT_ROOT,
      shell: true,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0', CI: '' },
    });
    runState.running = true;
    runState.output = '';
    runState.exitCode = null;
    child.stdout?.on('data', (d) => {
      const text = d.toString();
      runState.output += text;
      for (const line of text.split('\n').filter(Boolean)) {
        appendProcessLog(line);
      }
    });
    child.stderr?.on('data', (d) => {
      const text = d.toString();
      runState.output += text;
      for (const line of text.split('\n').filter(Boolean)) {
        appendProcessLog(line, 'error');
      }
    });
    child.on('close', (code) => {
      runState.running = false;
      runState.exitCode = code;
      appendProcessLog(`测试结束，退出码 ${code ?? 1}`);
      spawn('node', ['scripts/sync-reports.mjs'], {
        cwd: PROJECT_ROOT,
        shell: true,
      });
      resolve(code ?? 1);
    });
    child.on('error', (err) => {
      runState.running = false;
      reject(err);
    });
  });
}

function initScheduleManager() {
  if (scheduleManager) return scheduleManager;
  scheduleManager = createScheduleManager(PROJECT_ROOT, state, (body) =>
    spawnTestRun(body, state),
  );
  scheduleManager.reload();
  return scheduleManager;
}

function readCases() {
  const casesPath = path.join(PROJECT_ROOT, 'data', 'cases.json');
  return readJson(casesPath, { cases: [] });
}

function writeCases(data) {
  writeJson(path.join(PROJECT_ROOT, 'data', 'cases.json'), data);
}

function listBusinessReports() {
  const runsDir = path.join(PROJECT_ROOT, 'reports', 'runs');
  const reports = [];
  if (!fs.existsSync(runsDir)) return reports;
  for (const file of fs.readdirSync(runsDir)) {
    if (file.endsWith('-biz.json')) {
      const runId = file.replace('-biz.json', '');
      const items = readJson(path.join(runsDir, file), []);
      for (const item of items) {
        reports.push({ ...item, runId, source: file });
      }
    }
  }
  return reports.sort(
    (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime(),
  );
}

async function handleApi(req, res, urlPath) {
  const config = loadEnv(PROJECT_ROOT);

  if (urlPath === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, mode: 'local-api' });
  }

  if (urlPath === '/api/config' && req.method === 'GET') {
    return sendJson(res, 200, config);
  }

  if (urlPath === '/api/cases' && req.method === 'GET') {
    return sendJson(res, 200, readCases());
  }

  if (urlPath === '/api/cases' && req.method === 'POST') {
    const body = await parseBody(req);
    const data = readCases();
    const id = body.id || slugify(body.title) + '-' + Date.now().toString(36).slice(-4);
    const module = body.module || 'smoke';
    const specPath = getSpecPath(module, id);
    const specFull = safePath(PROJECT_ROOT, specPath);
    fs.mkdirSync(path.dirname(specFull), { recursive: true });
    fs.writeFileSync(specFull, generateSpec({ ...body, title: body.title }), 'utf-8');
    const entry = {
      id,
      title: body.title,
      module,
      tags: body.tags || ['@regression'],
      specPath,
      steps: body.steps || [],
      expected: body.expected || '',
      useAuth: body.useAuth !== false,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    data.cases.push(entry);
    writeCases(data);
    return sendJson(res, 201, entry);
  }

  const caseMatch = urlPath.match(/^\/api\/cases\/([^/]+)$/);
  if (caseMatch && req.method === 'GET') {
    const c = readCases().cases.find((x) => x.id === caseMatch[1]);
    if (!c) return sendJson(res, 404, { error: 'Not found' });
    return sendJson(res, 200, c);
  }

  if (caseMatch && req.method === 'PUT') {
    const body = await parseBody(req);
    const data = readCases();
    const idx = data.cases.findIndex((x) => x.id === caseMatch[1]);
    if (idx < 0) return sendJson(res, 404, { error: 'Not found' });
    const updated = {
      ...data.cases[idx],
      ...body,
      id: caseMatch[1],
      updatedAt: new Date().toISOString(),
    };
    data.cases[idx] = updated;
    if (body.regenerateSpec) {
      const specFull = safePath(PROJECT_ROOT, updated.specPath);
      fs.writeFileSync(specFull, generateSpec(updated), 'utf-8');
    }
    writeCases(data);
    return sendJson(res, 200, updated);
  }

  if (caseMatch && req.method === 'DELETE') {
    const data = readCases();
    const idx = data.cases.findIndex((x) => x.id === caseMatch[1]);
    if (idx < 0) return sendJson(res, 404, { error: 'Not found' });
    const [removed] = data.cases.splice(idx, 1);
    writeCases(data);
    try {
      const specFull = safePath(PROJECT_ROOT, removed.specPath);
      if (fs.existsSync(specFull)) fs.unlinkSync(specFull);
    } catch (_) {}
    return sendJson(res, 200, { ok: true });
  }

  if (urlPath === '/api/import/markdown' && req.method === 'POST') {
    const body = await parseBody(req);
    const preview = parseMarkdownCase(body.markdown || '', body.mode || 'case');
    if (!body.confirm) {
      return sendJson(res, 200, { preview });
    }
    if (preview.type === 'report') {
      const archivePath = path.join(
        PROJECT_ROOT,
        'reports',
        `imported-${Date.now()}.md`,
      );
      fs.writeFileSync(archivePath, body.markdown, 'utf-8');
      return sendJson(res, 200, { ok: true, type: 'report', path: archivePath });
    }
    const data = readCases();
    const id = slugify(preview.title) + '-' + Date.now().toString(36).slice(-4);
    const specPath = getSpecPath(preview.module, id);
    const caseEntry = {
      id,
      title: preview.title,
      module: preview.module,
      tags: preview.tags,
      specPath,
      steps: preview.steps,
      expected: preview.expected,
      useAuth: preview.useAuth,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(safePath(PROJECT_ROOT, specPath)), { recursive: true });
    fs.writeFileSync(
      safePath(PROJECT_ROOT, specPath),
      generateSpec(caseEntry),
      'utf-8',
    );
    data.cases.push(caseEntry);
    writeCases(data);
    return sendJson(res, 201, { ok: true, case: caseEntry });
  }

  if (urlPath === '/api/record/status' && req.method === 'GET') {
    return sendJson(res, 200, {
      running: state.record.running,
      output: state.record.output.slice(-8000),
      outputFile: state.record.outputFile,
    });
  }

  if (urlPath === '/api/record/start' && req.method === 'POST') {
    if (state.record.running) {
      return sendJson(res, 400, { error: '录制已在进行中' });
    }
    const ts = Date.now();
    const outDir = safePath(PROJECT_ROOT, 'tests/recorded');
    fs.mkdirSync(outDir, { recursive: true });
    const outputFile = `tests/recorded/rec-${ts}.spec.ts`;
    const outputFull = safePath(PROJECT_ROOT, outputFile);
    const baseURL = config.BASE_URL || 'https://mail.711621.xyz/';
    const child = spawn(
      'npx',
      ['playwright', 'codegen', baseURL, '--output', outputFull],
      { cwd: PROJECT_ROOT, shell: true, env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' } },
    );
    state.record.running = true;
    state.record.pid = child.pid;
    state.record.output = '';
    state.record.outputFile = outputFile;
    child.stdout?.on('data', (d) => {
      state.record.output += d.toString();
    });
    child.stderr?.on('data', (d) => {
      state.record.output += d.toString();
    });
    child.on('close', () => {
      state.record.running = false;
      state.record.pid = null;
    });
    return sendJson(res, 200, { ok: true, outputFile, pid: child.pid });
  }

  if (urlPath === '/api/record/stop' && req.method === 'POST') {
    if (state.record.pid) {
      try {
        process.kill(state.record.pid, 'SIGTERM');
      } catch (_) {}
    }
    state.record.running = false;
    state.record.pid = null;
    return sendJson(res, 200, {
      ok: true,
      outputFile: state.record.outputFile,
    });
  }

  if (urlPath === '/api/record/register' && req.method === 'POST') {
    const body = await parseBody(req);
    const outputFile = body.outputFile || state.record.outputFile;
    if (!outputFile) return sendJson(res, 400, { error: '无录制文件' });
    const data = readCases();
    const id = `recorded-${Date.now().toString(36).slice(-6)}`;
    const entry = {
      id,
      title: body.title || '录制用例',
      module: 'recorded',
      tags: ['@regression'],
      specPath: outputFile,
      steps: body.steps || ['见录制脚本'],
      expected: body.expected || '待补充',
      useAuth: true,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };
    data.cases.push(entry);
    writeCases(data);
    return sendJson(res, 201, entry);
  }

  if (urlPath === '/api/run/status' && req.method === 'GET') {
    return sendJson(res, 200, {
      running: state.run.running,
      output: state.run.output.slice(-12000),
      exitCode: state.run.exitCode,
    });
  }

  if (urlPath === '/api/run' && req.method === 'POST') {
    if (state.run.running) {
      return sendJson(res, 400, { error: '测试正在运行' });
    }
    const body = await parseBody(req);
    spawnTestRun(body, state).catch(() => {});
    return sendJson(res, 200, { ok: true, started: true });
  }

  if (urlPath === '/api/schedules' && req.method === 'GET') {
    initScheduleManager();
    const data = readSchedules(PROJECT_ROOT);
    return sendJson(res, 200, {
      schedules: data.schedules.map(enrichSchedule),
      timezone: process.env.SCHEDULER_TZ || 'Asia/Shanghai',
    });
  }

  if (urlPath === '/api/schedules/status' && req.method === 'GET') {
    initScheduleManager();
    const data = readSchedules(PROJECT_ROOT);
    const enabled = data.schedules.filter((s) => s.enabled);
    const nextRuns = enabled
      .map((s) => ({
        id: s.id,
        name: s.name,
        nextRunAt: enrichSchedule(s).nextRunAt,
      }))
      .filter((x) => x.nextRunAt)
      .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime());
    return sendJson(res, 200, {
      active: true,
      timezone: process.env.SCHEDULER_TZ || 'Asia/Shanghai',
      enabledCount: enabled.length,
      nextRun: nextRuns[0] || null,
      testRunning: state.run.running,
    });
  }

  if (urlPath === '/api/schedules/history' && req.method === 'GET') {
    const data = readHistory(PROJECT_ROOT);
    return sendJson(res, 200, data);
  }

  if (urlPath === '/api/schedules' && req.method === 'POST') {
    const body = await parseBody(req);
    const trigger = body.trigger || { type: 'daily', time: '02:00' };
    const cronExpr = triggerToCron(trigger);
    if (!cronExpr || !validateCronExpression(cronExpr)) {
      return sendJson(res, 400, { error: '无效的 Cron 表达式或每日时间' });
    }
    const data = readSchedules(PROJECT_ROOT);
    const id = body.id || slugify(body.name || 'schedule') + '-' + Date.now().toString(36).slice(-4);
    const entry = {
      id,
      name: body.name || '未命名任务',
      enabled: body.enabled !== false,
      trigger,
      target: body.target || { mode: 'grep', tag: 'regression' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRunAt: null,
      lastRunStatus: null,
      lastRunExitCode: null,
    };
    data.schedules.push(entry);
    writeSchedules(PROJECT_ROOT, data);
    initScheduleManager().reload();
    return sendJson(res, 201, enrichSchedule(entry));
  }

  const scheduleMatch = urlPath.match(/^\/api\/schedules\/([^/]+)(\/run)?$/);
  if (scheduleMatch && req.method === 'PUT') {
    const body = await parseBody(req);
    const data = readSchedules(PROJECT_ROOT);
    const idx = data.schedules.findIndex((x) => x.id === scheduleMatch[1]);
    if (idx < 0) return sendJson(res, 404, { error: 'Not found' });
    const trigger = body.trigger ?? data.schedules[idx].trigger;
    const cronExpr = triggerToCron(trigger);
    if (!cronExpr || !validateCronExpression(cronExpr)) {
      return sendJson(res, 400, { error: '无效的 Cron 表达式或每日时间' });
    }
    const updated = {
      ...data.schedules[idx],
      ...body,
      id: scheduleMatch[1],
      trigger,
      updatedAt: new Date().toISOString(),
    };
    data.schedules[idx] = updated;
    writeSchedules(PROJECT_ROOT, data);
    initScheduleManager().reload();
    return sendJson(res, 200, enrichSchedule(updated));
  }

  if (scheduleMatch && scheduleMatch[2] === '/run' && req.method === 'POST') {
    initScheduleManager();
    const result = await scheduleManager.runScheduledJob(scheduleMatch[1], 'manual');
    if (!result.ok) {
      return sendJson(res, result.error === '已有测试在运行' ? 409 : 404, {
        error: result.error,
      });
    }
    return sendJson(res, 200, result);
  }

  if (scheduleMatch && !scheduleMatch[2] && req.method === 'DELETE') {
    const data = readSchedules(PROJECT_ROOT);
    const idx = data.schedules.findIndex((x) => x.id === scheduleMatch[1]);
    if (idx < 0) return sendJson(res, 404, { error: 'Not found' });
    data.schedules.splice(idx, 1);
    writeSchedules(PROJECT_ROOT, data);
    initScheduleManager().reload();
    return sendJson(res, 200, { ok: true });
  }

  if (urlPath === '/api/reports/business' && req.method === 'GET') {
    return sendJson(res, 200, { reports: listBusinessReports() });
  }

  if (urlPath === '/api/logs/status' && req.method === 'GET') {
    const events = readFileEvents(PROJECT_ROOT, { limit: 5000 });
    return sendJson(res, 200, {
      testRunning: state.run.running,
      exitCode: state.run.exitCode,
      counts: {
        console: events.filter((e) => e.type === 'console' || e.type === 'process').length,
        api:
          events.filter((e) => e.type === 'api').length +
          platformApiLogger.list().length,
        network: events.filter((e) => e.type === 'network').length,
        trace: listTraceArtifacts(PROJECT_ROOT).length,
      },
      processOutput: state.run.output.slice(-8000),
    });
  }

  if (urlPath === '/api/logs/events' && req.method === 'GET') {
    const reqUrl = new URL(req.url || '/', 'http://localhost');
    const since = reqUrl.searchParams.get('since') || undefined;
    const type = reqUrl.searchParams.get('type') || undefined;
    const fileEvents = readFileEvents(PROJECT_ROOT, { since, limit: 2000 });
    const platformEvents = platformApiLogger.list({ since });
    let events = [...platformEvents, ...fileEvents].sort((a, b) =>
      a.ts.localeCompare(b.ts),
    );
    if (type === 'console') {
      events = events.filter((e) => e.type === 'console' || e.type === 'process');
    } else if (type === 'api') {
      events = events.filter((e) => e.type === 'api');
    } else if (type === 'network') {
      events = events.filter((e) => e.type === 'network');
    } else if (type === 'trace') {
      events = events.filter((e) => e.type === 'trace');
    }
    const cursor = events.at(-1)?.ts ?? since ?? null;
    return sendJson(res, 200, { events, cursor, testRunning: state.run.running });
  }

  if (urlPath === '/api/logs/traces' && req.method === 'GET') {
    return sendJson(res, 200, { traces: listTraceArtifacts(PROJECT_ROOT) });
  }

  if (urlPath === '/api/logs' && req.method === 'DELETE') {
    clearFileEvents(PROJECT_ROOT);
    platformApiLogger.clear();
    return sendJson(res, 200, { ok: true });
  }

  if (urlPath === '/api/ai/status' && req.method === 'GET') {
    return sendJson(res, 200, handleAiStatus(PROJECT_ROOT));
  }

  if (urlPath === '/api/ai/generate-case' && req.method === 'POST') {
    const body = await parseBody(req);
    const result = await handleAiGenerateCase(PROJECT_ROOT, body, {
      readCases,
      writeCases,
    });
    return sendJson(res, body.confirm ? 201 : 200, result);
  }

  if (urlPath === '/api/ai/fix-case' && req.method === 'POST') {
    const body = await parseBody(req);
    const result = await handleAiFixCase(PROJECT_ROOT, body);
    return sendJson(res, 200, result);
  }

  if (urlPath === '/api/ai/apply-fix' && req.method === 'POST') {
    const body = await parseBody(req);
    const updated = applyAiFix(PROJECT_ROOT, body, { readCases, writeCases });
    return sendJson(res, 200, { ok: true, case: updated });
  }

  if (urlPath === '/api/ai/analyze-bug' && req.method === 'POST') {
    const body = await parseBody(req);
    const result = await handleAiAnalyzeBug(PROJECT_ROOT, body);
    return sendJson(res, 200, result);
  }

  if (urlPath === '/api/ai/chat' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await handleAiChat(PROJECT_ROOT, body);
      return sendJson(res, 200, result);
    } catch (e) {
      return sendJson(res, 400, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const perfHandled = await handlePerfApi(
    PROJECT_ROOT,
    req,
    res,
    urlPath,
    sendJson,
    parseBody,
  );
  if (perfHandled) return;

  const apiCasesHandled = await handleApiCasesApi(
    PROJECT_ROOT,
    req,
    res,
    urlPath,
    sendJson,
    parseBody,
    loadEnv,
  );
  if (apiCasesHandled) return;

  return sendJson(res, 404, { error: 'Not found' });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
};

function servePlaywrightReport(req, res, next) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (!url.pathname.startsWith('/playwright-report')) return next();

  try {
    const reportDir = path.join(PROJECT_ROOT, 'playwright-report');
    let subPath = url.pathname.replace(/^\/playwright-report\/?/, '') || 'index.html';
    let filePath = safePath(reportDir, subPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(
        'Playwright HTML 报告不存在。请先运行：npm run test:ci 或 npm run report',
      );
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(e instanceof Error ? e.message : String(e));
  }
}

export function platformApiPlugin() {
  return {
    name: 'platform-api',
    configureServer(server) {
      initScheduleManager();
      server.middlewares.use(servePlaywrightReport);
      server.middlewares.use((req, res, next) =>
        serveTestArtifact(req, res, next, PROJECT_ROOT),
      );
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        const startedAt = Date.now();
        const originalEnd = res.end.bind(res);
        res.end = (...args) => {
          if (!url.pathname.startsWith('/api/logs')) {
            platformApiLogger.log({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              ts: new Date().toISOString(),
              type: 'api',
              source: 'platform',
              method: req.method || 'GET',
              url: url.pathname,
              status: res.statusCode,
              durationMs: Date.now() - startedAt,
              message: `${req.method} ${url.pathname} → ${res.statusCode}`,
            });
          }
          return originalEnd(...args);
        };
        try {
          await handleApi(req, res, url.pathname);
        } catch (e) {
          sendJson(res, 500, {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(servePlaywrightReport);
      server.middlewares.use((req, res, next) =>
        serveTestArtifact(req, res, next, PROJECT_ROOT),
      );
    },
  };
}
