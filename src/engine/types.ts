import { GateResult, Measurement, UserProfile, Prescription, AdherenceLog } from '../models/types';

// 安全检查结果扩展
export interface SafetyCheckResult extends GateResult {
  parqScore?: number;
  thresholdViolations?: string[];
  acuteSymptoms?: string[];
  recommendation?: string;
}

// PAR-Q问卷项目
export interface PARQItem {
  id: string;
  question: string;
  answer: boolean;
  weight: number;
}

// 处方规则定义
export interface PrescriptionRule {
  id: string;
  name: string;
  source: string;
  priority: number;
  evidence?: string[];
  condition: (profile: UserProfile, measurements: Measurement[]) => boolean;
  action: (profile: UserProfile, measurements: Measurement[]) => Partial<Prescription>;
}

// 调整因子
export interface AdjustmentFactor {
  adherenceRate: number;
  averageRPE: number;
  weeksSinceStart: number;
}

// 阈值定义
export interface VitalThresholds {
  systolicBP: { min: number; max: number; };
  diastolicBP: { min: number; max: number; };
  fastingGlucose: { min: number; max: number; };
  randomGlucose: { min: number; max: number; };
  heartRate: { min: number; max: number; };
}

// 急性症状列表
export interface AcuteSymptom {
  id: string;
  name: string;
  severity: 'yellow' | 'red';
  description: string;
}