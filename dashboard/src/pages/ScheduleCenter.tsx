import { useEffect, useState } from 'react';
import {
  createSchedule,
  deleteSchedule,
  fetchCases,
  fetchScheduleHistory,
  fetchSchedules,
  fetchScheduleStatus,
  runScheduleNow,
  updateSchedule,
} from '../api';
import { ApiBanner } from '../components/ApiBanner';
import { IconPlay } from '../components/NavIcons';
import { useApiHealth } from '../hooks/useApiHealth';
import { useToast } from '../hooks/useToast';
import type {
  Schedule,
  ScheduleHistoryEntry,
  ScheduleTarget,
  ScheduleTrigger,
  TestCase,
} from '../types';

type TriggerMode = 'daily' | 'cron';
type TargetMode = 'all' | 'grep' | 'spec';

const CRON_PRESETS = [
  { label: '每天 02:00', expression: '0 2 * * *' },
  { label: '工作日 09:00', expression: '0 9 * * 1-5' },
  { label: '每小时', expression: '0 * * * *' },
  { label: '每 30 分钟', expression: '*/30 * * * *' },
];

const emptyForm = {
  name: '',
  triggerMode: 'daily' as TriggerMode,
  dailyTime: '02:00',
  cronExpression: '0 2 * * *',
  targetMode: 'grep' as TargetMode,
  grepTag: 'regression' as 'smoke' | 'regression',
  specPath: '',
  enabled: true,
};

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

function triggerLabel(trigger: ScheduleTrigger, cronExpression?: string | null) {
  if (trigger.type === 'daily') return `每天 ${trigger.time}`;
  return cronExpression || trigger.expression;
}

function targetLabel(target: ScheduleTarget) {
  if (target.mode === 'all') return '平台全部用例';
  if (target.mode === 'grep') {
    return target.tag === 'smoke' ? '冒烟 @smoke' : '回归 @regression';
  }
  return `单条 ${target.specPath}`;
}

function statusBadge(status: Schedule['lastRunStatus']) {
  if (status === 'success') return <span className="badge pass">成功</span>;
  if (status === 'failed') return <span className="badge fail">失败</span>;
  if (status === 'skipped') return <span className="badge skip">跳过</span>;
  return <span className="muted">未执行</span>;
}

function historyStatusBadge(entry: ScheduleHistoryEntry) {
  if (entry.status === 'success') return <span className="badge pass">成功</span>;
  if (entry.status === 'failed') return <span className="badge fail">失败</span>;
  return <span className="badge skip">跳过</span>;
}

