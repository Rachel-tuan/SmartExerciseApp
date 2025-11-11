import { Measurement, UserProfile, GateResult } from '../models/types';
import { PARQItem, VitalThresholds, AcuteSymptom } from './types';

// PAR-Q问卷项目
const PARQ_QUESTIONS: PARQItem[] = [
  {
    id: 'heart_condition',
    question: '医生是否曾告诉您患有心脏病？',
    answer: false,
    weight: 3
  },
  {
    id: 'chest_pain',
    question: '您在进行体力活动时是否感到胸痛？',
    answer: false,
    weight: 3
  },
  {
    id: 'dizziness',
    question: '您是否曾因头晕而失去平衡或失去知觉？',
    answer: false,
    weight: 2
  },
  {
    id: 'bone_joint',
    question: '您是否有骨骼或关节问题，运动可能使其恶化？',
    answer: false,
    weight: 2
  },
  {
    id: 'medication',
    question: '您目前是否正在服用血压或心脏病药物？',
    answer: false,
    weight: 2
  },
  {
    id: 'other_reason',
    question: '您是否知道有任何其他原因不应该进行体力活动？',
    answer: false,
    weight: 3
  }
];

// 生理指标安全阈值
const VITAL_THRESHOLDS: VitalThresholds = {
  systolicBP: { min: 90, max: 180 },
  diastolicBP: { min: 60, max: 110 },
  fastingGlucose: { min: 3.9, max: 11.1 },
  randomGlucose: { min: 3.9, max: 16.7 },
  heartRate: { min: 50, max: 100 }
};

// 急性症状列表
const ACUTE_SYMPTOMS: AcuteSymptom[] = [
  { id: 'chest_pain_acute', name: '胸痛或胸闷', severity: 'red', description: '运动中或静息时胸痛' },
  { id: 'shortness_breath', name: '呼吸困难', severity: 'red', description: '轻微活动即感呼吸困难' },
  { id: 'dizziness_acute', name: '头晕或晕厥', severity: 'red', description: '近期出现头晕或晕厥症状' },
  { id: 'palpitations', name: '心悸', severity: 'yellow', description: '心跳不规律或过快' },
  { id: 'fatigue', name: '异常疲劳', severity: 'yellow', description: '比平时更容易疲劳' },
  { id: 'swelling', name: '下肢水肿', severity: 'yellow', description: '脚踝或小腿肿胀' }
];

/**
 * 运动前安全闸门检查
 * 流程：PAR-Q → 阈值（血压/血糖/心率）→ 急性症状
 * 输出 GateResult 三色灯与原因与建议
 */
export function preExerciseGate(
  measurements: Measurement[],
  profile: UserProfile
): GateResult {
  const reasons: string[] = [];
  let status: 'green' | 'yellow' | 'red' = 'green';
  let suggestedAction: string | undefined;

  // 1) PAR-Q 简化评估
  const parq = checkPARQ(profile);
  if (parq.hasRisk) {
    status = 'red';
    reasons.push('PAR-Q 问卷提示高风险');
    suggestedAction = '停止并就医/复测（先咨询医生再运动）';
    return { status, reasons, suggestedAction };
  }

  // 2) 生理阈值检查
  const threshold = checkVitalThresholds(measurements);
  if (threshold.severity === 'red') {
    status = 'red';
    reasons.push(...threshold.violations);
    suggestedAction = '停止并就医/复测';
    return { status, reasons, suggestedAction };
  } else if (threshold.severity === 'yellow') {
    status = 'yellow';
    reasons.push(...threshold.violations);
    suggestedAction = '改为低强度散步/拉伸 10–15 分钟 + 运动后复测';
  }

  // 3) 急性症状（基于档案文本的简化识别）
  const symptom = checkAcuteSymptoms(profile);
  if (symptom.severity === 'red') {
    status = 'red';
    reasons.push(...symptom.symptoms);
    suggestedAction = '停止并就医/复测';
    return { status, reasons, suggestedAction };
  } else if (symptom.severity === 'yellow' && status === 'green') {
    status = 'yellow';
    reasons.push(...symptom.symptoms);
    suggestedAction = '改为低强度散步/拉伸 10–15 分钟 + 观察症状并复测';
  }

  return { status, reasons, suggestedAction };
}

/**
 * PAR-Q问卷检查
 */
function checkPARQ(profile: UserProfile): { score: number; hasRisk: boolean } {
  let score = 0;
  let hasRisk = false;

  // 年龄因子
  if (profile.age != null && profile.age >= 75) score += 2;
  else if (profile.age != null && profile.age >= 65) score += 1;

  // 慢病/病史因子
  const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
  const mhText = (profile as any)?.medical_history || (profile as any)?.medicalHistory || '';
  const mh = typeof mhText === 'string' ? mhText : '';
  const flags = [
    ...conditions,
    ...(mh.includes('心') ? ['heart'] : []),
    ...(mh.includes('高血压') ? ['hypertension'] : []),
    ...(mh.includes('糖尿病') ? ['diabetes'] : [])
  ];
  if (flags.includes('heart')) { score += 3; hasRisk = true; }
  if (flags.includes('hypertension')) { score += 2; }
  if (flags.includes('diabetes')) { score += 2; }

  if (score >= 5) hasRisk = true;
  return { score, hasRisk };
}

