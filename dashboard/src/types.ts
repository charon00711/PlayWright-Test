export type RunSummary = {
  id: string;
  env: string;
  baseURL: string;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  startedAt: string;
  reportPath: string;
};

export type RunIndex = {
  runs: RunSummary[];
  updatedAt: string | null;
};

export type RunTest = {
  title: string;
  file: string;
  status: string;
  durationMs: number;
  error?: string;
  screenshot?: string;
  screenshotPublic?: string;
  video?: string;
  trace?: string;
};

export type BusinessReport = {
  type: 'business';
  caseName: string;
  steps: string[];
  expected: string;
  actual: string;
  status: '通过' | '失败';
  durationMs: number;
  executedAt: string;
  runId?: string;
  source?: string;
};

export type RunDetail = {
  id: string;
  env: string;
  baseURL: string;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
  tests: RunTest[];
  playwrightReport: string;
  businessReports?: BusinessReport[];
};

export type TestCase = {
  id: string;
  title: string;
  module: string;
  tags: string[];
  specPath: string;
  steps: string[];
  expected: string;
  useAuth: boolean;
  status: string;
  updatedAt: string;
};

export type CasesIndex = {
  cases: TestCase[];
};

export type PlatformConfig = {
  BASE_URL: string;
  TEST_ENV?: string;
};

export type RecordStatus = {
  running: boolean;
  output: string;
  outputFile: string | null;
};

export type RunStatus = {
  running: boolean;
  output: string;
  exitCode: number | null;
};

export type ScheduleTrigger =
  | { type: 'daily'; time: string }
  | { type: 'cron'; expression: string };

export type ScheduleTarget =
  | { mode: 'all' }
  | { mode: 'grep'; tag: 'smoke' | 'regression' }
  | { mode: 'spec'; specPath: string };

export type Schedule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: ScheduleTrigger;
  target: ScheduleTarget;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  lastRunStatus?: 'success' | 'failed' | 'skipped' | null;
  lastRunExitCode?: number | null;
  cronExpression?: string | null;
  cronValid?: boolean;
  nextRunAt?: string | null;
};

export type SchedulesIndex = {
  schedules: Schedule[];
  timezone: string;
};

export type ScheduleStatus = {
  active: boolean;
  timezone: string;
  enabledCount: number;
  nextRun: { id: string; name: string; nextRunAt: string } | null;
  testRunning: boolean;
};

export type ScheduleHistoryEntry = {
  id: string;
  scheduleId: string;
  scheduleName: string;
  startedAt: string;
  finishedAt?: string;
  exitCode: number | null;
  status: 'success' | 'failed' | 'skipped';
  trigger: 'scheduled' | 'manual';
  message?: string;
  output?: string;
};

export type ScheduleHistory = {
  entries: ScheduleHistoryEntry[];
};

export type LiveLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export type LiveLogEvent = {
  id: string;
  ts: string;
  type: 'console' | 'api' | 'network' | 'process' | 'trace';
  level?: LiveLogLevel;
  test?: string;
  message?: string;
  method?: string;
  url?: string;
  status?: number;
  durationMs?: number;
  resourceType?: string;
  tracePath?: string;
  source?: 'browser' | 'platform' | 'playwright';
};

export type TraceArtifact = {
  id: string;
  name: string;
  path: string;
  publicPath: string;
  size: number;
  updatedAt: string;
  runId?: string;
  testTitle?: string;
  status?: string;
};

export type LiveLogStatus = {
  testRunning: boolean;
  exitCode: number | null;
  counts: {
    console: number;
    api: number;
    network: number;
    trace: number;
  };
  processOutput: string;
};

export type AiStatus = {
  configured: boolean;
  provider: string;
  model: string;
};

export type AiCasePreview = {
  title: string;
  module: string;
  tags: string[];
  steps: string[];
  expected: string;
  useAuth: boolean;
};

export type AiGenerateCaseResult = {
  preview: AiCasePreview;
  specCode: string;
  explanation: string;
  ok?: boolean;
  case?: TestCase;
};

