import { Measurement, UserProfile, Prescription } from '../models/types';
import { PrescriptionRule } from './types';
import { crfFuse } from './crfFuse';
import { preExerciseGate } from './safetyGate';

/**
 * 生成运动处方
 * @param profile 用户档案
 * @param measurements 测量数据
 * @returns 运动处方
 */
export function generatePrescription(
  profile: UserProfile,
  measurements: Measurement[]
): Prescription {
  const baselineIntensity = calculateBaselineIntensity(profile, measurements);
  const applicableRules = PRESCRIPTION_RULES
    .filter(rule => rule.condition(profile, measurements))
    .sort((a, b) => b.priority - a.priority);

  // 基础 FITT 模板
  let prescription: Prescription = {
    prescription_id: `pr_${Date.now()}`,
    createdAt: new Date().toISOString(),
    fit: {
      freq: 3,
      intensity: baselineIntensity,
      time: 30,
      type: '快走'
    },
    rules: []
  };

  const outputs = applicableRules.map(r => {
    const m: any = r.action(profile, measurements) || {};
    const fit: any = m.fit ? m.fit : {
      freq: m.frequency,
      intensity: m.intensity,
      time: m.time,
      type: m.exerciseType
    };
    return { id: r.id, priority: r.priority, confidence: 1, fit };
  });
  prescription.rules = applicableRules.map(r => r.id);

  const useCrf = CRF_CONFIG.USE_CRF === true;
  let fusedFit = prescription.fit;
  let explain: any = { top: [], alpha: 0, beta: 0 };
  if (useCrf && outputs.length > 0) {
    const res = crfFuse(outputs, { profile, measurements }, { alpha: CRF_CONFIG.alpha, beta: CRF_CONFIG.beta, priorityFactors: CRF_CONFIG.priorityFactors, kernelInit: CRF_CONFIG.kernelInit });
    fusedFit = res.fusedFit;
    explain = res.explain;
  } else if (outputs.length > 0) {
    const last = outputs[outputs.length - 1].fit || {};
    fusedFit = { ...prescription.fit, ...last } as any;
  }

  const safe = preExerciseGate(measurements, profile);
  if (safe.status === 'red') {
    prescription.fit = { freq: Math.max(1, fusedFit.freq - 1), intensity: '低强度', time: Math.max(20, fusedFit.time - 10), type: fusedFit.type };
  } else {
    prescription.fit = fusedFit;
  }
  prescription.explain = explain;

  return prescription;
}

/**
 * 计算基础运动强度
 */
function calculateBaselineIntensity(profile: UserProfile, measurements: Measurement[]): string {
  const age = profile.age;
  const bmi = calculateBMI(profile);
  const hasCardiovascular = hasCardiovascularRisk(profile, measurements);

  if (age >= 65 || hasCardiovascular || bmi >= 30) return '低强度';
  if (age >= 50 || bmi >= 25) return '中低强度';
  return '中等强度';
}

/**
 * 计算目标心率
 */
// 目标心率在当前处方模型中不直接展示，如需可在后续扩展

/**
 * 计算BMI
 */
function calculateBMI(profile: UserProfile): number {
  if (!profile.height || !profile.weight) return 0;
  const heightInM = profile.height / 100;
  return profile.weight / (heightInM * heightInM);
}

/**
 * 检查心血管风险
 */
function hasCardiovascularRisk(profile: UserProfile, measurements: Measurement[]): boolean {
  const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
  // 使用英文代码判断心血管风险
  if (conditions.includes('heart_disease') || conditions.includes('coronary_heart_disease') || conditions.includes('hypertension')) return true;
  const latestBP = getLatestBloodPressure(measurements);
  if (latestBP && (latestBP.systolic >= 140 || latestBP.diastolic >= 90)) return true;
  return false;
}

/**
 * 获取最新血压数据
 */
function getLatestBloodPressure(measurements: Measurement[]): { systolic: number; diastolic: number } | null {
  const bpMeasurement = measurements
    .filter(m => m.type === 'bp')
    .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];

  if (bpMeasurement && typeof bpMeasurement.value === 'object') {
    const v = bpMeasurement.value as any;
    return { systolic: Number(v?.systolic ?? v?.sbp ?? 0), diastolic: Number(v?.diastolic ?? v?.dbp ?? 0) };
  }
  return null;
}

/**
 * 获取最新血糖数据
 */
function getLatestBloodGlucose(measurements: Measurement[]): number | null {
  const bgMeasurement = measurements
    .filter(m => m.type === 'bg')
    .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];

  if (bgMeasurement) {
    const v = bgMeasurement.value as any;
    return Number(typeof v === 'number' ? v : v?.value);
  }
  return null;
}

