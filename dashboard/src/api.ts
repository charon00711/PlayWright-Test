import type {
  CasesIndex,
  ImportPreview,
  PlatformConfig,
  RecordStatus,
  RunDetail,
  RunIndex,
  RunStatus,
  Schedule,
  ScheduleHistory,
  ScheduleStatus,
  SchedulesIndex,
  LiveLogEvent,
  LiveLogStatus,
  TraceArtifact,
  AiStatus,
  AiGenerateCaseResult,
  AiFixCaseResult,
  AiBugAnalysisResult,
  TestCase,
  PerfVitalsIndex,
  PerfLoadReport,
  PerfLoadStatus,
  ApiCase,
  ApiCasesIndex,
  ApiRunResult,
  ApiRunsIndex,
  ApiCaseRunResult,
} from './types';

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchConfig(): Promise<PlatformConfig | null> {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// import.meta.env.BASE_URL is '/' in dev and the configured base path in production builds.
const staticBase = import.meta.env.BASE_URL;
const platformApiBase = (import.meta.env.VITE_PLATFORM_API_URL ?? '').replace(/\/$/, '');

function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string' && input.startsWith('/api/') && platformApiBase) {
    return globalThis.fetch(`${platformApiBase}${input}`, init);
  }
  return globalThis.fetch(input, init);
}

export function platformAssetUrl(path: string): string {
  if (!platformApiBase) return path;
  if (!path.startsWith('/')) return `${platformApiBase}/${path}`;
  return `${platformApiBase}${path}`;
}

export async function fetchRunIndex(): Promise<RunIndex> {
  try {
    const res = await fetch('/api/runs');
    if (res.ok) return res.json();
  } catch {
    /* fallback to static */
  }
  const res = await fetch(`${staticBase}runs/index.json`);
  if (!res.ok) return { runs: [], updatedAt: null };
  return res.json();
}

