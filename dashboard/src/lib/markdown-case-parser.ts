export type ParsedCase = {
  type: 'case';
  title: string;
  module: string;
  tags: string[];
  steps: string[];
  expected: string;
  useAuth: boolean;
};

export type ParsedReport = {
  type: 'report';
  caseName: string;
  steps: string[];
  expected: string;
  actual: string;
  status: '通过' | '失败';
};

export function parseMarkdownCase(
  md: string,
  mode: 'case' | 'report' = 'case',
): ParsedCase | ParsedReport {
  const lines = md.split('\n');
  let title = '';
  let module = 'smoke';
  const tags: string[] = [];
  const steps: string[] = [];
  let expected = '';
  let actual = '';
  let section = '';

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)/);
    if (h1 && !title) {
      title = h1[1].trim();
      continue;
    }
    const metaModule = line.match(/^\*\*模块:\*\*\s*(.+)/i);
    if (metaModule) {
      module = metaModule[1].trim();
      continue;
    }
    const metaTags = line.match(/^\*\*标签:\*\*\s*(.+)/i);
    if (metaTags) {
      tags.push(...metaTags[1].trim().split(/\s+/).filter(Boolean));
      continue;
    }
    if (/^##\s*步骤/.test(line)) {
      section = 'steps';
      continue;
    }
    if (/^##\s*预期/.test(line)) {
      section = 'expected';
      continue;
    }
    if (/^##\s*实际/.test(line)) {
      section = 'actual';
      continue;
    }
    const stepItem = line.match(/^\d+\.\s+(.+)/);
    if (section === 'steps' && stepItem) {
      steps.push(stepItem[1].trim());
      continue;
    }
    if (section === 'expected' && line.trim()) {
      expected += (expected ? '\n' : '') + line.trim();
      continue;
    }
    if (section === 'actual' && line.trim()) {
      actual += (actual ? '\n' : '') + line.trim();
    }
  }

  if (mode === 'report') {
    return {
      type: 'report',
      caseName: title || '导入报告',
      steps,
      expected,
      actual,
      status: actual.includes('失败') ? '失败' : '通过',
    };
  }

  return {
    type: 'case',
    title: title || '未命名用例',
    module,
    tags: tags.length ? tags : ['@regression'],
    steps,
    expected: expected || '待补充',
    useAuth: !steps.some((s) => /登录/.test(s)),
  };
}