function getLatestBloodGlucoseDetail(measurements: Measurement[]): { value: number; isFasting?: boolean } | null {
  const bgMeasurement = measurements
    .filter(m => m.type === 'bg')
    .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];
  if (!bgMeasurement) return null;
  const v = bgMeasurement.value as any;
  if (typeof v === 'number') return { value: Number(v), isFasting: undefined };
  return { value: Number(v?.value), isFasting: Boolean(v?.isFasting) };
}

function glucoseRiskTier(bg: { value: number; isFasting?: boolean } | null): 'high' | 'medium' | 'low' {
  if (!bg || !Number.isFinite(bg.value)) return 'low';
  if (bg.isFasting) {
    if (bg.value >= 7.0) return 'high';
    if (bg.value >= 6.1) return 'medium';
    return 'low';
  } else {
    if (bg.value >= 11.1) return 'high';
    if (bg.value >= 7.8) return 'medium';
    return 'low';
  }
}

// 处方规则定义（按优先级排序）
const PRESCRIPTION_RULES: PrescriptionRule[] = [
  // 高优先级：肥胖 + 高血压
  {
    id: 'OB-HTN-001',
    name: '肥胖合并高血压',
    source: '中国成人血压分层指南 + 肥胖防治指南',
    priority: 10,
    condition: (profile, measurements) => {
      const bmi = calculateBMI(profile);
      const bp = getLatestBloodPressure(measurements);
      return bmi >= 28 && bp !== null && (bp.systolic >= 140 || bp.diastolic >= 90);
    },
    action: () => ({
      fit: { freq: 5, intensity: '低强度', time: 45, type: '快走 + 水中运动' }
    })
  },

  // 高血压专项规则
  {
    id: 'HTN-001',
    name: '高血压运动处方',
    source: '中国成人血压分层指南',
    evidence: ['R4', 'R5', 'R6'],
    priority: 8,
    condition: (profile, measurements) => {
      const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
      const bp = getLatestBloodPressure(measurements);
      // 英文编码：hypertension
      return conditions.includes('hypertension') ||
        (bp !== null && (bp.systolic >= 140 || bp.diastolic >= 90));
    },
    action: () => ({ fit: { freq: 4, intensity: '低强度', time: 30, type: '有氧步行 + 伸展' } })
  },

  // 肥胖专项规则
  {
    id: 'OB-001',
    name: '肥胖运动处方',
    source: '中国成人肥胖防治专家共识',
    priority: 6,
    condition: (profile) => {
      const bmi = calculateBMI(profile);
      return bmi >= 28;
    },
    action: () => ({ fit: { freq: 5, intensity: '中低强度', time: 50, type: '快走 + 游泳' } })
  },

  // 糖尿病规则
  {
    id: 'DM-001',
    name: '糖尿病运动处方',
    source: '中国2型糖尿病防治指南',
    evidence: ['R1', 'R2', 'R3'],
    priority: 8,
    condition: (profile, measurements) => {
      const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
      const bg = getLatestBloodGlucoseDetail(measurements);
      const risk = glucoseRiskTier(bg);
      return conditions.includes('diabetes') ||
             ((bg != null) && (risk !== 'low'));
    },
    action: () => ({ fit: { freq: 4, intensity: '中低强度', time: 35, type: '快走 + 骑行 + 抗阻训练' } })
  },

  // 超重规则
  {
    id: 'OW-001',
    name: '超重运动处方',
    source: '中国居民膳食指南',
    evidence: ['R19', 'R20', 'R21'],
    priority: 6,
    condition: (profile) => {
      const bmi = calculateBMI(profile);
      return bmi >= 24 && bmi < 28;
    },
    action: () => ({ fit: { freq: 4, intensity: '中等强度', time: 40, type: '快走 + 慢跑' } })
  },

  // 老年人规则
  {
    id: 'AGE-001',
    name: '老年人运动处方',
    source: '老年人运动健身指南',
    evidence: ['R31', 'R32'],
    priority: 7,
    condition: (profile) => profile.age >= 65,
    action: () => ({ fit: { freq: 3, intensity: '低强度', time: 30, type: '太极拳 + 散步' } })
  },

  // 中年人规则
  {
    id: 'MID-001',
    name: '中年人运动处方',
    source: '成人体力活动指南',
    evidence: ['R31', 'R33'],
    priority: 5,
    condition: (profile) => profile.age >= 40 && profile.age < 65,
    action: () => ({ fit: { freq: 3, intensity: '中等强度', time: 35, type: '快走 + 抗阻训练' } })
  },

  // 青年人规则
  {
    id: 'YNG-001',
    name: '青年人运动处方',
    source: '青年体力活动指南',
    priority: 4,
    condition: (profile) => profile.age < 40,
    action: () => ({ fit: { freq: 4, intensity: '中等强度', time: 40, type: '跑步 + 力量训练' } })
  },

  // 心率异常规则
  {
    id: 'HR-001',
    name: '心率异常运动处方',
    source: '心律失常运动指导',
    priority: 8,
    condition: (profile, measurements) => {
      const hrMeasurement = measurements
        .filter(m => m.type === 'hr')
        .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];
      if (hrMeasurement && typeof hrMeasurement.value === 'number') {
        const hr = Number(hrMeasurement.value);
        return hr > 100 || hr < 60;
      }
      return false;
    },
    action: () => ({ fit: { freq: 3, intensity: '低强度', time: 25, type: '散步 + 呼吸训练' } })
  },

  // 关节问题规则
  {
    id: 'JNT-001',
    name: '关节问题运动处方',
    source: '骨关节炎运动治疗指南',
    priority: 6,
    condition: (profile) => {
      const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
      // 英文编码：arthritis
      return conditions.includes('arthritis');
    },
    action: () => ({ fit: { freq: 3, intensity: '低强度', time: 30, type: '水中运动 + 柔韧性训练' } })
  },
  {
    id: 'CHD-001',
    name: '冠心病运动处方',
    source: '循证规则集',
    evidence: ['R7', 'R8', 'R9'],
    priority: 8,
    condition: (profile) => {
      const c = Array.isArray(profile.conditions) ? profile.conditions : [];
      return c.includes('coronary_heart_disease') || c.includes('heart_disease') || c.includes('angina');
    },
    action: () => ({ fit: { freq: 4, intensity: '低强度', time: 25, type: '慢走 + 呼吸训练' } })
  },
  {
    id: 'HF-001',
    name: '心力衰竭运动处方',
    source: '循证规则集',
    evidence: ['R10', 'R11', 'R12'],
    priority: 8,
    condition: (profile) => {
      const c = Array.isArray(profile.conditions) ? profile.conditions : [];
      return c.includes('heart_failure');
    },
    action: () => ({ fit: { freq: 5, intensity: '极低强度', time: 20, type: '间歇步行 + 坐位运动' } })
  },
  {
    id: 'ARR-001',
    name: '心律失常运动处方',
    source: '循证规则集',
    evidence: ['R13', 'R14', 'R15'],
    priority: 8,
    condition: (profile) => {
      const c = Array.isArray(profile.conditions) ? profile.conditions : [];
      return c.includes('arrhythmia');
    },
    action: () => ({ fit: { freq: 3, intensity: '低强度', time: 25, type: '步行 + 轻柔瑜伽' } })
  },
  {
    id: 'STROKE-001',
    name: '卒中后运动处方',
    source: '循证规则集',
    evidence: ['R16', 'R17', 'R18'],
    priority: 8,
    condition: (profile) => {
      const c = Array.isArray(profile.conditions) ? profile.conditions : [];
      return c.includes('stroke');
    },
    action: () => ({ fit: { freq: 5, intensity: '低强度', time: 20, type: '平衡训练 + 辅助步行' } })
  },
  {
    id: 'KOA-001',
    name: '膝骨关节炎运动处方',
    source: '循证规则集',
    evidence: ['R22', 'R23', 'R24'],
    priority: 6,
    condition: (profile) => {
      const c = Array.isArray(profile.conditions) ? profile.conditions : [];
      return c.includes('knee_osteoarthritis');
    },
    action: () => ({ fit: { freq: 4, intensity: '低强度', time: 30, type: '骑行 + 水中步行 + 股四头肌训练' } })
  },
  {
    id: 'LBP-001',
    name: '下背痛运动处方',
    source: '循证规则集',
    evidence: ['R25', 'R26', 'R27'],
    priority: 6,
    condition: (profile) => {
      const c = Array.isArray(profile.conditions) ? profile.conditions : [];
      return c.includes('low_back_pain');
    },
    action: () => ({ fit: { freq: 4, intensity: '低强度', time: 25, type: '核心训练 + 猫牛式 + 伸展' } })
  },
  {
    id: 'OSTEOP-001',
    name: '骨质疏松运动处方',
    source: '循证规则集',
    evidence: ['R28', 'R29', 'R30'],
    priority: 6,
    condition: (profile) => {
      const c = Array.isArray(profile.conditions) ? profile.conditions : [];
      return c.includes('osteoporosis');
    },
    action: () => ({ fit: { freq: 4, intensity: '低强度', time: 30, type: '平衡训练 + 抗阻训练' } })
  }
];