export async function fetchRunDetail(id: string): Promise<RunDetail | null> {
  try {
    const res = await fetch(`/api/runs/${id}`);
    if (res.ok) return res.json();
  } catch {
    /* fallback to static */
  }
  const res = await fetch(`${staticBase}runs/${id}.json`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchCases(): Promise<CasesIndex> {
  try {
    const res = await fetch('/api/cases');
    if (!res.ok) return { cases: [] };
    return res.json();
  } catch {
    return { cases: [] };
  }
}

export async function fetchCase(id: string): Promise<TestCase | null> {
  const res = await fetch(`/api/cases/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createCase(
  body: Partial<TestCase> & { title: string; module: string },
): Promise<TestCase> {
  const res = await fetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateCase(
  id: string,
  body: Partial<TestCase> & { regenerateSpec?: boolean },
): Promise<TestCase> {
  const res = await fetch(`/api/cases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteCase(id: string): Promise<void> {
  const res = await fetch(`/api/cases/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export async function importMarkdown(
  markdown: string,
  mode: 'case' | 'report',
  confirm = false,
): Promise<ImportPreview & { ok?: boolean; case?: TestCase }> {
  const res = await fetch('/api/import/markdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown, mode, confirm }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function startRecord(): Promise<{ outputFile: string }> {
  const res = await fetch('/api/record/start', { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function stopRecord(): Promise<{ outputFile: string | null }> {
  const res = await fetch('/api/record/stop', { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchRecordStatus(): Promise<RecordStatus> {
  const res = await fetch('/api/record/status');
  if (!res.ok) return { running: false, output: '', outputFile: null };
  return res.json();
}

export async function registerRecordedCase(body: {
  title: string;
  outputFile: string;
  steps?: string[];
  expected?: string;
}): Promise<TestCase> {
  const res = await fetch('/api/record/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function startRun(opts?: {
  grep?: 'smoke' | 'regression';
  specPath?: string;
  all?: boolean;
}): Promise<void> {
  let payload: Record<string, unknown> = { grep: 'smoke' };
  if (opts?.all) payload = {};
  else if (opts?.specPath) payload = { specPath: opts.specPath };
  else if (opts?.grep) payload = { grep: opts.grep };

  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchRunJobStatus(): Promise<RunStatus> {
  const res = await fetch('/api/run/status');
  if (!res.ok) return { running: false, output: '', exitCode: null };
  return res.json();
}

export async function fetchBusinessReports(): Promise<{
  reports: import('./types').BusinessReport[];
}> {
  try {
    const res = await fetch('/api/reports/business');
    if (!res.ok) return { reports: [] };
    return res.json();
  } catch {
    return { reports: [] };
  }
}

export async function fetchSchedules(): Promise<SchedulesIndex> {
  try {
    const res = await fetch('/api/schedules');
    if (!res.ok) return { schedules: [], timezone: 'Asia/Shanghai' };
    return res.json();
  } catch {
    return { schedules: [], timezone: 'Asia/Shanghai' };
  }
}

export async function fetchScheduleStatus(): Promise<ScheduleStatus | null> {
  try {
    const res = await fetch('/api/schedules/status');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchScheduleHistory(): Promise<ScheduleHistory> {
  try {
    const res = await fetch('/api/schedules/history');
    if (!res.ok) return { entries: [] };
    return res.json();
  } catch {
    return { entries: [] };
  }
}

export async function createSchedule(
  body: Partial<Schedule> & { name: string },
): Promise<Schedule> {
  const res = await fetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateSchedule(
  id: string,
  body: Partial<Schedule>,
): Promise<Schedule> {
  const res = await fetch(`/api/schedules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteSchedule(id: string): Promise<void> {
  const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export async function runScheduleNow(id: string): Promise<void> {
  const res = await fetch(`/api/schedules/${id}/run`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchLiveLogStatus(): Promise<LiveLogStatus | null> {
  try {
    const res = await fetch('/api/logs/status');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchLiveLogEvents(
  type?: 'console' | 'api' | 'network' | 'trace',
  since?: string | null,
): Promise<{ events: LiveLogEvent[]; cursor: string | null; testRunning: boolean }> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (since) params.set('since', since);
  const qs = params.toString();
  try {
    const res = await fetch(`/api/logs/events${qs ? `?${qs}` : ''}`);
    if (!res.ok) return { events: [], cursor: null, testRunning: false };
    return res.json();
  } catch {
    return { events: [], cursor: null, testRunning: false };
  }
}

export async function fetchLiveTraces(): Promise<{ traces: TraceArtifact[] }> {
  try {
    const res = await fetch('/api/logs/traces');
    if (!res.ok) return { traces: [] };
    return res.json();
  } catch {
    return { traces: [] };
  }
}

export async function clearLiveLogs(): Promise<void> {
  const res = await fetch('/api/logs', { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchAiStatus(): Promise<AiStatus | null> {
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function readApiError(res: Response): Promise<string> {
  try {
    const err = await res.json();
    return err.error || res.statusText;
  } catch {
    return (await res.text()) || res.statusText;
  }
}

export async function aiGenerateCase(body: {
  prompt: string;
  module?: string;
  useAuth?: boolean;
  confirm?: boolean;
}): Promise<AiGenerateCaseResult> {
  const res = await fetch('/api/ai/generate-case', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function aiFixCase(body: {
  caseId: string;
  runId?: string;
  errorHint?: string;
}): Promise<AiFixCaseResult> {
  const res = await fetch('/api/ai/fix-case', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function aiApplyFix(body: {
  caseId: string;
  specPatch: string;
  suggestedSteps?: string[];
  expected?: string;
}): Promise<TestCase> {
  const res = await fetch('/api/ai/apply-fix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const data = await res.json();
  return data.case;
}

export async function aiAnalyzeBug(body: {
  runId: string;
  testTitle?: string;
}): Promise<AiBugAnalysisResult> {
  const res = await fetch('/api/ai/analyze-bug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function aiChat(body: {
  message: string;
  history?: { role: string; content: string }[];
}): Promise<{ text: string; provider: string; model: string }> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function fetchPerfVitals(): Promise<PerfVitalsIndex> {
  try {
    const res = await fetch('/api/perf/vitals');
    if (res.ok) return res.json();
  } catch {
    /* fallback to static */
  }
  const res = await fetch(`${staticBase}perf/vitals-index.json`);
  if (!res.ok) return { reports: [] };
  return res.json();
}

export async function fetchPerfLoad(): Promise<PerfLoadReport> {
  try {
    const res = await fetch('/api/perf/load');
    if (res.ok) return res.json();
  } catch {
    /* fallback to static */
  }
  const res = await fetch(`${staticBase}perf/load-index.json`);
  if (!res.ok) return { reports: [] };
  return res.json();
}

export async function fetchPerfLoadStatus(): Promise<PerfLoadStatus | null> {
  try {
    const res = await fetch('/api/perf/load/status');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function triggerLoadTest(body?: {
  vus?: number;
  duration?: string;
  baseURL?: string;
}): Promise<void> {
  const res = await fetch('/api/perf/load/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(await readApiError(res));
}

export async function fetchApiCases(): Promise<ApiCasesIndex> {
  try {
    const res = await fetch('/api/api-cases');
    if (res.ok) return res.json();
  } catch {
    /* fallback */
  }
  const res = await fetch(`${staticBase}api-cases.json`);
  if (!res.ok) return { cases: [] };
  return res.json();
}

export async function fetchApiCase(id: string): Promise<ApiCase | null> {
  const res = await fetch(`/api/api-cases/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createApiCase(
  body: Partial<ApiCase> & { name: string },
): Promise<ApiCase> {
  const res = await fetch('/api/api-cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function updateApiCase(
  id: string,
  body: Partial<ApiCase>,
): Promise<ApiCase> {
  const res = await fetch(`/api/api-cases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function deleteApiCase(id: string): Promise<void> {
  const res = await fetch(`/api/api-cases/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readApiError(res));
}

export async function runApiCase(id: string): Promise<ApiRunResult> {
  const res = await fetch(`/api/api-cases/${id}/run`, { method: 'POST' });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function runApiCasesBatch(opts?: {
  ids?: string[];
  tag?: string;
}): Promise<ApiRunResult> {
  const res = await fetch('/api/api-cases/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts ?? {}),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function debugApiCase(
  body: Partial<ApiCase>,
): Promise<ApiCaseRunResult> {
  const res = await fetch('/api/api-cases/debug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function fetchApiRuns(): Promise<ApiRunsIndex> {
  try {
    const res = await fetch('/api/api-cases/runs');
    if (res.ok) return res.json();
  } catch {
    /* fallback */
  }
  const res = await fetch(`${staticBase}api-runs/index.json`);
  if (!res.ok) return { runs: [] };
  return res.json();
}

export async function fetchApiRunDetail(id: string): Promise<ApiRunResult | null> {
  try {
    const res = await fetch(`/api/api-cases/runs/${id}`);
    if (res.ok) return res.json();
  } catch {
    /* fallback */
  }
  const res = await globalThis.fetch(`${staticBase}api-runs/${id}.json`);
  if (!res.ok) return null;
  return res.json();
}
