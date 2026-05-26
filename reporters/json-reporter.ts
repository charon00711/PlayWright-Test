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
  status: string;
  durationMs: number;
  error?: string;
  screenshot?: string;
  video?: string;
  trace?: string;
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
};

class JsonReporter implements Reporter {
  private runId = '';
  private startedAt = new Date();
  private config!: FullConfig;
  private tests: RunTest[] = [];

  onBegin(config: FullConfig, _suite: Suite) {
    this.config = config;
    this.startedAt = new Date();
    this.runId = formatRunId(this.startedAt);
    process.env.PW_RUN_ID = this.runId;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const byName = (name: string) =>
      result.attachments.find((a) => a.name === name)?.path;
    const screenshot =
      byName('screenshot') ??
      result.attachments.find((a) => a.contentType?.startsWith('image/'))?.path;

    this.tests.push({
      title: test.title,
      file: path.relative(process.cwd(), test.location.file),
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
    };

    const dir = path.join(process.cwd(), 'reports', 'runs');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${this.runId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');

    void result;
  }
}

export default JsonReporter;
