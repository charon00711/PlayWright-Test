import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://mail.711621.xyz/';
const VUS = Number(__ENV.VUS || 10);
const DURATION = __ENV.DURATION || '30s';

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const endpoints = [
    '/',
    '/html/login.html',
  ];

  for (const endpoint of endpoints) {
    const url = `${BASE_URL.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const res = http.get(url, { tags: { endpoint } });
    check(res, {
      [`${endpoint} status 200`]: (r) => r.status >= 200 && r.status < 400,
    });
    sleep(0.5);
  }
}

export function handleSummary(data) {
  const startedAt = new Date(data.state.testRunDurationMs
    ? Date.now() - data.state.testRunDurationMs
    : Date.now()).toISOString();
  const finishedAt = new Date().toISOString();
  const id = `load-${Date.now()}`;

  const httpDuration = data.metrics.http_req_duration?.values ?? {};
  const httpFailed = data.metrics.http_req_failed?.values ?? {};
  const httpReqs = data.metrics.http_reqs?.values ?? {};
  const iterations = data.metrics.iterations?.values ?? {};

  const summary = {
    id,
    startedAt,
    finishedAt,
    baseURL: BASE_URL,
    env: __ENV.TEST_ENV || 'local',
    options: { vus: VUS, duration: DURATION },
    metrics: {
      rps: httpReqs.rate ?? 0,
      p50: httpDuration['p(50)'] ?? 0,
      p95: httpDuration['p(95)'] ?? 0,
      p99: httpDuration['p(99)'] ?? 0,
      avg: httpDuration.avg ?? 0,
      min: httpDuration.min ?? 0,
      max: httpDuration.max ?? 0,
      errorRate: httpFailed.rate ?? 0,
      totalRequests: httpReqs.count ?? 0,
      failedRequests: Math.round((httpFailed.rate ?? 0) * (httpReqs.count ?? 0)),
      vus: VUS,
      duration: DURATION,
      iterations: iterations.count ?? 0,
    },
  };

  return {
    [`reports/perf/${id}.json`]: JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: false }),
  };
}

function textSummary(data, opts) {
  const lines = [
    'k6 load test summary',
    `  checks: ${data.root_group?.checks?.passes ?? 0} passed / ${data.root_group?.checks?.fails ?? 0} failed`,
    `  http_req_duration p95: ${data.metrics.http_req_duration?.values?.['p(95)'] ?? 'n/a'} ms`,
    `  http_reqs: ${data.metrics.http_reqs?.values?.count ?? 0}`,
  ];
  return lines.join('\n') + '\n';
}
