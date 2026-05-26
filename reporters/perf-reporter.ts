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
import {
  peekVitalsForTest,
  takeAllVitalsEntries,
  takeVitalsForTest,
  type StoredVitalsEntry,
} from '../utils/perf-metrics.js';
import { formatRunId } from '../utils/report.js';

type PerfVitalsReport = {
  id: string;
  runId: string;
  env: string;
  baseURL: string;
  startedAt: string;
  finishedAt: string;
  entries: StoredVitalsEntry[];
};

class PerfReporter implements Reporter {
  private runId = '';
  private startedAt = new Date();
  private config!: FullConfig;
  private entries: StoredVitalsEntry[] = [];

  onBegin(config: FullConfig, _suite: Suite) {
    this.config = config;
    this.startedAt = new Date();
    this.runId = process.env.PW_RUN_ID ?? formatRunId(this.startedAt);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const stored = takeVitalsForTest(test.title);
    if (stored.length > 0) {
      this.entries.push(
        ...stored.map((entry) => ({
          ...entry,
          status: result.status as StoredVitalsEntry['status'],
        })),
      );
      return;
    }

    const attachment = result.attachments.find((a) => a.name === 'web-vitals');
    if (attachment?.body) {
      try {
        const parsed = JSON.parse(attachment.body.toString()) as {
          url: string;
          metrics: StoredVitalsEntry['metrics'];
        };
        this.entries.push({
          testTitle: test.title,
          url: parsed.url,
          metrics: parsed.metrics,
          collectedAt: new Date().toISOString(),
          status: result.status as StoredVitalsEntry['status'],
        });
      } catch {
        /* ignore malformed attachment */
      }
    }
  }

  onEnd(_result: FullResult) {
    const leftover = takeAllVitalsEntries();
    if (leftover.length > 0) {
      this.entries.push(...leftover);
    }

    if (this.entries.length === 0) return;

    const finishedAt = new Date();
    const report: PerfVitalsReport = {
      id: `vitals-${this.runId}`,
      runId: this.runId,
      env: process.env.TEST_ENV ?? 'local',
      baseURL:
        process.env.BASE_URL ??
        (this.config.projects.find((p) => p.name === 'chromium')?.use
          ?.baseURL as string) ??
        '',
      startedAt: this.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      entries: this.entries,
    };

    const dir = path.join(process.cwd(), 'reports', 'perf');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `vitals-${this.runId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
  }
}

export default PerfReporter;
