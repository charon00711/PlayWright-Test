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