/**
 * 生理指标阈值检查
 */
function checkVitalThresholds(measurements: Measurement[]): {
  violations: string[];
  severity: 'green' | 'yellow' | 'red';
} {
  const violations: string[] = [];
  let severity: 'green' | 'yellow' | 'red' = 'green';

  // 获取最近的测量数据
  const latest = getLatestMeasurements(measurements);

  // 血压检查
  if (latest.bp) {
    const { systolic, diastolic } = latest.bp;
    
    if (systolic > VITAL_THRESHOLDS.systolicBP.max || systolic < VITAL_THRESHOLDS.systolicBP.min) {
      violations.push(`收缩压异常: ${systolic}mmHg`);
      severity = systolic > 200 || systolic < 80 ? 'red' : 'yellow';
    }
    
    if (diastolic > VITAL_THRESHOLDS.diastolicBP.max || diastolic < VITAL_THRESHOLDS.diastolicBP.min) {
      violations.push(`舒张压异常: ${diastolic}mmHg`);
      if (diastolic > 120 || diastolic < 50) severity = 'red';
      else if (severity === 'green') severity = 'yellow';
    }
  }

  // 血糖检查
  if (latest.bg != null) {
    const glucose = latest.bg.value;
    const isFasting = latest.bg.isFasting === true; // 若未标注则按随机血糖处理
    const threshold = isFasting ? VITAL_THRESHOLDS.fastingGlucose : VITAL_THRESHOLDS.randomGlucose;
    
    if (glucose > threshold.max || glucose < threshold.min) {
      violations.push(`血糖异常: ${glucose}mmol/L`);
      if (glucose > 20 || glucose < 3) severity = 'red';
      else if (severity === 'green') severity = 'yellow';
    }
  }

  // 心率检查
  if (latest.hr != null) {
    const hr = latest.hr;
    
    if (hr > VITAL_THRESHOLDS.heartRate.max || hr < VITAL_THRESHOLDS.heartRate.min) {
      violations.push(`心率异常: ${hr}bpm`);
      if (hr > 120 || hr < 40) severity = 'red';
      else if (severity === 'green') severity = 'yellow';
    }
  }

  return { violations, severity };
}

/**
 * 急性症状检查
 */
function checkAcuteSymptoms(profile: UserProfile): {
  symptoms: string[];
  severity: 'green' | 'yellow' | 'red';
} {
  // 基于用户档案文本简化识别近期急性症状关键词
  const text = ((profile as any)?.medical_history || (profile as any)?.medicalHistory || '') as string;
  const found: string[] = [];
  let severity: 'green' | 'yellow' | 'red' = 'green';
  if (text) {
    if (text.includes('胸痛') || text.includes('胸闷') || text.includes('晕厥') || text.includes('呼吸困难')) {
      severity = 'red';
      if (text.includes('胸痛') || text.includes('胸闷')) found.push('近期胸痛/胸闷');
      if (text.includes('呼吸困难')) found.push('近期呼吸困难');
      if (text.includes('晕厥')) found.push('近期晕厥');
    } else if (text.includes('心悸') || text.includes('疲劳') || text.includes('水肿')) {
      severity = 'yellow';
      if (text.includes('心悸')) found.push('心悸');
      if (text.includes('疲劳')) found.push('异常疲劳');
      if (text.includes('水肿')) found.push('下肢水肿');
    }
  }
  return { symptoms: found, severity };
}

/**
 * 获取最近的测量数据
 */
function getLatestMeasurements(measurements: Measurement[]) {
  const sorted = (measurements || [])
    .filter(m => m?.takenAt)
    .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());

  const result: {
    bp?: { systolic: number; diastolic: number };
    bg?: { value: number; isFasting?: boolean };
    hr?: number;
  } = {};

  const bp = sorted.find(m => m.type === 'bp');
  if (bp && typeof bp.value === 'object') {
    const v = bp.value as any;
    result.bp = { systolic: Number(v?.systolic || v?.sbp || 0), diastolic: Number(v?.diastolic || v?.dbp || 0) };
  }
  const bg = sorted.find(m => m.type === 'bg');
  if (bg) {
    const v = bg.value as any;
    result.bg = { value: Number(v?.value ?? v ?? 0), isFasting: Boolean(v?.isFasting) };
  }
  const hr = sorted.find(m => m.type === 'hr');
  if (hr && typeof hr.value === 'number') {
    result.hr = Number(hr.value);
  }

  return result;
}