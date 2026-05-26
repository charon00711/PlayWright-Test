import path from 'path';
import type {
  FullConfig,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { appendLiveLog, clearLiveLogs } from '../utils/live-log.js';

class LiveLogReporter implements Reporter {
  onBegin(_config: FullConfig) {
    clearLiveLogs();
    appendLiveLog({
      type: 'process',
      level: 'info',
      message: 'Playwright 测试开始',
      source: 'playwright',
    });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const trace = result.attachments.find((a) => a.name === 'trace')?.path;
    if (trace) {
      appendLiveLog({
        type: 'trace',
        test: test.title,
        tracePath: path.relative(process.cwd(), trace),
        message: `Trace 已生成：${test.title}`,
        source: 'playwright',
      });
    }

    if (result.status === 'failed' && result.error?.message) {
      appendLiveLog({
        type: 'console',
        level: 'error',
        test: test.title,
        message: result.error.message,
        source: 'playwright',
      });
    }
  }

  onEnd() {
    appendLiveLog({
      type: 'process',
      level: 'info',
      message: 'Playwright 测试结束',
      source: 'playwright',
    });
  }
}

export default LiveLogReporter;
