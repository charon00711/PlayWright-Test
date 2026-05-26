import fs from 'fs';
import path from 'path';
import { readJson, slugify, writeJson } from './utils.mjs';

function apiCasesPath(projectRoot) {
  return path.join(projectRoot, 'data', 'api-cases.json');
}

export function readApiCases(projectRoot) {
  return readJson(apiCasesPath(projectRoot), { cases: [] });
}

export function writeApiCases(projectRoot, data) {
  writeJson(apiCasesPath(projectRoot), data);
}

export function findApiCase(projectRoot, id) {
  return readApiCases(projectRoot).cases.find((c) => c.id === id) ?? null;
}

export function interpolateVariables(text, env = {}) {
  if (!text) return text;
  return String(text).replace(/\$\{(\w+)\}/g, (_, key) => {
    const val = env[key];
    return val != null ? String(val) : `\${${key}}`;
  });
}

export function interpolateApiCase(apiCase, env = {}) {
  return {
    ...apiCase,
    url: interpolateVariables(apiCase.url, env),
    headers: (apiCase.headers ?? []).map((h) => ({
      key: interpolateVariables(h.key, env),
      value: interpolateVariables(h.value, env),
    })),
    query: (apiCase.query ?? []).map((q) => ({
      key: interpolateVariables(q.key, env),
      value: interpolateVariables(q.value, env),
    })),
    body: interpolateVariables(apiCase.body, env),
  };
}

function normalizeApiCase(body, existingId) {
  const id =
    existingId ??
    body.id ??
    `${slugify(body.name || 'api-case')}-${Date.now().toString(36).slice(-4)}`;
  return {
    id,
    name: body.name || '未命名接口用例',
    module: body.module || 'smoke',
    tags: body.tags || ['@regression'],
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

export function createApiCaseEntry(projectRoot, body) {
  const data = readApiCases(projectRoot);
  const entry = normalizeApiCase(body);
  if (data.cases.some((c) => c.id === entry.id)) {
    throw new Error(`用例 ID 已存在: ${entry.id}`);
  }
  data.cases.push(entry);
  writeApiCases(projectRoot, data);
  return entry;
}

export function updateApiCaseEntry(projectRoot, id, body) {
  const data = readApiCases(projectRoot);
  const idx = data.cases.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error('Not found');
  const updated = {
    ...data.cases[idx],
    ...body,
    id,
    updatedAt: new Date().toISOString(),
  };
  data.cases[idx] = updated;
  writeApiCases(projectRoot, data);
  return updated;
}

export function deleteApiCaseEntry(projectRoot, id) {
  const data = readApiCases(projectRoot);
  const idx = data.cases.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error('Not found');
  data.cases.splice(idx, 1);
  writeApiCases(projectRoot, data);
}
