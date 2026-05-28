import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { readJson, writeJson } from './utils.mjs';

const TIMEZONE = process.env.SCHEDULER_TZ || 'Asia/Shanghai';
const MAX_HISTORY = 50;

export function getSchedulesPath(projectRoot) {
  return path.join(projectRoot, 'data', 'schedules.json');
}

export function getHistoryPath(projectRoot) {
  return path.join(projectRoot, 'data', 'schedule-history.json');
}

export function readSchedules(projectRoot) {
  const filePath = getSchedulesPath(projectRoot);
  if (!fs.existsSync(filePath)) {
    const initial = { schedules: [] };
    writeJson(filePath, initial);
    return initial;
  }
  return readJson(filePath, { schedules: [] });
}

export function writeSchedules(projectRoot, data) {
  writeJson(getSchedulesPath(projectRoot), data);
}

export function readHistory(projectRoot) {
  const filePath = getHistoryPath(projectRoot);
  if (!fs.existsSync(filePath)) {
    const initial = { entries: [] };
    writeJson(filePath, initial);
    return initial;
  }
  return readJson(filePath, { entries: [] });
}

export function appendHistory(projectRoot, entry) {
  const data = readHistory(projectRoot);
  data.entries.unshift(entry);
  if (data.entries.length > MAX_HISTORY) {
    data.entries = data.entries.slice(0, MAX_HISTORY);
  }
  writeJson(getHistoryPath(projectRoot), data);
}

export function triggerToCron(trigger) {
  if (trigger.type === 'daily') {
    const [hh, mm] = trigger.time.split(':');
    const h = parseInt(hh, 10);
    const m = parseInt(mm, 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return `${m} ${h} * * *`;
  }
  if (trigger.type === 'cron') {
    return (trigger.expression || '').trim();
  }
  return null;
}

export function validateCronExpression(expr) {
  return cron.validate(expr);
}

export function getNextRunAt(trigger) {
  const expr = triggerToCron(trigger);
  if (!expr || !cron.validate(expr)) return null;
  try {
    const interval = CronExpressionParser.parse(expr, { tz: TIMEZONE });
    return interval.next().toDate().toISOString();
  } catch {
    return null;
  }
}

export function enrichSchedule(schedule) {
  const cronExpression = triggerToCron(schedule.trigger);
  return {
    ...schedule,
    cronExpression,
    cronValid: cronExpression ? cron.validate(cronExpression) : false,
    nextRunAt: schedule.enabled ? getNextRunAt(schedule.trigger) : null,
  };
}

function readPlatformCases(projectRoot) {
  const filePath = path.join(projectRoot, 'data', 'cases.json');
  if (!fs.existsSync(filePath)) return [];
  const data = readJson(filePath, { cases: [] });
  return (data.cases ?? []).filter((c) => c.status !== 'inactive' && c.specPath);
}

function filterCasesByTag(cases, tag) {
  if (tag === 'smoke') {
    return cases.filter(
      (c) => c.module === 'smoke' || (c.tags ?? []).some((t) => String(t).includes('smoke')),
    );
  }
  return cases.filter((c) =>
    (c.tags ?? []).some((t) => String(t).includes('regression')),
  );
}

/** Map schedule target to spawnTestRun body (platform cases, not npm test:ci). */
export function buildRunBody(projectRoot, target) {
  const cases = readPlatformCases(projectRoot);

  if (!target || target.mode === 'all') {
    const specPaths = cases.map((c) => c.specPath);
    return specPaths.length ? { specPaths } : {};
  }
  if (target.mode === 'grep') {
    const filtered = filterCasesByTag(cases, target.tag || 'regression');
    const specPaths = filtered.map((c) => c.specPath);
    if (specPaths.length) return { specPaths };
    return { grep: target.tag || 'regression' };
  }
  if (target.mode === 'spec' && target.specPath) {
    return { specPath: target.specPath };
  }
  return {};
}

export function createScheduleManager(projectRoot, state, runTestFn) {
  const tasks = new Map();

  function stopAll() {
    for (const task of tasks.values()) {
      task.stop();
    }
    tasks.clear();
  }

  function reload() {
    stopAll();
    const { schedules } = readSchedules(projectRoot);
    for (const schedule of schedules) {
      if (!schedule.enabled) continue;
      const expr = triggerToCron(schedule.trigger);
      if (!expr || !cron.validate(expr)) continue;
      const task = cron.schedule(
        expr,
        () => {
          runScheduledJob(schedule.id, 'scheduled').catch(() => {});
        },
        { timezone: TIMEZONE },
      );
      tasks.set(schedule.id, task);
    }
  }

  async function runScheduledJob(scheduleId, triggerType = 'scheduled') {
    const data = readSchedules(projectRoot);
    const schedule = data.schedules.find((s) => s.id === scheduleId);
    if (!schedule) return { ok: false, error: 'Schedule not found' };

    if (state.run.running) {
      appendHistory(projectRoot, {
        id: `hist-${Date.now()}`,
        scheduleId,
        scheduleName: schedule.name,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: null,
        status: 'skipped',
        trigger: triggerType,
        message: '已有测试在运行，跳过本次定时任务',
      });
      return { ok: false, error: '已有测试在运行' };
    }

    const startedAt = new Date().toISOString();
    const runBody = buildRunBody(projectRoot, schedule.target);

    try {
      const exitCode = await runTestFn(runBody);
      const status = exitCode === 0 ? 'success' : 'failed';
      const idx = data.schedules.findIndex((s) => s.id === scheduleId);
      if (idx >= 0) {
        data.schedules[idx].lastRunAt = startedAt;
        data.schedules[idx].lastRunStatus = status;
        data.schedules[idx].lastRunExitCode = exitCode;
        data.schedules[idx].updatedAt = new Date().toISOString();
        writeSchedules(projectRoot, data);
      }

      appendHistory(projectRoot, {
        id: `hist-${Date.now()}`,
        scheduleId,
        scheduleName: schedule.name,
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode,
        status,
        trigger: triggerType,
        output: state.run.output.slice(-4000),
      });

      return { ok: true, exitCode };
    } catch (e) {
      appendHistory(projectRoot, {
        id: `hist-${Date.now()}`,
        scheduleId,
        scheduleName: schedule.name,
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode: null,
        status: 'failed',
        trigger: triggerType,
        message: e instanceof Error ? e.message : String(e),
      });
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return { reload, runScheduledJob, stopAll };
}
