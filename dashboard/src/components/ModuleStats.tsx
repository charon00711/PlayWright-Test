import type { RunTest } from '../types';

type Props = {
  tests: RunTest[];
};

export function ModuleStats({ tests }: Props) {
  const byModule: Record<string, { pass: number; fail: number }> = {};

  for (const t of tests) {
    const m = t.file.match(/tests\/([^/]+)\//)?.[1] ?? 'other';
    if (!byModule[m]) byModule[m] = { pass: 0, fail: 0 };
    if (t.status === 'passed') byModule[m].pass++;
    else if (t.status === 'failed') byModule[m].fail++;
  }

  const entries = Object.entries(byModule);
  if (entries.length === 0) return null;

  return (
    <div className="card">
      <h3>模块分布（最近一次运行）</h3>
      <div className="module-grid">
        {entries.map(([mod, s]) => (
          <div key={mod} className="module-item">
            <strong>{mod}</strong>
            <span className="badge pass">{s.pass} 通过</span>
            {s.fail > 0 && <span className="badge fail">{s.fail} 失败</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
