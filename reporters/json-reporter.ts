import fs from 'fs';
import path from 'path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { formatRunId } from '../utils/report.js';

type RunTest = {
  title: string;
  file: string;
  module?: string;
  status: string;
  durationMs: number;
  error?: string;
  screenshot?: string;
  video?: string;
  trace?: string;
};

type CaseEntry = {
  title: string;
  module: string;
  specPath: string;
  steps?: string[];
  expected?: string;
};

type BusinessReport = {
  type: 'business';
  caseName: string;
  steps: string[];
  expected: string;
  actual: string;
  status: '通过' | '失败';
  durationMs: number;
  executedAt: string;
  runId: string;
  source: string;
};

type RunReport = {
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
  businessReports: BusinessReport[];
};

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/');
}

function loadCases(): CaseEntry[] {
  const casesPath = path.join(process.cwd(), 'data', 'cases.json');
  if (!fs.existsSync(casesPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(casesPath, 'utf-8')) as {
      cases?: CaseEntry[];
    };
    return data.cases ?? [];
  } catch {
    return [];
  }
}

function findCase(cases: CaseEntry[], file: string) {
  const normalized = normalizePath(file);
  return cases.find((c) => normalizePath(c.specPath) === normalized);
}

class JsonReporter implements Reporter {
  private runId = '';
  private startedAt = new Date();
  private config!: FullConfig;
  private tests: RunTest[] = [];
  private cases: CaseEntry[] = [];

  onBegin(config: FullConfig, _suite: Suite) {
    this.config = config;
    this.startedAt = new Date();
    this.runId = formatRunId(this.startedAt);
    process.env.PW_RUN_ID = this.runId;
    this.cases = loadCases();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const byName = (name: string) =>
      result.attachments.find((a) => a.name === name)?.path;
    const screenshot =
      byName('screenshot') ??
      result.attachments.find((a) => a.contentType?.startsWith('image/'))?.path;

    const file = path.relative(process.cwd(), test.location.file);
    const caseEntry = findCase(this.cases, file);

    this.tests.push({
      title: test.title,
      file,
      module: caseEntry?.module ?? file.match(/tests\/([^/]+)\//)?.[1] ?? 'other',
      status: result.status,
      durationMs: result.duration,
      error: result.error?.message,
      screenshot,
      video: byName('video'),
      trace: byName('trace'),
    });
  }

  onEnd(result: FullResult) {
    const finishedAt = new Date();
    const passed = this.tests.filter((t) => t.status === 'passed').length;
    const failed = this.tests.filter((t) => t.status === 'failed').length;
    const skipped = this.tests.filter((t) => t.status === 'skipped').length;
    const businessReports = this.tests.map((t) => {
      const caseEntry = findCase(this.cases, t.file);
      const passed = t.status === 'passed';
      return {
        type: 'business' as const,
        caseName: caseEntry?.title ?? t.title,
        steps:
          caseEntry?.steps && caseEntry.steps.length > 0
            ? caseEntry.steps
            : [`执行 Playwright 用例：${t.title}`],
        expected: caseEntry?.expected || '用例按脚本执行并符合预期',
        actual: passed
          ? '实际执行通过'
          : t.error
            ? `实际执行失败：${t.error}`
            : `实际执行状态：${t.status}`,
        status: passed ? ('通过' as const) : ('失败' as const),
        durationMs: t.durationMs,
        executedAt: finishedAt.toISOString(),
        runId: this.runId,
        source: t.file,
      };
    });

    const report: RunReport = {
      id: this.runId,
      env: process.env.TEST_ENV ?? 'local',
      baseURL:
        process.env.BASE_URL ??
        (this.config.projects.find((p) => p.name === 'chromium')?.use
          ?.baseURL as string) ??
        '',
      passed,
      failed,
      skipped,
      durationMs: finishedAt.getTime() - this.startedAt.getTime(),
      startedAt: this.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      tests: this.tests,
      playwrightReport: 'playwright-report/index.html',
      businessReports,
    };

    const dir = path.join(process.cwd(), 'reports', 'runs');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${this.runId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');

    void result;
  }
}

export default JsonReporter;
