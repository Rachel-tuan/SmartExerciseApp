import React, { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, Card, Typography, Space, Descriptions, Divider, Form, Input, InputNumber, Switch, Button, Empty } from 'antd';
import { useHealthData } from '../contexts/HealthDataContext';
import { useUser } from '../contexts/UserContext';
import { getWeeklyExerciseSummary, getExerciseLogs, getGateEvents, getPrescriptions } from '../models';
import { startOfWeek } from 'date-fns';

const { Title, Text } = Typography;

export default function AdminPage(){
  const { message } = AntdApp.useApp();
  const { healthStats, getAuditLogs } = useHealthData();
  const { user } = useUser();
  const [kpi, setKpi] = useState({
    weeklyCompletion: 0,
    falseClearanceRate: 0,
    greenRate: 0,
    ruleAttachedRate: 0,
    coachConsistency: null
  });
  const [coachPlan, setCoachPlan] = useState({ intensity: '', type: '' });
  const [latestPrescription, setLatestPrescription] = useState(null);

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);

  useEffect(() => {
    (async () => {
      try {
        const list = await getPrescriptions(user?.user_id);
        setLatestPrescription(Array.isArray(list) && list.length > 0 ? list[0] : null);
      } catch (_e) {
        setLatestPrescription(null);
      }
    })();
  }, [user?.user_id]);

  useEffect(() => {
    (async () => {
      if (!user?.user_id) return;
      try {
        // 周完成率
        const summary = await getWeeklyExerciseSummary(user.user_id, weekStart, 5);
        // Gate事件
        const events = await getGateEvents(user.user_id);
        const last7 = filterLastNDays(events, 7);
        const total = last7.length;
        const greens = last7.filter(e => e.status === 'green').length;
        const ry = last7.filter(e => e.status === 'yellow' || e.status === 'red');
        const overrides = ry.filter(e => e.forcedStart).length;
        const ruleAttachedRate = await calcRuleAttachedRate();
        setKpi({
          weeklyCompletion: summary.adherencePercent || 0,
          falseClearanceRate: ry.length ? Math.round(overrides / ry.length * 100) : 0,
          greenRate: total ? Math.round(greens / total * 100) : 0,
          ruleAttachedRate,
          coachConsistency: calcCoachConsistency(latestPrescription, coachPlan)
        });
      } catch (e) {
        console.error(e);
      }
    })();
  }, [user?.user_id, weekStart, coachPlan, latestPrescription]);

  const calcRuleAttachedRate = async () => {
    try {
      const list = await getPrescriptions(user?.user_id);
      if (!Array.isArray(list) || list.length === 0) return 0;
      const withRules = list.filter(p => Array.isArray(p.rules) && p.rules.length > 0).length;
      return Math.round(withRules / list.length * 100);
    } catch (_e) {
      return 0;
    }
  };

  const calcCoachConsistency = (p, coach) => {
    if (!p || !p.fit || !coach) return null;
    const intensityMatch = coach.intensity ? (p.fit.intensity || '').includes(coach.intensity) : false;
    const typeMatch = coach.type ? (p.fit.type || '').includes(coach.type) : false;
    return intensityMatch && typeMatch ? '一致' : '不一致';
  };

  const exportAudit = async () => {
    if (!user || !user.user_id) { message.warning('请先登录或选择用户'); return; }
    try {
      const events = await getGateEvents(user.user_id);
      const recent = filterLastNDays(events, 14);
      if (!Array.isArray(recent) || recent.length === 0) { message.info('最近14天无 Gate 事件'); return; }
      const md = buildAuditMarkdown({ user, kpi, recent, prescription: latestPrescription, coachPlan });
      printMarkdown(md);
    } catch (e) {
      message.error('导出失败');
    }
  };

  const exportCSV = async () => {
    if (!user || !user.user_id) { message.warning('请先登录或选择用户'); return; }
    try {
      const events = await getGateEvents(user.user_id);
      const filtered = filterLastNDays(events, 30);
      if (!Array.isArray(filtered) || filtered.length === 0) { message.info('最近30天无 Gate 事件'); return; }
      const rows = [['event_id','date','status','forcedStart','reasons','suggestedAction','prescription_id']];
      for (const e of filtered) {
        rows.push([
          e.event_id || '',
          e.date || '',
          e.status || '',
          e.forcedStart ? '1' : '0',
          (e.reasons || []).join('|'),
          e.suggestedAction || '',
          e.prescription_id || ''
        ]);
      }
      const csv = rows.map(r => r.map(cell => ("\"" + String(cell).replace(/"/g,'""') + "\"")) .join(',')).join('\n');
      downloadBlob(csv, 'audit_gate_events.csv', 'text/csv;charset=utf-8;');
    } catch (e) {
      message.error('CSV 导出失败');
    }
  };

  const exportJSON = async () => {
    if (!user || !user.user_id) { message.warning('请先登录或选择用户'); return; }
    try {
      const events = await getGateEvents(user.user_id);
      const filtered = filterLastNDays(events, 30);
      if (!Array.isArray(filtered) || filtered.length === 0) { message.info('最近30天无 Gate 事件'); return; }
      const payload = {
        user: { id: user?.user_id, name: user?.name },
        kpi,
        prescription: latestPrescription,
        events: filtered
      };
      const json = JSON.stringify(payload, null, 2);
      downloadBlob(json, 'audit_report.json', 'application/json');
    } catch (e) {
      message.error('JSON 导出失败');
    }
  };

  const printMeasurementAudit = async () => {
    if (!user || !user.user_id) { message.warning('请先登录或选择用户'); return; }
    try {
      const logs = await getAuditLogs();
      if (!Array.isArray(logs) || logs.length === 0) { message.info('暂无测量审计日志'); return; }
      const md = buildMeasurementAuditMarkdown({ user, logs });
      printMarkdown(md);
    } catch (e) {
      message.error('打印审计日志失败');
    }
  };

  const exportMeasurementAuditMarkdown = async () => {
    if (!user || !user.user_id) { message.warning('请先登录或选择用户'); return; }
    try {
      const logs = await getAuditLogs();
      if (!Array.isArray(logs) || logs.length === 0) { message.info('暂无测量审计日志'); return; }
      const md = buildMeasurementAuditMarkdown({ user, logs });
      downloadBlob(md, 'measurement_audit.md', 'text/markdown');
    } catch (e) {
      message.error('Markdown 导出失败');
    }
  };

  return (
    <div style={{padding:16}}>
      <Space direction="vertical" size="large" style={{width:'100%'}}>
        <Title level={3}>管理面板 Admin</Title>

        <Card title="KPI 指标概览" variant="outlined">
          <div style={{marginBottom:16}}>
            {healthStats ? (
              <Descriptions column={1} size="middle">
                <Descriptions.Item label="血压是否正常">{healthStats.bloodPressureStatus?.isNormal? '正常':'异常'}</Descriptions.Item>
                <Descriptions.Item label="血压等级">{healthStats.bloodPressureStatus?.category || '未知'}</Descriptions.Item>
                <Descriptions.Item label="血糖是否正常">{healthStats.bloodSugarStatus?.isNormal? '正常':'异常'}</Descriptions.Item>
                <Descriptions.Item label="血糖等级">{healthStats.bloodSugarStatus?.category || '未知'}</Descriptions.Item>
                <Descriptions.Item label="BMI 分类">{healthStats.bmiCategory || '未知'}</Descriptions.Item>
                <Descriptions.Item label="周完成率">{kpi.weeklyCompletion}%</Descriptions.Item>
                <Descriptions.Item label="误放行率（红/黄仍强行开始）">{kpi.falseClearanceRate}%</Descriptions.Item>
                <Descriptions.Item label="绿色数据占比">{kpi.greenRate}%</Descriptions.Item>
                <Descriptions.Item label="处方附规则编号率">{kpi.ruleAttachedRate}%</Descriptions.Item>
                <Descriptions.Item label="处方与导师一致性">{kpi.coachConsistency ?? '待录入'}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description={<Text type="secondary">暂无统计数据</Text>} />
            )}
          </div>
          <Space>
            <Button type="primary" onClick={exportAudit}>一键导出审计单</Button>
            <Button onClick={exportCSV}>导出 CSV</Button>
            <Button onClick={exportJSON}>导出 JSON</Button>
            <Button onClick={printMeasurementAudit}>打印测量审计日志</Button>
            <Button onClick={exportMeasurementAuditMarkdown}>下载测量审计 Markdown</Button>
          </Space>
        </Card>

        <Card title="导师计划（占位）对比" variant="outlined">
          <Form layout="vertical"
            onValuesChange={(_, all) => setCoachPlan({ intensity: all.intensity || '', type: all.type || '' })}
          >
            <Form.Item label="强度关键词" name="intensity">
              <Input placeholder="如：中等强度/低强度" />
            </Form.Item>
            <Form.Item label="类型关键词" name="type">
              <Input placeholder="如：快走/骑行/力量训练" />
            </Form.Item>
          </Form>
          {latestPrescription && (
            <Descriptions column={1} size="small" title="当前处方（摘要）">
              <Descriptions.Item label="频率">每周 {latestPrescription.fit?.freq ?? '—'} 天</Descriptions.Item>
              <Descriptions.Item label="强度">{latestPrescription.fit?.intensity ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="时长">每次 {latestPrescription.fit?.time ?? '—'} 分钟</Descriptions.Item>
              <Descriptions.Item label="类型">{latestPrescription.fit?.type ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="规则编号">{(latestPrescription.rules || []).join('、') || '—'}</Descriptions.Item>
            </Descriptions>
          )}
        </Card>

        <Card title="规则配置占位" variant="outlined">
          <Form layout="vertical">
            <Form.Item label="高血压阈值 (收缩压)" name="bp_sys_high" initialValue={140}>
              <InputNumber style={{width:'100%'}} min={80} max={220} />
            </Form.Item>
            <Form.Item label="高血压阈值 (舒张压)" name="bp_dia_high" initialValue={90}>
              <InputNumber style={{width:'100%'}} min={40} max={140} />
            </Form.Item>
            <Form.Item label="高血糖阈值 (空腹)" name="bs_fpg_high" initialValue={7.0}>
              <InputNumber style={{width:'100%'}} step={0.1} min={3} max={20} />
            </Form.Item>
            <Form.Item label="低血糖阈值" name="bs_low" initialValue={3.9}>
              <InputNumber style={{width:'100%'}} step={0.1} min={2} max={6} />
            </Form.Item>
            <Divider />
            <Form.Item label="启用异常提醒" name="enable_alerts" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary">保存规则</Button>
                <Button>恢复默认</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </div>
  );
}

function filterLastNDays(events, n) {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - (n - 1));
  const startStr = toYmd(cutoff);
  return (events || []).filter(e => (e?.date || '') >= startStr);
}

function toYmd(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function buildAuditMarkdown({ user, kpi, recent, prescription, coachPlan }) {
  const lines = [];
  lines.push(`# 审计单`);
  lines.push(`- 用户：${user?.name || '—'}（ID: ${user?.user_id || '—'}）`);
  lines.push(`- 日期：${toYmd(new Date())}`);
  lines.push(``);
  lines.push(`## KPI`);
  lines.push(`- 周完成率：${kpi.weeklyCompletion}%`);
  lines.push(`- 误放行率（红/黄仍强行开始）：${kpi.falseClearanceRate}%`);
  lines.push(`- 绿色数据占比：${kpi.greenRate}%`);
  lines.push(`- 处方附规则编号率：${kpi.ruleAttachedRate}%`);
  lines.push(`- 处方与导师一致性：${kpi.coachConsistency ?? '待录入'}`);
  lines.push(``);
  lines.push(`## 当前处方（摘要）`);
  lines.push(`- 频率：每周 ${prescription?.fit?.freq ?? '—'} 天`);
  lines.push(`- 强度：${prescription?.fit?.intensity ?? '—'}`);
  lines.push(`- 时长：每次 ${prescription?.fit?.time ?? '—'} 分钟`);
  lines.push(`- 类型：${prescription?.fit?.type ?? '—'}`);
  lines.push(`- 规则编号：${(prescription?.rules || []).join('、') || '—'}`);
  lines.push(``);
  lines.push(`## 导师计划（占位）`);
  lines.push(`- 强度关键词：${coachPlan?.intensity || '—'}`);
  lines.push(`- 类型关键词：${coachPlan?.type || '—'}`);
  lines.push(``);
  lines.push(`## 最近闸门事件（14天）`);
  if (!recent || recent.length === 0) {
    lines.push(`- 无`);
  } else {
    for (const e of recent) {
      lines.push(`- ${e.date} | 状态：${e.status} | 强行开始：${e.forcedStart ? '是' : '否'} | 触发原因：${(e.reasons || []).join('；')} | 建议：${e.suggestedAction || '—'} | 事件ID：${e.event_id || '—'} | 处方ID：${e.prescription_id || '—'}`);
    }
  }
  lines.push(``);
  return lines.join('\n');
}

function buildMeasurementAuditMarkdown({ user, logs }) {
  const lines = [];
  lines.push(`# 测量审计日志`);
  lines.push(`- 用户：${user?.name || '—'}（ID: ${user?.user_id || '—'}）`);
  lines.push(`- 生成时间：${toYmd(new Date())}`);
  lines.push(``);
  if (!logs || logs.length === 0) {
    lines.push(`无审计记录`);
  } else {
    for (const l of logs) {
      const created = l.created_at ? toYmd(l.created_at) : '—';
      const p = l.payload || {};
      const metrics = [
        `收缩压:${p.systolic ?? '—'}`,
        `舒张压:${p.diastolic ?? '—'}`,
        `血糖:${p.blood_sugar ?? '—'}`,
        `心率:${p.heart_rate ?? '—'}`,
        `BMI:${p.bmi ?? '—'}`,
        `腰围:${p.waist ?? '—'}`,
        `RPE:${p.rpe ?? '—'}`,
        `6MWT:${p.six_mwt ?? '—'}`,
        `来源:${p.source ?? '—'}`,
        `来源类型:${p.source_type ?? '—'}`,
        `置信度:${typeof p.confidence_score === 'number' ? Math.round(p.confidence_score * 100) + '%' : '—'}`,
        `时间戳:${p.timestamp ?? '—'}`
      ].join('，');
      lines.push(`- ${created} | 动作：${l.action || '—'} | 状态：${l.status || '—'} | 原因：${l.reason || '—'} | 记录ID：${l.record_id || '—'} | 指标：${metrics}`);
    }
  }
  lines.push(``);
  return lines.join('\n');
}

function printMarkdown(md) {
  const w = window.open('', '_blank');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>审计单</title><style>body{font-family:system-ui,Segoe UI,Arial;max-width:800px;margin:24px auto;white-space:pre-wrap}</style></head><body><pre>${md}</pre></body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}