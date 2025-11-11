// 安全闸门和规则引擎主入口文件
export { preExerciseGate } from './safetyGate';
export { generatePrescription } from './prescriptionEngine';
export { adjustWeeklyPrescription } from './adjustmentEngine';

// 导出类型定义
export type { SafetyCheckResult, PrescriptionRule, AdjustmentFactor } from './types';