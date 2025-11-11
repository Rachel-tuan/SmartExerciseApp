// 个体化运动处方（循证规则）
// 说明：本模块按照通用循证建议进行工程化实现，用于原型演示。
// 数据来源参考（摘要化表达，仅作产品演示用途）：
// - 中国成人超重和肥胖预防控制指南（节选：体重管理与体力活动建议）
// - 高血压防治指南（节选：生活方式干预与运动建议）
// - 中国2型糖尿病防治指南（节选：运动治疗原则）

import { computeBMI, ALERTS } from './rules'

function numberOrNull(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v : null
}

export function classifyBMI(bmi) {
  if (bmi == null) return { category: '未知', label: '—' }
  const n = Number(bmi)
  if (n >= 28) return { category: '肥胖', label: 'BMI≥28' }
  if (n >= 24) return { category: '超重', label: '24≤BMI<28' }
  if (n < 18.5) return { category: '偏低', label: 'BMI<18.5' }
  return { category: '正常', label: '18.5≤BMI<24' }
}

export function stageBloodPressure(systolic, diastolic) {
  const s = numberOrNull(systolic)
  const d = numberOrNull(diastolic)
  if (s == null || d == null) return { stage: '未知', label: '—' }

  if (s >= 180 || d >= 110) return { stage: '重度升高', label: '≥180/110' }
  if (s >= 160 || d >= 100) return { stage: '中度升高', label: '≥160/100' }
  if (s >= 140 || d >= 90) return { stage: '轻度升高', label: '≥140/90' }
  return { stage: '正常/理想', label: '<140/90' }
}

export function statusBloodSugar(bloodSugar) {
  const v = numberOrNull(bloodSugar)
  if (v == null) return { status: '未知', label: '—' }
  if (v < ALERTS.BLOOD_SUGAR.low) return { status: '偏低', label: `<${ALERTS.BLOOD_SUGAR.low}` }
  if (v > ALERTS.BLOOD_SUGAR.high) return { status: '偏高', label: `>${ALERTS.BLOOD_SUGAR.high}` }
  return { status: '正常', label: '正常范围' }
}

function deriveBMI(user, latestRecord) {
  const h = numberOrNull(user?.height) ?? numberOrNull(latestRecord?.height)
  const w = numberOrNull(user?.weight) ?? numberOrNull(latestRecord?.weight)
  if (!h || !w) return null
  return Number(computeBMI(h, w))
}

// 根据指标生成处方与风险提示
export function generateExercisePrescription({ user, latestRecord }) {
  const age = numberOrNull(user?.age)
  const gender = user?.gender || 'unknown'
  const systolic = numberOrNull(latestRecord?.systolic)
  const diastolic = numberOrNull(latestRecord?.diastolic)
  const bloodSugar = numberOrNull(latestRecord?.blood_sugar)
  const bmi = deriveBMI(user, latestRecord)

  const bmiInfo = classifyBMI(bmi)
  const bpInfo = stageBloodPressure(systolic, diastolic)
  const bsInfo = statusBloodSugar(bloodSugar)

  const warnings = []
  const ruleTrace = []

  // 基础处方（可被规则修正）
  let aerobic = {
    types: ['快走', '骑行', '游泳（可选）'],
    intensity: '中等强度（RPE 11-13）',
    frequencyDaysPerWeek: 5,
    durationMinutes: [30, 45]
  }
  let resistance = {
    frequencyDaysPerWeek: 2,
    setsPerMuscleGroup: [1, 3],
    repsPerSet: [8, 12],
    notes: ['避免屏气（瓦尔萨尔瓦动作）', '动作缓慢、全程']
  }
  const balanceFlex = (age && age >= 65)
    ? { frequencyDaysPerWeek: 2, items: ['单脚站立', '八段锦/太极', '关节活动度'] }
    : null

  // 依据 BMI 调整
  if (bmiInfo.category === '肥胖') {
    aerobic.frequencyDaysPerWeek = 5 // 5-7天，工程上默认5
    aerobic.durationMinutes = [40, 60]
    ruleTrace.push({ code: 'BMI_OBESITY', desc: '肥胖：增加有氧时长与频率' })
  } else if (bmiInfo.category === '超重') {
    aerobic.durationMinutes = [30, 60]
    ruleTrace.push({ code: 'BMI_OVERWEIGHT', desc: '超重：维持中等强度，30-60分钟' })
  } else if (bmiInfo.category === '偏低') {
    aerobic.intensity = '低-中等强度（RPE 9-11）'
    aerobic.durationMinutes = [20, 30]
    ruleTrace.push({ code: 'BMI_UNDERWEIGHT', desc: '偏低：循序渐进，低-中强度' })
  } else {
    ruleTrace.push({ code: 'BMI_NORMAL', desc: 'BMI正常：常规推荐' })
  }

  // 依据血压分层
  if (bpInfo.stage === '中度升高' || bpInfo.stage === '重度升高') {
    aerobic.intensity = '低-中等强度（RPE 9-11）'
    warnings.push('血压偏高：避免剧烈运动，延长热身与放松；运动前后监测血压')
    resistance.repsPerSet = [10, 15]
    ruleTrace.push({ code: 'HTN_HIGH', desc: '高血压：限制强度，强调监测' })
  } else if (bpInfo.stage === '轻度升高') {
    warnings.push('血压偏高：建议每次运动后自测血压，逐步进阶')
    ruleTrace.push({ code: 'HTN_STAGE1', desc: '轻度升高：中等强度、循序渐进' })
  }

  // 依据血糖状态
  if (bsInfo.status === '偏高') {
    warnings.push('血糖偏高：注意补水，监测血糖；如>16.7mmol/L建议暂缓')
    ruleTrace.push({ code: 'DM_HIGH_GLU', desc: '高血糖：留意症状，必要时暂缓' })
  } else if (bsInfo.status === '偏低') {
    warnings.push('血糖偏低：先进食补充碳水，避免空腹剧烈运动')
    ruleTrace.push({ code: 'DM_LOW_GLU', desc: '低血糖：运动前先进食' })
  }

  // 老年人补充
  if (age && age >= 65) {
    warnings.push('老年人：优先选择安全可控项目，注意防跌倒')
    ruleTrace.push({ code: 'ELDERLY', desc: '≥65岁：加入平衡与柔韧练习' })
  }

  const plannedSessionsPerWeek = aerobic.frequencyDaysPerWeek // 用有氧频次作为计划基准
  const sessionMinutes = aerobic.durationMinutes

  const prescription = {
    summary: {
      age,
      gender,
      bmi,
      bmiCategory: bmiInfo.category,
      bloodPressure: { systolic, diastolic, stage: bpInfo.stage },
      bloodSugar: { value: bloodSugar, status: bsInfo.status }
    },
    plan: {
      aerobic,
      resistance,
      balanceFlex,
      weekly: { plannedSessionsPerWeek, sessionMinutes }
    },
    warnings,
    references: [
      '中国成人超重和肥胖预防控制指南（体力活动建议）',
      '高血压防治指南（生活方式干预·运动处方）',
      '中国2型糖尿病防治指南（运动治疗原则）'
    ],
    ruleTrace
  }

  return prescription
}

// 计算某周的处方达标率（打卡完成/计划次数）
export function computeAdherenceForWeek({ completedCount, plannedSessions }) {
  if (!plannedSessions || plannedSessions <= 0) return 0
  const ratio = Math.min(completedCount / plannedSessions, 1)
  return Math.round(ratio * 100)
}