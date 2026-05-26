import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { readJson, writeJson } from './utils.mjs';

const loadState = {
  running: false,
  output: '',
  exitCode: null,
};

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

export function spawnLoadTest(projectRoot, body = {}) {
  return new Promise((resolve, reject) => {
    if (loadState.running) {
      reject(new Error('负载测试正在运行'));
      return;
    }

    const vus = Number(body.vus ?? process.env.PERF_VUS ?? 10);
    const duration = String(body.duration ?? process.env.PERF_DURATION ?? '30s');
    const baseURL = body.baseURL ?? process.env.BASE_URL ?? 'https://mail.711621.xyz/';

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