export function getRuleMetaById(id: string): { id: string; name: string; source: string; evidence?: string[] } | undefined {
  const rule = PRESCRIPTION_RULES.find(r => r.id === id);
  if (!rule) return undefined;
  return { id: rule.id, name: rule.name, source: rule.source, evidence: rule.evidence };
}

export function getRuleRecommendedFitById(id: string): { freq: number; intensity: string; time: number; type: string } | undefined {
  switch (id) {
    case 'MID-001':
      return { freq: 3, intensity: '中等强度', time: 35, type: '快走 + 抗阻训练' };
    case 'AGE-001':
      return { freq: 3, intensity: '低强度', time: 30, type: '太极拳 + 散步' };
    case 'DM-001':
      return { freq: 4, intensity: '中低强度', time: 35, type: '快走 + 骑行 + 抗阻训练' };
    case 'OW-001':
      return { freq: 4, intensity: '中等强度', time: 40, type: '快走 + 慢跑' };
    case 'OB-001':
      return { freq: 5, intensity: '中低强度', time: 50, type: '快走 + 游泳' };
    case 'HTN-001':
      return { freq: 4, intensity: '低强度', time: 30, type: '有氧步行 + 伸展' };
    case 'OB-HTN-001':
      return { freq: 5, intensity: '低强度', time: 45, type: '快走 + 水中运动' };
    case 'HR-001':
      return { freq: 3, intensity: '低强度', time: 25, type: '散步 + 呼吸训练' };
    case 'JNT-001':
      return { freq: 3, intensity: '低强度', time: 30, type: '水中运动 + 柔韧性训练' };
    case 'YNG-001':
      return { freq: 4, intensity: '中等强度', time: 40, type: '跑步 + 力量训练' };
    case 'CHD-001':
      return { freq: 4, intensity: '低强度', time: 25, type: '慢走 + 呼吸训练' };
    case 'HF-001':
      return { freq: 5, intensity: '极低强度', time: 20, type: '间歇步行 + 坐位运动' };
    case 'ARR-001':
      return { freq: 3, intensity: '低强度', time: 25, type: '步行 + 轻柔瑜伽' };
    case 'STROKE-001':
      return { freq: 5, intensity: '低强度', time: 20, type: '平衡训练 + 辅助步行' };
    case 'KOA-001':
      return { freq: 4, intensity: '低强度', time: 30, type: '骑行 + 水中步行 + 股四头肌训练' };
    case 'LBP-001':
      return { freq: 4, intensity: '低强度', time: 25, type: '核心训练 + 猫牛式 + 伸展' };
    case 'OSTEOP-001':
      return { freq: 4, intensity: '低强度', time: 30, type: '平衡训练 + 抗阻训练' };
    default:
      return undefined;
  }
}