export type AiFixCaseResult = {
  diagnosis: string;
  suggestedSteps: string[];
  specPatch: string;
  confidence: 'high' | 'medium' | 'low';
  caseId: string;
};

export type AiBugAnalysisResult = {
  summary: string;
  rootCause: string;
  reproSteps: string[];
  fixSuggestions: string[];
  relatedLogs: string[];
  markdown: string;
  runId: string;
  testTitle: string | null;
};

export type ImportPreview = {
  preview: ParsedCasePreview | ParsedReportPreview;
};

export type ParsedCasePreview = {
  type: 'case';
  title: string;
  module: string;
  tags: string[];
  steps: string[];
  expected: string;
  useAuth: boolean;
};

export type ParsedReportPreview = {
  type: 'report';
  caseName: string;
  steps: string[];
  expected: string;
  actual: string;
  status: '通过' | '失败';
};

export type WebVitalsMetrics = {
  lcp?: number;
  fcp?: number;
  cls?: number;
  ttfb?: number;
  tti?: number;
  domContentLoaded?: number;
  loadEvent?: number;
};

export type WebVitalsEntry = {
  testTitle: string;
  url: string;
  metrics: WebVitalsMetrics;
  collectedAt: string;
  status: 'passed' | 'failed' | 'skipped';
};

export type PerfVitalsReport = {
  id: string;
  runId: string;
  env: string;
  baseURL: string;
  startedAt: string;
  finishedAt: string;
  entries: WebVitalsEntry[];
};

export type PerfVitalsIndex = {
  reports: PerfVitalsReport[];
};

export type LoadTestMetrics = {
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
  errorRate: number;
  totalRequests: number;
  failedRequests: number;
  vus: number;
  duration: string;
};

export type LoadTestEntry = {
  id: string;
  startedAt: string;
  finishedAt: string;
  baseURL: string;
  env: string;
  options: { vus: number; duration: string };
  metrics: LoadTestMetrics;
};

export type PerfLoadReport = {
  reports: LoadTestEntry[];
};

export type PerfLoadStatus = {
  running: boolean;
  output: string;
  exitCode: number | null;
};

export type KeyValuePair = {
  key: string;
  value: string;
};

export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiBodyType = 'none' | 'json' | 'form' | 'text';

export type Assertion =
  | { type: 'status'; op: 'eq' | 'in'; value: number | number[] }
  | {
      type: 'json';
      path: string;
      op: 'eq' | 'neq' | 'contains' | 'exists' | 'regex';
      value?: string | number | boolean;
    }
  | { type: 'header'; name: string; op: 'eq' | 'contains'; value: string }
  | { type: 'body'; op: 'contains' | 'regex'; value: string }
  | { type: 'responseTime'; op: 'lt'; value: number };

export type ApiCase = {
  id: string;
  name: string;
  module: string;
  tags: string[];
  method: ApiHttpMethod;
  url: string;
  headers: KeyValuePair[];
  query: KeyValuePair[];
  body: string;
  bodyType: ApiBodyType;
  assertions: Assertion[];
  timeoutMs?: number;
  updatedAt: string;
};

export type ApiCasesIndex = {
  cases: ApiCase[];
};

export type ApiAssertionResult = {
  desc: string;
  passed: boolean;
  message?: string;
};

export type ApiCaseRunResult = {
  caseId: string;
  name: string;
  status: 'passed' | 'failed' | 'error';
  durationMs: number;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    body: string;
    durationMs: number;
  };
  assertions: ApiAssertionResult[];
  error?: string;
};

export type ApiRunResult = {
  id: string;
  startedAt: string;
  finishedAt: string;
  results: ApiCaseRunResult[];
  summary: { total: number; passed: number; failed: number; error: number };
};

export type ApiRunSummary = {
  id: string;
  startedAt: string;
  finishedAt: string;
  summary: ApiRunResult['summary'];
};

export type ApiRunsIndex = {
  runs: ApiRunSummary[];
};
