import fs from 'fs';
import path from 'path';

export type TestReportEntry = {
  caseName: string;
  steps: string[];
  expected: string;
  actual: string;
  status: '通过' | '失败';
  durationMs: number;
  executedAt: string;
  runId?: string;
};

export type BusinessReportJson = TestReportEntry & {
  type: 'business';
};

export function getRunId(): string {
  return process.env.PW_RUN_ID ?? formatRunId(new Date());
}

export function formatRunId(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

export function writeTestReport(entry: TestReportEntry, filename = '测试报告.md') {
  const runId = entry.runId ?? getRunId();
  const runsDir = path.join(process.cwd(), 'reports', 'runs');
  fs.mkdirSync(runsDir, { recursive: true });

  const stepsMd = entry.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const content = `# Playwright 自动化测试报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 测试用例 | ${entry.caseName} |
| 执行时间 | ${entry.executedAt} |
| 耗时 | ${(entry.durationMs / 1000).toFixed(2)} 秒 |
| 结果 | **${entry.status}** |

## 测试步骤

${stepsMd}

## 预期结果

${entry.expected}

## 实际结果

${entry.actual}

## 结论

${entry.status === '通过' ? '所有步骤执行成功，验证通过。' : '测试未通过，请查看 Playwright 报告排查。'}

---
*报告由 Playwright测试平台 自动生成*
`;

  const mdPath = path.join(process.cwd(), 'reports', filename);
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(mdPath, content, 'utf-8');

  const bizJson: BusinessReportJson = { ...entry, runId, type: 'business' };
  const bizPath = path.join(runsDir, `${runId}-biz.json`);
  let existing: BusinessReportJson[] = [];
  if (fs.existsSync(bizPath)) {
    existing = JSON.parse(fs.readFileSync(bizPath, 'utf-8')) as BusinessReportJson[];
  }
  existing.push(bizJson);
  fs.writeFileSync(bizPath, JSON.stringify(existing, null, 2), 'utf-8');

  return mdPath;
}