export function getRulePriorityById(id: string): number | undefined {
  const rule = PRESCRIPTION_RULES.find(r => r.id === id);
  return rule?.priority;
}

export function listRulesMeta(): Array<{ id: string; name: string; priority: number; evidence?: string[] }> {
  return PRESCRIPTION_RULES.map(r => ({ id: r.id, name: r.name, priority: r.priority, evidence: r.evidence }));
}

export function ensureFourRules(
  ids: string[],
  profile: UserProfile,
  measurements: Measurement[]
): string[] {
  const set = new Set<string>(Array.isArray(ids) ? ids : []);
  set.add('AGE-001');
  const applicable = PRESCRIPTION_RULES
    .filter(r => {
      try { return r.condition(profile, measurements); } catch { return false; }
    })
    .map(r => r.id)
    .filter(id => !set.has(id));
  for (const id of applicable) {
    if (set.size >= 4) break;
    set.add(id);
  }
  if (set.size < 4) {
    const fallback = PRESCRIPTION_RULES
      .map(r => r.id)
      .filter(id => !set.has(id));
    for (const id of fallback) {
      if (set.size >= 4) break;
      set.add(id);
    }
  }
  const arr = Array.from(set);
  arr.sort((a, b) => (getRulePriorityById(b) ?? 0) - (getRulePriorityById(a) ?? 0));
  return arr.slice(0, 4);
}

export const CRF_CONFIG: { USE_CRF: boolean; alpha: number; beta: number; priorityFactors?: Record<number, number>; kernelInit?: number } = {
  USE_CRF: true,
  alpha: 1,
  beta: 0.1,
  priorityFactors: { 8: 1.25, 7: 1.12, 6: 1.0, 5: 0.9 },
  kernelInit: 0
};

export function setCRFConfig(cfg: Partial<typeof CRF_CONFIG>) {
  Object.assign(CRF_CONFIG, cfg);
}

export function getCRFConfig() {
  return { ...CRF_CONFIG };
}