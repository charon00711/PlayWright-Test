import fs from 'fs';
import path from 'path';
import { readJson, writeJson } from './utils.mjs';
import {
  createApiCaseEntry,
  deleteApiCaseEntry,
  findApiCase,
  interpolateApiCase,
  readApiCases,
  updateApiCaseEntry,
} from './api-cases.mjs';

function apiRunsDir(projectRoot) {
  return path.join(projectRoot, 'reports', 'api-runs');
}

function formatApiRunId(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `apirun-${[
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')}`;
}

export function getByPath(obj, dotPath) {
  if (!dotPath) return obj;
  const parts = dotPath.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function describeAssertion(a) {
  if (a.type === 'status') return `status ${a.op} ${JSON.stringify(a.value)}`;
  if (a.type === 'json') return `json ${a.path} ${a.op}${a.value != null ? ` ${a.value}` : ''}`;
  if (a.type === 'header') return `header ${a.name} ${a.op} ${a.value}`;
  if (a.type === 'body') return `body ${a.op} ${a.value}`;
  if (a.type === 'responseTime') return `responseTime < ${a.value}ms`;
  return 'unknown assertion';
}

export function evaluateAssertions(assertions, ctx) {
  const results = [];
  for (const a of assertions ?? []) {
    const desc = describeAssertion(a);
    let passed = false;
    let message = '';

    try {
      if (a.type === 'status') {
        passed = Array.isArray(a.value)
          ? a.value.includes(ctx.status)
          : ctx.status === a.value;
        if (!passed) message = `expected status ${JSON.stringify(a.value)}, got ${ctx.status}`;
      } else if (a.type === 'json') {
        let json = ctx.json;
        if (json === undefined && ctx.body) {
          try {
            json = JSON.parse(ctx.body);
          } catch {
            json = undefined;
          }
        }
        const v = getByPath(json, a.path);
        if (a.op === 'exists') passed = v !== undefined;
        else if (a.op === 'eq') passed = v === a.value;
        else if (a.op === 'neq') passed = v !== a.value;
        else if (a.op === 'contains') passed = String(v).includes(String(a.value));
        else if (a.op === 'regex') passed = new RegExp(String(a.value)).test(String(v));
        if (!passed) message = `path ${a.path} => ${JSON.stringify(v)}`;
      } else if (a.type === 'header') {
        const headerVal = ctx.headers?.[a.name.toLowerCase()] ?? ctx.headers?.[a.name];
        if (a.op === 'eq') passed = headerVal === a.value;
        else if (a.op === 'contains') passed = String(headerVal ?? '').includes(a.value);
        if (!passed) message = `header ${a.name} => ${headerVal ?? '(missing)'}`;
      } else if (a.type === 'body') {
        if (a.op === 'contains') passed = String(ctx.body ?? '').includes(a.value);
        else if (a.op === 'regex') passed = new RegExp(a.value).test(String(ctx.body ?? ''));
        if (!passed) message = 'body mismatch';
      } else if (a.type === 'responseTime') {
        passed = ctx.durationMs < a.value;
        if (!passed) message = `duration ${ctx.durationMs}ms >= ${a.value}ms`;
      }
    } catch (e) {
      passed = false;
      message = e instanceof Error ? e.message : String(e);
    }

    results.push({ desc, passed, message: passed ? undefined : message });
  }
  return results;
}

function buildHeaders(headerRows) {
  const headers = {};
  for (const row of headerRows ?? []) {
    if (row.key?.trim()) headers[row.key.trim()] = row.value ?? '';
  }
  return headers;
}

function buildUrl(url, queryRows) {
  const u = new URL(url);
  for (const row of queryRows ?? []) {
    if (row.key?.trim()) u.searchParams.set(row.key.trim(), row.value ?? '');
  }
  return u.toString();
}

function buildRequestBody(apiCase) {
  if (apiCase.bodyType === 'none' || !apiCase.body?.trim()) {
    return { body: undefined, headers: {} };
  }
  if (apiCase.bodyType === 'json') {
    return {
      body: apiCase.body,
      headers: { 'Content-Type': 'application/json' },
    };
  }
  if (apiCase.bodyType === 'form') {
    const params = new URLSearchParams();
    for (const line of apiCase.body.split('\n')) {
      const [k, ...rest] = line.split('=');
      if (k?.trim()) params.set(k.trim(), rest.join('='));
    }
    return {
      body: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    };
  }
  return {
    body: apiCase.body,
    headers: { 'Content-Type': 'text/plain' },
  };
}

function headersToObject(headers) {
  const out = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

export async function runApiCase(apiCase, env = {}) {
  const resolved = interpolateApiCase(apiCase, env);
  const started = Date.now();
  const url = buildUrl(resolved.url, resolved.query);
  const reqHeaders = buildHeaders(resolved.headers);
  const { body, headers: bodyHeaders } = buildRequestBody(resolved);
  const finalHeaders = { ...reqHeaders, ...bodyHeaders };

  const request = {
    method: resolved.method,
    url,
    headers: finalHeaders,
    body,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), resolved.timeoutMs ?? 15000);
    const response = await fetch(url, {
      method: resolved.method,
      headers: finalHeaders,
      body: ['GET', 'HEAD'].includes(resolved.method) ? undefined : body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const durationMs = Date.now() - started;
    const responseText = await response.text();
    const responseHeaders = headersToObject(response.headers);
    let json;
    try {
      json = JSON.parse(responseText);
    } catch {
      json = undefined;
    }

    const assertionResults = evaluateAssertions(resolved.assertions, {
      status: response.status,
      headers: responseHeaders,
      body: responseText,
      json,
      durationMs,
    });

    const failed = assertionResults.some((a) => !a.passed);
    return {
      caseId: apiCase.id,
      name: apiCase.name,
      status: failed ? 'failed' : 'passed',
      durationMs,
      request,
      response: {
        status: response.status,
        headers: responseHeaders,
        body: responseText,
        durationMs,
      },
      assertions: assertionResults,
    };
  } catch (e) {
    return {
      caseId: apiCase.id,
      name: apiCase.name,
      status: 'error',
      durationMs: Date.now() - started,
      request,
      assertions: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function summarizeResults(results) {
  return {
    total: results.length,
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    error: results.filter((r) => r.status === 'error').length,
  };
}

export function saveApiRun(projectRoot, results) {
  const startedAt = new Date().toISOString();
  const finishedAt = new Date().toISOString();
  const id = formatApiRunId(new Date());
  const run = {
    id,
    startedAt,
    finishedAt,
    results,
    summary: summarizeResults(results),
  };
  const dir = apiRunsDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, `${id}.json`), run);
  return run;
}

export async function runApiCaseById(projectRoot, id, env) {
  const apiCase = findApiCase(projectRoot, id);
  if (!apiCase) return null;
  const result = await runApiCase(apiCase, env);
  return saveApiRun(projectRoot, [result]);
}

export async function runApiCasesBatch(projectRoot, body, env) {
  const data = readApiCases(projectRoot);
  let cases = data.cases;
  if (body.ids?.length) {
    cases = cases.filter((c) => body.ids.includes(c.id));
  } else if (body.tag) {
    cases = cases.filter((c) => c.tags.includes(body.tag));
  }
  const results = [];
  for (const c of cases) {
    results.push(await runApiCase(c, env));
  }
  return saveApiRun(projectRoot, results);
}

export async function debugApiCase(body, env) {
  const apiCase = normalizeDebugCase(body);
  return runApiCase(apiCase, env);
}

function normalizeDebugCase(body) {
  return {
    id: body.id || 'debug',
    name: body.name || '调试请求',
    module: body.module || 'debug',
    tags: body.tags || [],
    method: body.method || 'GET',
    url: body.url || '${BASE_URL}',
    headers: body.headers || [],
    query: body.query || [],
    body: body.body || '',
    bodyType: body.bodyType || 'none',
    assertions: body.assertions || [],
    timeoutMs: body.timeoutMs ?? 15000,
    updatedAt: new Date().toISOString(),
  };
}

export function listApiRuns(projectRoot) {
  const dir = apiRunsDir(projectRoot);
  if (!fs.existsSync(dir)) return { runs: [] };
  const runs = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(path.join(dir, f), null))
    .filter(Boolean)
    .map((run) => ({
      id: run.id,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      summary: run.summary,
    }))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return { runs };
}

export function readApiRun(projectRoot, id) {
  const file = path.join(apiRunsDir(projectRoot), `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return readJson(file, null);
}

export async function handleApiCasesApi(
  projectRoot,
  req,
  res,
  urlPath,
  sendJson,
  parseBody,
  loadEnvFn,
) {
  const env = loadEnvFn(projectRoot);

  if (urlPath === '/api/api-cases/runs' && req.method === 'GET') {
    sendJson(res, 200, listApiRuns(projectRoot));
    return true;
  }

  const runDetailMatch = urlPath.match(/^\/api\/api-cases\/runs\/([^/]+)$/);
  if (runDetailMatch && req.method === 'GET') {
    const run = readApiRun(projectRoot, runDetailMatch[1]);
    if (!run) {
      sendJson(res, 404, { error: 'Not found' });
      return true;
    }
    sendJson(res, 200, run);
    return true;
  }

  if (urlPath === '/api/api-cases/run' && req.method === 'POST') {
    const body = await parseBody(req);
    const result = await runApiCasesBatch(projectRoot, body, env);
    sendJson(res, 200, result);
    return true;
  }

  if (urlPath === '/api/api-cases/debug' && req.method === 'POST') {
    const body = await parseBody(req);
    const result = await debugApiCase(body, env);
    sendJson(res, 200, result);
    return true;
  }

  if (urlPath === '/api/api-cases' && req.method === 'GET') {
    sendJson(res, 200, readApiCases(projectRoot));
    return true;
  }

  if (urlPath === '/api/api-cases' && req.method === 'POST') {
    const body = await parseBody(req);
    try {
      const entry = createApiCaseEntry(projectRoot, body);
      sendJson(res, 201, entry);
    } catch (e) {
      sendJson(res, 400, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return true;
  }

  const caseMatch = urlPath.match(/^\/api\/api-cases\/([^/]+)$/);
  if (caseMatch) {
    const id = caseMatch[1];

    if (req.method === 'GET') {
      const c = findApiCase(projectRoot, id);
      if (!c) {
        sendJson(res, 404, { error: 'Not found' });
        return true;
      }
      sendJson(res, 200, c);
      return true;
    }

    if (req.method === 'PUT') {
      const body = await parseBody(req);
      try {
        const updated = updateApiCaseEntry(projectRoot, id, body);
        sendJson(res, 200, updated);
      } catch (e) {
        sendJson(res, 404, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return true;
    }

    if (req.method === 'DELETE') {
      try {
        deleteApiCaseEntry(projectRoot, id);
        sendJson(res, 200, { ok: true });
      } catch (e) {
        sendJson(res, 404, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return true;
    }
  }

  const runMatch = urlPath.match(/^\/api\/api-cases\/([^/]+)\/run$/);
  if (runMatch && req.method === 'POST') {
    const result = await runApiCaseById(projectRoot, runMatch[1], env);
    if (!result) {
      sendJson(res, 404, { error: 'Not found' });
      return true;
    }
    sendJson(res, 200, result);
    return true;
  }

  return false;
}
