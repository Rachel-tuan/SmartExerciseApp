// 计算测量数据的置信度分数（0~1）
// 设计思路：来源类型、时间新鲜度、数据完整度三因素综合，并做边界约束与四舍五入。

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function round2(val) {
  return Math.round(val * 100) / 100;
}

function parseMeasuredTime(record) {
  const t = record?.measuredAt || record?.timestamp || record?.record_date;
  try {
    return t ? new Date(t) : new Date();
  } catch (_) {
    return new Date();
  }
}

function computeRecencyFactor(record) {
  const now = new Date();
  const measured = parseMeasuredTime(record);
  const diffMs = Math.abs(now.getTime() - measured.getTime());
  const diffHours = diffMs / 3600000; // ms -> hours
  // 7天窗口：越新鲜得分越高，设置下限避免过低
  const raw = 1 - diffHours / 168; // 168小时=7天
  return clamp(raw, 0.2, 1);
}

function computeCompletenessFactor(record) {
  const fields = [
    record?.systolic,
    record?.diastolic,
    record?.blood_sugar,
    record?.weight,
    record?.height
  ];
  const present = fields.reduce((acc, v) => acc + (v !== undefined && v !== null ? 1 : 0), 0);
  // 0.5~1.0之间，越完整越高
  return 0.5 + (present / fields.length) * 0.5;
}

function computeSourceBase(record) {
  const st = (record?.source_type || '').toLowerCase();
  if (st === 'manual') return 0.6;
  if (st === 'device') return record?.source_id ? 0.9 : 0.85;
  if (st === 'app') return 0.8;
  if (st) return 0.7;
  return 0.7; // 未指定来源的默认
}

export function computeConfidenceScore(record) {
  // 若已有可信的历史值，直接返回（兼容旧数据流程）
  if (typeof record?.confidence_score === 'number' && record.confidence_score >= 0 && record.confidence_score <= 1) {
    return round2(clamp(record.confidence_score, 0, 1));
  }

  const base = computeSourceBase(record);
  const recency = computeRecencyFactor(record);
  const completeness = computeCompletenessFactor(record);
  const score = base * recency * completeness;
  return round2(clamp(score, 0.1, 1));
}

export default computeConfidenceScore;