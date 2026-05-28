import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const runsDir = path.join(root, 'reports', 'runs');
const artifactsDir = path.join(root, 'dashboard', 'public', 'artifacts');
const publicRunsDir = path.join(root, 'dashboard', 'public', 'runs');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function readCases() {
  const casesPath = path.join(root, 'data', 'cases.json');
  if (!fs.existsSync(casesPath)) return [];
  try {
    return readJson(casesPath).cases ?? [];
  } catch {
    return [];
  }
}

function findCaseByFile(cases, file) {
  const normalized = normalizePath(file);
  return cases.find((c) => normalizePath(c.specPath) === normalized);
}

function enrichRunFromCases(run, cases) {
  for (const test of run.tests ?? []) {
    const match = findCaseByFile(cases, test.file);
    if (match) {
      test.module = match.module;
    }
  }
}

function safeArtifactName(title, fallback, ext) {
  const base =
    title
      .replace(/[^\w\u4e00-\u9fa5-]+/g, '_')
      .slice(0, 40) || fallback;
  return `${base}${ext}`;
}

function copyArtifact(srcPath, destRun, publicBase, title, fallback) {
  if (!srcPath) return null;
  const src = path.isAbsolute(srcPath) ? srcPath : path.join(root, srcPath);
  if (!fs.existsSync(src)) return null;
  const ext = path.extname(src) || '.bin';
  const name = safeArtifactName(title, fallback, ext);
  fs.copyFileSync(src, path.join(destRun, name));
  return `${publicBase}/${name}`;
}

function copyArtifacts(tests, runId) {
  const destRun = path.join(artifactsDir, runId);
  const publicBase = `/artifacts/${runId}`;
  fs.mkdirSync(destRun, { recursive: true });

  for (const [idx, t] of tests.entries()) {
    const uniqueTitle = `${idx + 1}_${path.basename(t.file || 'test')}_${t.title}`;
    const screenshotPublic = copyArtifact(
      t.screenshot,
      destRun,
      publicBase,
      `${uniqueTitle}_screenshot`,
      `screenshot_${idx}`,
    );
    if (screenshotPublic) t.screenshotPublic = screenshotPublic;

    const videoPublic = copyArtifact(
      t.video,
      destRun,
      publicBase,
      `${uniqueTitle}_video`,
      `video_${idx}`,
    );
    if (videoPublic) t.videoPublic = videoPublic;

    const tracePublic = copyArtifact(
      t.trace,
      destRun,
      publicBase,
      `${uniqueTitle}_trace`,
      `trace_${idx}`,
    );
    if (tracePublic) t.tracePublic = tracePublic;
  }
}

function mergeBusinessReports(runId, run) {
  const bizPath = path.join(runsDir, `${runId}-biz.json`);
  if (fs.existsSync(bizPath)) {
    run.businessReports = readJson(bizPath);
  }
}

function main() {
  fs.mkdirSync(runsDir, { recursive: true });
  fs.mkdirSync(publicRunsDir, { recursive: true });
  fs.mkdirSync(artifactsDir, { recursive: true });
  const cases = readCases();

  const files = fs
    .readdirSync(runsDir)
    .filter((f) => f.endsWith('.json') && f !== 'index.json' && !f.includes('-biz'));

  const runs = [];

  for (const file of files) {
    const runPath = path.join(runsDir, file);
    const run = readJson(runPath);
    enrichRunFromCases(run, cases);
    copyArtifacts(run.tests ?? [], run.id);
    mergeBusinessReports(run.id, run);
    runs.push({
      id: run.id,
      env: run.env,
      baseURL: run.baseURL,
      passed: run.passed,
      failed: run.failed,
      skipped: run.skipped ?? 0,
      durationMs: run.durationMs,
      startedAt: run.startedAt,
      reportPath: `runs/${file}`,
    });

    fs.writeFileSync(
      path.join(publicRunsDir, file),
      JSON.stringify(run, null, 2),
      'utf-8',
    );
  }

  runs.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

  const index = { runs, updatedAt: new Date().toISOString() };
  const indexPath = path.join(runsDir, 'index.json');
  const publicIndexPath = path.join(publicRunsDir, 'index.json');

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  fs.writeFileSync(publicIndexPath, JSON.stringify(index, null, 2), 'utf-8');

  syncPerfReports(root);
  syncApiReports(root);

  console.log(`Synced ${runs.length} run(s) → ${publicIndexPath}`);
}

function syncApiReports(root) {
  const apiRunsDir = path.join(root, 'reports', 'api-runs');
  const publicApiRunsDir = path.join(root, 'dashboard', 'public', 'api-runs');
  const publicDir = path.join(root, 'dashboard', 'public');
  fs.mkdirSync(publicApiRunsDir, { recursive: true });

  const apiCasesSrc = path.join(root, 'data', 'api-cases.json');
  if (fs.existsSync(apiCasesSrc)) {
    fs.copyFileSync(apiCasesSrc, path.join(publicDir, 'api-cases.json'));
  }

  if (!fs.existsSync(apiRunsDir)) {
    fs.writeFileSync(
      path.join(publicApiRunsDir, 'index.json'),
      JSON.stringify({ runs: [] }, null, 2),
      'utf-8',
    );
    return;
  }

  const runs = [];
  for (const file of fs.readdirSync(apiRunsDir).filter((f) => f.endsWith('.json'))) {
    const src = path.join(apiRunsDir, file);
    const dest = path.join(publicApiRunsDir, file);
    fs.copyFileSync(src, dest);
    const data = readJson(src);
    runs.push({
      id: data.id,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
      summary: data.summary,
    });
  }

  runs.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  fs.writeFileSync(
    path.join(publicApiRunsDir, 'index.json'),
    JSON.stringify({ runs }, null, 2),
    'utf-8',
  );

  console.log(`Synced api runs → ${publicApiRunsDir} (${runs.length} runs)`);
}

function syncPerfReports(root) {
  const perfDir = path.join(root, 'reports', 'perf');
  const publicPerfDir = path.join(root, 'dashboard', 'public', 'perf');
  fs.mkdirSync(publicPerfDir, { recursive: true });

  if (!fs.existsSync(perfDir)) return;

  const vitalsReports = [];
  const loadReports = [];

  for (const file of fs.readdirSync(perfDir).filter((f) => f.endsWith('.json'))) {
    const src = path.join(perfDir, file);
    const dest = path.join(publicPerfDir, file);
    fs.copyFileSync(src, dest);
    const data = readJson(src);
    if (file.startsWith('vitals-')) vitalsReports.push(data);
    if (file.startsWith('load-')) loadReports.push(data);
  }

  vitalsReports.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  loadReports.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  fs.writeFileSync(
    path.join(publicPerfDir, 'vitals-index.json'),
    JSON.stringify({ reports: vitalsReports }, null, 2),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(publicPerfDir, 'load-index.json'),
    JSON.stringify({ reports: loadReports }, null, 2),
    'utf-8',
  );

  console.log(
    `Synced perf reports → ${publicPerfDir} (${vitalsReports.length} vitals, ${loadReports.length} load)`,
  );
}

main();
