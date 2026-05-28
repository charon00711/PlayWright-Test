import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { readJson, writeJson } from './utils.mjs';

const loadState = {
  running: false,
  output: '',
  exitCode: null,
};

const vitalsState = {
  running: false,
  output: '',
  exitCode: null,
};

function formatRunId(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function runSyncReports(projectRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/sync-reports.mjs'], {
      cwd: projectRoot,
    });
    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', reject);
  });
}

function perfDir(projectRoot) {
  return path.join(projectRoot, 'reports', 'perf');
}

function listJsonFiles(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .map((name) => path.join(dir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

export function readVitalsReports(projectRoot) {
  const dir = perfDir(projectRoot);
  const files = listJsonFiles(dir, 'vitals-');
  const reports = files
    .map((file) => readJson(file, null))
    .filter(Boolean);
  return { reports };
}

export function readLoadReports(projectRoot) {
  const dir = perfDir(projectRoot);
  const files = listJsonFiles(dir, 'load-');
  const reports = files
    .map((file) => readJson(file, null))
    .filter(Boolean);
  return { reports };
}

export function getLoadStatus() {
  return {
    running: loadState.running,
    output: loadState.output,
    exitCode: loadState.exitCode,
  };
}

export function getVitalsStatus() {
  return {
    running: vitalsState.running,
    output: vitalsState.output,
    exitCode: vitalsState.exitCode,
  };
}

export function spawnVitalsTest(projectRoot, body = {}) {
  return new Promise((resolve, reject) => {
    if (vitalsState.running) {
      reject(new Error('Web Vitals 采集正在运行'));
      return;
    }

    const baseURL = body.baseURL ?? process.env.BASE_URL ?? 'https://wellcoin.711621.xyz/';
    const runId = formatRunId();

    fs.mkdirSync(perfDir(projectRoot), { recursive: true });

    vitalsState.running = true;
    vitalsState.output = '';
    vitalsState.exitCode = null;

    const cmdLine = `npx playwright test tests/perf/web-vitals.spec.ts --project=chromium-guest --grep @perf`;
    vitalsState.output = `$ ${cmdLine}\n`;

    const child = spawn(
      'npx',
      [
        'playwright',
        'test',
        'tests/perf/web-vitals.spec.ts',
        '--project=chromium-guest',
        '--grep',
        '@perf',
      ],
      {
        cwd: projectRoot,
        shell: true,
        env: {
          ...process.env,
          CI: '',
          BASE_URL: baseURL,
          PW_RUN_ID: runId,
          FORCE_COLOR: '1',
          PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? '0',
        },
      },
    );

    child.stdout?.on('data', (d) => {
      vitalsState.output += d.toString();
    });
    child.stderr?.on('data', (d) => {
      vitalsState.output += d.toString();
    });

    child.on('close', (code) => {
      vitalsState.running = false;
      vitalsState.exitCode = code;
      vitalsState.output += '\n正在同步性能报告…\n';
      runSyncReports(projectRoot)
        .then(() => {
          vitalsState.output += '性能报告已同步到 dashboard/public/perf\n';
          resolve(code ?? 1);
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          vitalsState.output += `\n同步失败: ${msg}\n`;
          resolve(code ?? 1);
        });
    });

    child.on('error', (err) => {
      vitalsState.running = false;
      reject(err);
    });
  });
}

export function spawnLoadTest(projectRoot, body = {}) {
  return new Promise((resolve, reject) => {
    if (loadState.running) {
      reject(new Error('负载测试正在运行'));
      return;
    }

    const vus = Number(body.vus ?? process.env.PERF_VUS ?? 10);
    const duration = String(body.duration ?? process.env.PERF_DURATION ?? '30s');
    const baseURL = body.baseURL ?? process.env.BASE_URL ?? 'https://wellcoin.711621.xyz/';

    fs.mkdirSync(perfDir(projectRoot), { recursive: true });

    loadState.running = true;
    loadState.output = '';
    loadState.exitCode = null;

    const child = spawn(
      'k6',
      ['run', 'perf/k6/load-test.js'],
      {
        cwd: projectRoot,
        shell: true,
        env: {
          ...process.env,
          BASE_URL: baseURL,
          VUS: String(vus),
          DURATION: duration,
          TEST_ENV: process.env.TEST_ENV ?? 'local',
        },
      },
    );

    child.stdout?.on('data', (d) => {
      loadState.output += d.toString();
    });
    child.stderr?.on('data', (d) => {
      loadState.output += d.toString();
    });

    child.on('close', (code) => {
      loadState.running = false;
      loadState.exitCode = code;
      resolve(code ?? 1);
    });

    child.on('error', (err) => {
      loadState.running = false;
      reject(err);
    });
  });
}

export function writeLoadReportFromSummary(projectRoot, summary) {
  const dir = perfDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });
  const id = summary.id ?? `load-${Date.now()}`;
  const filePath = path.join(dir, `${id}.json`);
  writeJson(filePath, summary);
  return summary;
}

export async function handlePerfApi(
  projectRoot,
  req,
  res,
  urlPath,
  sendJson,
  parseBody,
) {
  if (urlPath === '/api/perf/vitals' && req.method === 'GET') {
    sendJson(res, 200, readVitalsReports(projectRoot));
    return true;
  }

  if (urlPath === '/api/perf/vitals/status' && req.method === 'GET') {
    sendJson(res, 200, getVitalsStatus());
    return true;
  }

  if (urlPath === '/api/perf/vitals/run' && req.method === 'POST') {
    if (vitalsState.running) {
      sendJson(res, 409, { error: 'Web Vitals 采集正在运行' });
      return true;
    }
    try {
      const body = await parseBody(req);
      spawnVitalsTest(projectRoot, body).catch(() => {});
      sendJson(res, 202, { ok: true, message: 'Web Vitals 采集已启动' });
    } catch (e) {
      sendJson(res, 409, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return true;
  }

  if (urlPath === '/api/perf/load' && req.method === 'GET') {
    sendJson(res, 200, readLoadReports(projectRoot));
    return true;
  }

  if (urlPath === '/api/perf/load/status' && req.method === 'GET') {
    sendJson(res, 200, getLoadStatus());
    return true;
  }

  if (urlPath === '/api/perf/load/run' && req.method === 'POST') {
    if (loadState.running) {
      sendJson(res, 409, { error: '负载测试正在运行' });
      return true;
    }
    try {
      const body = await parseBody(req);
      spawnLoadTest(projectRoot, body).catch(() => {});
      sendJson(res, 202, { ok: true, message: '负载测试已启动' });
    } catch (e) {
      sendJson(res, 409, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return true;
  }

  return false;
}
