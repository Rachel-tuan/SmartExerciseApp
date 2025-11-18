// 安全闸门和规则引擎主入口文件
export { preExerciseGate } from './safetyGate';
export { generatePrescription } from './prescriptionEngine';
export { adjustWeeklyPrescription } from './adjustmentEngine';
export { getRuleMetaById } from './prescriptionEngine';
export { getRuleRecommendedFitById } from './prescriptionEngine';
export { getRulePriorityById } from './prescriptionEngine';
export { ensureFourRules } from './prescriptionEngine';
export { CRF_CONFIG, setCRFConfig, getCRFConfig } from './prescriptionEngine';
export { crfFuse } from './crfFuse';
export { buildAuditMarkdownWithEvidence, generateAuditCSV } from './buildAuditMarkdown';
export { listRulesMeta } from './prescriptionEngine';

// 导出类型定义
export type { SafetyCheckResult, PrescriptionRule, AdjustmentFactor } from './types';