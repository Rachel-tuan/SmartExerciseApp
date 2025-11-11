import { Measurement, UserProfile, Prescription } from '../models/types';
import { PrescriptionRule } from './types';

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
    id: `pr_${Date.now()}`,
    createdAt: new Date().toISOString(),
    fit: {
      freq: 3,
      intensity: baselineIntensity,
      time: 30,
      type: '快走'
    },
    rules: []
  };

  // 应用规则修改处方（记录规则编号）
  for (const rule of applicableRules) {
    const modification = rule.action(profile, measurements);
    // 支持规则返回 fit 层级，或兼容旧字段
    if ((modification as any)?.fit) {
      prescription.fit = { ...prescription.fit, ...(modification as any).fit };
    } else {
      const m: any = modification;
      if (m.frequency != null) prescription.fit.freq = m.frequency;
      if (m.intensity != null) prescription.fit.intensity = m.intensity;
      if (m.time != null) prescription.fit.time = m.time;
      if (m.exerciseType != null) prescription.fit.type = m.exerciseType;
    }
    prescription.rules.push(rule.id);
  }

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
  if (conditions.includes('心脏病') || conditions.includes('高血压')) return true;
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
    priority: 9,
    condition: (profile, measurements) => {
      const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
      const bp = getLatestBloodPressure(measurements);
      return conditions.includes('高血压') || 
             (bp !== null && (bp.systolic >= 140 || bp.diastolic >= 90));
    },
    action: (profile, measurements) => {
      const bp = getLatestBloodPressure(measurements);
      const isStage2 = bp && (bp.systolic >= 160 || bp.diastolic >= 100);
      return { fit: { freq: 4, intensity: isStage2 ? '低强度' : '中低强度', time: 40, type: '快走 + 太极拳' } };
    }
  },

  // 肥胖专项规则
  {
    id: 'OB-001',
    name: '肥胖运动处方',
    source: '中国成人肥胖防治专家共识',
    priority: 8,
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
    priority: 8,
    condition: (profile, measurements) => {
      const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
      const glucose = getLatestBloodGlucose(measurements);
      return conditions.includes('糖尿病') || 
             (glucose !== null && glucose >= 7.0);
    },
    action: () => ({ fit: { freq: 4, intensity: '中等强度', time: 35, type: '快走 + 抗阻训练' } })
  },

  // 超重规则
  {
    id: 'OW-001',
    name: '超重运动处方',
    source: '中国居民膳食指南',
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
    priority: 7,
    condition: (profile) => profile.age >= 65,
    action: () => ({ fit: { freq: 3, intensity: '低强度', time: 30, type: '太极拳 + 散步' } })
  },

  // 中年人规则
  {
    id: 'MID-001',
    name: '中年人运动处方',
    source: '成人体力活动指南',
    priority: 5,
    condition: (profile) => profile.age >= 40 && profile.age < 65,
    action: () => ({ fit: { freq: 4, intensity: '中等强度', time: 35, type: '快走 + 力量训练' } })
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
    priority: 7,
    condition: (profile) => {
      const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
      return conditions.some(condition => 
        condition.includes('关节炎') || condition.includes('关节'))
    },
    action: () => ({ fit: { freq: 3, intensity: '低强度', time: 30, type: '水中运动 + 柔韧性训练' } })
  }
];