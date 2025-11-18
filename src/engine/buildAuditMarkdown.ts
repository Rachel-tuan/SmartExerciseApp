import { getRuleMetaById, getRulePriorityById } from './prescriptionEngine';

export function buildAuditMarkdownWithEvidence({ user, kpi, recent, prescription, coachPlan }: any): string {
  const lines: string[] = [];
  lines.push(`# 审计单`);
  lines.push(`- 用户：${user?.name || '—'}（ID: ${user?.user_id || '—'}）`);
  lines.push(`- 日期：${toYmd(new Date())}`);
  lines.push(``);
  if (kpi) {
    lines.push(`## KPI`);
    lines.push(`- 周完成率：${kpi.weeklyCompletion ?? '—'}%`);
    lines.push(`- 误放行率（红/黄仍强行开始）：${kpi.falseClearanceRate ?? '—'}%`);
    lines.push(`- 绿色数据占比：${kpi.greenRate ?? '—'}%`);
    lines.push(`- 处方附规则编号率：${kpi.ruleAttachedRate ?? '—'}%`);
    lines.push(`- 处方与导师一致性：${kpi.coachConsistency ?? '—'}`);
    lines.push(``);
  }
  lines.push(`## 当前处方`);
  lines.push(`- 频率：每周 ${prescription?.fit?.freq ?? '—'} 天`);
  lines.push(`- 强度：${prescription?.fit?.intensity ?? '—'}`);
  lines.push(`- 时长：每次 ${prescription?.fit?.time ?? '—'} 分钟`);
  lines.push(`- 类型：${prescription?.fit?.type ?? '—'}`);
  lines.push(``);
  const ruleIds: string[] = Array.isArray(prescription?.rules) ? prescription.rules : [];
  lines.push(`## 规则详情`);
  if (ruleIds.length === 0) {
    lines.push(`- 无`);
  } else {
    for (const rid of ruleIds) {
      const meta = getRuleMetaById(rid);
      const name = meta?.name || '—';
      const pri = getRulePriorityById(rid) ?? '—';
      const evs = Array.isArray(meta?.evidence) ? meta!.evidence.join(', ') : '—';
      lines.push(`- **${rid} (${name})** ｜ priority ${pri} ｜ evidence: ${evs}`);
    }
  }
  lines.push(``);
  if (Array.isArray(recent) && recent.length > 0) {
    lines.push(`## 最近闸门事件`);
    for (const e of recent) {
      lines.push(`- ${e.date} | 状态：${e.status} | 强行开始：${e.forcedStart ? '是' : '否'} | 触发原因：${(e.reasons || []).join('；')} | 建议：${e.suggestedAction || '—'}`);
    }
    lines.push(``);
  }
  if (coachPlan) {
    lines.push(`## 导师计划`);
    lines.push(`- 强度关键词：${coachPlan?.intensity || '—'}`);
    lines.push(`- 类型关键词：${coachPlan?.type || '—'}`);
    lines.push(``);
  }
  return lines.join('\n');
}

export function generateAuditCSV(logs: any[]): string {
  const header = ['timestamp', 'admin', 'action', 'old_config', 'new_config'];
  const rows: string[][] = [header];
  for (const l of (logs || [])) {
    const ts = l.timestamp || '';
    const admin = l.admin || '';
    const action = l.action || '';
    const oldc = l.old_config ? JSON.stringify(l.old_config) : '';
    const newc = l.new_config ? JSON.stringify(l.new_config) : '';
    rows.push([ts, admin, action, oldc, newc]);
  }
  return rows.map(r => r.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
}

function toYmd(date: Date | string): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${dd}`;
}