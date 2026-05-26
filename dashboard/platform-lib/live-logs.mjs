import fs from 'fs';
import path from 'path';
import { safePath } from './utils.mjs';

const MAX_PLATFORM_API_LOGS = 300;

export function getLiveLogFile(projectRoot) {
  return path.join(projectRoot, 'reports', 'live', 'events.jsonl');
}

export function readFileEvents(projectRoot, { since, limit = 800 } = {}) {
  const file = getLiveLogFile(projectRoot);
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf-8').trim();
  if (!content) return [];

  let events = content
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  if (since) {
    events = events.filter((e) => e.ts > since || e.id > since);
  }

  return events.slice(-limit);
}

export function clearFileEvents(projectRoot) {
  const file = getLiveLogFile(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '', 'utf-8');
}

export function appendFileEvent(projectRoot, event) {
  const file = getLiveLogFile(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    ...event,
  };
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf-8');
  return entry;
}

export function createPlatformApiLogger() {
  const entries = [];

  function log(entry) {
    entries.unshift(entry);
    if (entries.length > MAX_PLATFORM_API_LOGS) {
      entries.length = MAX_PLATFORM_API_LOGS;
    }
  }

  function list({ since, limit = 200 } = {}) {
    let items = entries;
    if (since) {
      items = items.filter((e) => e.ts > since || e.id > since);
    }
    return items.slice(0, limit);
  }

  function clear() {
    entries.length = 0;
  }

  return { log, list, clear };
}

export function listTraceArtifacts(projectRoot) {
  const traces = [];
  const resultsDir = path.join(projectRoot, 'test-results');
  const runsDir = path.join(projectRoot, 'reports', 'runs');

  function walk(dir, prefix = 'test-results') {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full, prefix);
      } else if (name === 'trace.zip' || (name.endsWith('.zip') && full.includes('trace'))) {
        const rel = path.relative(projectRoot, full).split(path.sep).join('/');
        traces.push({
          id: rel,
          name: path.basename(path.dirname(full)),
          path: rel,
          publicPath: `/${rel}`,
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
        });
      }
    }
  }

  walk(resultsDir);

  if (fs.existsSync(runsDir)) {
    for (const file of fs.readdirSync(runsDir)) {
      if (!file.endsWith('.json') || file.includes('-biz') || file === 'index.json') continue;
      try {
        const run = JSON.parse(
          fs.readFileSync(path.join(runsDir, file), 'utf-8'),
        );
        for (const t of run.tests ?? []) {
          if (!t.trace) continue;
          const rel = t.trace.split(path.sep).join('/');
          const full = path.join(projectRoot, rel);
          if (!fs.existsSync(full)) continue;
          const stat = fs.statSync(full);
          traces.push({
            id: `${run.id}-${t.title}`,
            name: `${run.id} · ${t.title}`,
            path: rel,
            publicPath: `/${rel}`,
            size: stat.size,
            updatedAt: stat.mtime.toISOString(),
            runId: run.id,
            testTitle: t.title,
            status: t.status,
          });
        }
      } catch (_) {}
    }
  }

  const seen = new Set();
  return traces
    .filter((t) => {
      if (seen.has(t.path)) return false;
      seen.add(t.path);
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function serveTestArtifact(req, res, next, projectRoot) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (!url.pathname.startsWith('/test-results/')) return next();

  try {
    const subPath = url.pathname.replace(/^\/test-results\/?/, '');
    const filePath = safePath(path.join(projectRoot, 'test-results'), subPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', 'application/zip');
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.statusCode = 500;
    res.end(e instanceof Error ? e.message : String(e));
  }
}
