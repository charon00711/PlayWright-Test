import fs from 'fs';
import path from 'path';

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

const LOG_DIR = path.join(process.cwd(), 'reports', 'live');
const LOG_FILE = path.join(LOG_DIR, 'events.jsonl');

function ensureDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export function clearLiveLogs() {
  ensureDir();
  fs.writeFileSync(LOG_FILE, '', 'utf-8');
}

export function appendLiveLog(
  event: Omit<LiveLogEvent, 'id' | 'ts'> & { id?: string; ts?: string },
) {
  ensureDir();
  const entry: LiveLogEvent = {
    id: event.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: event.ts ?? new Date().toISOString(),
    ...event,
  };
  fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf-8');
  return entry;
}

export function readLiveLogs(limit = 1000): LiveLogEvent[] {
  if (!fs.existsSync(LOG_FILE)) return [];
  const content = fs.readFileSync(LOG_FILE, 'utf-8').trim();
  if (!content) return [];
  const events = content
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LiveLogEvent);
  return events.slice(-limit);
}