export function ScheduleCenter() {
  const apiAvailable = useApiHealth();
  const toast = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [history, setHistory] = useState<ScheduleHistoryEntry[]>([]);
  const [timezone, setTimezone] = useState('Asia/Shanghai');
  const [nextRunLabel, setNextRunLabel] = useState('—');
  const [enabledCount, setEnabledCount] = useState(0);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  async function reload() {
    const [schedData, statusData, histData, caseData] = await Promise.all([
      fetchSchedules(),
      fetchScheduleStatus(),
      fetchScheduleHistory(),
      fetchCases(),
    ]);
    setSchedules(schedData.schedules);
    setTimezone(schedData.timezone);
    setHistory(histData.entries);
    setCases(caseData.cases);
    if (statusData) {
      setEnabledCount(statusData.enabledCount);
      setNextRunLabel(
        statusData.nextRun
          ? `${statusData.nextRun.name} · ${formatDateTime(statusData.nextRun.nextRunAt)}`
          : '—',
      );
    }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
    const timer = setInterval(reload, 30000);
    return () => clearInterval(timer);
  }, []);

  function openCreate(preset?: Partial<typeof emptyForm>) {
    setEditingId(null);
    setForm({ ...emptyForm, ...preset });
    setError('');
    setShowForm(true);
  }

  function openEdit(schedule: Schedule) {
    setEditingId(schedule.id);
    setForm({
      name: schedule.name,
      triggerMode: schedule.trigger.type,
      dailyTime: schedule.trigger.type === 'daily' ? schedule.trigger.time : '02:00',
      cronExpression:
        schedule.trigger.type === 'cron'
          ? schedule.trigger.expression
          : schedule.cronExpression || '0 2 * * *',
      targetMode: schedule.target.mode,
      grepTag:
        schedule.target.mode === 'grep' ? schedule.target.tag : 'regression',
      specPath: schedule.target.mode === 'spec' ? schedule.target.specPath : '',
      enabled: schedule.enabled,
    });
    setError('');
    setShowForm(true);
  }

  function buildPayload() {
    const trigger: ScheduleTrigger =
      form.triggerMode === 'daily'
        ? { type: 'daily', time: form.dailyTime }
        : { type: 'cron', expression: form.cronExpression.trim() };

    let target: ScheduleTarget;
    if (form.targetMode === 'all') target = { mode: 'all' };
    else if (form.targetMode === 'grep') target = { mode: 'grep', tag: form.grepTag };
    else target = { mode: 'spec', specPath: form.specPath };

    return {
      name: form.name.trim(),
      enabled: form.enabled,
      trigger,
      target,
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('请填写任务名称');
      return;
    }
    if (form.targetMode === 'spec' && !form.specPath) {
      setError('请选择要执行的用例');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload();
      if (editingId) {
        await updateSchedule(editingId, payload);
        toast.showSuccess('定时任务已更新');
      } else {
        await createSchedule(payload);
        toast.showSuccess('定时任务已创建');
      }
      setShowForm(false);
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.showError(`保存失败：${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(schedule: Schedule) {
    try {
      await updateSchedule(schedule.id, { enabled: !schedule.enabled });
      toast.showSuccess(schedule.enabled ? '已停用定时任务' : '已启用定时任务');
      await reload();
    } catch (err) {
      toast.showError(
        `操作失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除该定时任务？')) return;
    try {
      await deleteSchedule(id);
      toast.showSuccess('定时任务已删除');
      await reload();
    } catch (err) {
      toast.showError(
        `删除失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async function handleRunNow(id: string) {
    setRunningId(id);
    try {
      await runScheduleNow(id);
      toast.showSuccess('定时任务已触发执行');
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.showError(`执行失败：${msg}`);
    } finally {
      setRunningId(null);
    }
  }

  if (loading) return <p>加载中…</p>;

  return (
    <div>
      <div className="page-header">
        <h2>定时中心</h2>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn"
            disabled={!apiAvailable}
            onClick={() =>
              openCreate({
                name: '每天自动回归',
                triggerMode: 'daily',
                dailyTime: '02:00',
                targetMode: 'grep',
                grepTag: 'regression',
              })
            }
          >
            快速：每天自动回归
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!apiAvailable}
            onClick={() => openCreate()}
          >
            新建定时任务
          </button>
        </div>
      </div>

      <ApiBanner />

      {!apiAvailable && (
        <div className="banner banner-warn">
          定时调度依赖本地 API（npm run platform:dev）。静态预览模式下无法创建或执行定时任务。
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <div className="label">已启用任务</div>
          <div className="value">{enabledCount}</div>
        </div>
        <div className="stat">
          <div className="label">时区</div>
          <div className="value schedule-stat-sm">{timezone}</div>
        </div>
        <div className="stat schedule-stat-wide">
          <div className="label">最近下次执行</div>
          <div className="value schedule-stat-sm">{nextRunLabel}</div>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-header-row">
            <h3 style={{ margin: 0 }}>{editingId ? '编辑定时任务' : '新建定时任务'}</h3>
            <button type="button" className="btn btn-sm" onClick={() => setShowForm(false)}>
              取消
            </button>
          </div>
          <form className="form schedule-form" onSubmit={handleSave}>
            <label>
              任务名称
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：每天自动回归"
              />
            </label>

            <label>
              触发方式
              <select
                value={form.triggerMode}
                onChange={(e) =>
                  setForm({ ...form, triggerMode: e.target.value as TriggerMode })
                }
              >
                <option value="daily">每日定时</option>
                <option value="cron">Cron 表达式</option>
              </select>
            </label>

            {form.triggerMode === 'daily' ? (
              <label>
                执行时间（HH:mm）
                <input
                  type="time"
                  value={form.dailyTime}
                  onChange={(e) => setForm({ ...form, dailyTime: e.target.value })}
                />
              </label>
            ) : (
              <>
                <label>
                  Cron 表达式
                  <input
                    className="code-area"
                    value={form.cronExpression}
                    onChange={(e) =>
                      setForm({ ...form, cronExpression: e.target.value })
                    }
                    placeholder="0 2 * * *"
                  />
                </label>
                <div className="cron-presets">
                  <span className="muted">常用预设：</span>
                  {CRON_PRESETS.map((preset) => (
                    <button
                      key={preset.expression}
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        setForm({ ...form, cronExpression: preset.expression })
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="muted cron-help">
                  格式：分 时 日 月 周（5 段）。示例 <code>0 9 * * 1-5</code> 表示工作日 09:00。
                </p>
              </>
            )}

            <label>
              执行范围
              <select
                value={form.targetMode}
                onChange={(e) =>
                  setForm({ ...form, targetMode: e.target.value as TargetMode })
                }
              >
                <option value="grep">按标签</option>
                <option value="all">全部用例</option>
                <option value="spec">单条用例</option>
              </select>
            </label>

            {form.targetMode === 'grep' && (
              <label>
                标签
                <select
                  value={form.grepTag}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      grepTag: e.target.value as 'smoke' | 'regression',
                    })
                  }
                >
                  <option value="regression">回归 @regression</option>
                  <option value="smoke">冒烟 @smoke</option>
                </select>
              </label>
            )}

            {form.targetMode === 'spec' && (
              <label>
                选择用例
                <select
                  value={form.specPath}
                  onChange={(e) => setForm({ ...form, specPath: e.target.value })}
                >
                  <option value="">请选择</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.specPath}>
                      {c.title} ({c.specPath})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              启用该任务
            </label>

            {error && <p className="error-text">{error}</p>}

            <div className="btn-row">
              <button type="submit" className="btn primary" disabled={saving || !apiAvailable}>
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>定时任务列表</h3>
        {schedules.length === 0 ? (
          <p className="empty">暂无定时任务，点击「新建定时任务」或「每天自动回归」快速创建。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>触发</th>
                <th>执行范围</th>
                <th>下次运行</th>
                <th>上次运行</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td>
                    <strong>{schedule.name}</strong>
                    {!schedule.enabled && (
                      <span className="badge skip" style={{ marginLeft: 8 }}>
                        已停用
                      </span>
                    )}
                  </td>
                  <td>
                    <code className="cron-chip">
                      {triggerLabel(schedule.trigger, schedule.cronExpression)}
                    </code>
                  </td>
                  <td>{targetLabel(schedule.target)}</td>
                  <td>{formatDateTime(schedule.nextRunAt)}</td>
                  <td>
                    {formatDateTime(schedule.lastRunAt)}
                    <div>{statusBadge(schedule.lastRunStatus)}</div>
                  </td>
                  <td>
                    {schedule.cronValid === false ? (
                      <span className="badge fail">Cron 无效</span>
                    ) : schedule.enabled ? (
                      <span className="badge pass">运行中</span>
                    ) : (
                      <span className="muted">已暂停</span>
                    )}
                  </td>
                  <td className="actions-cell">
                    <button
                      type="button"
                      className="btn btn-sm btn-run"
                      disabled={!apiAvailable || runningId === schedule.id}
                      onClick={() => handleRunNow(schedule.id)}
                    >
                      {runningId === schedule.id ? (
                        <span className="btn-with-icon">
                          <span className="spinner" /> 执行中
                        </span>
                      ) : (
                        <span className="btn-with-icon">
                          <IconPlay /> 立即执行
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!apiAvailable}
                      onClick={() => openEdit(schedule)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!apiAvailable}
                      onClick={() => handleToggle(schedule)}
                    >
                      {schedule.enabled ? '停用' : '启用'}
                    </button>
                    <button
                      type="button"
                      className="link-btn btn-sm"
                      disabled={!apiAvailable}
                      onClick={() => handleDelete(schedule.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>执行历史</h3>
        {history.length === 0 ? (
          <p className="muted">暂无执行记录。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>任务</th>
                <th>触发</th>
                <th>开始时间</th>
                <th>结果</th>
                <th>退出码</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 20).map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.scheduleName}</td>
                  <td>{entry.trigger === 'manual' ? '手动' : '定时'}</td>
                  <td>{formatDateTime(entry.startedAt)}</td>
                  <td>
                    {historyStatusBadge(entry)}
                    {entry.message && (
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {entry.message}
                      </div>
                    )}
                  </td>
                  <td>{entry.exitCode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
