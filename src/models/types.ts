// 基础数据模型接口定义

export interface UserProfile {
  age: number;
  sex: 'male' | 'female' | 'other' | string;
  height?: number; // cm
  weight?: number; // kg
  waist?: number;  // cm
  conditions: string[]; // 既往病史/慢病类型
}

export type MeasurementType = 'bp' | 'bg' | 'hr';
export type MeasurementSource = 'clinical' | 'wearable' | 'manual';

export interface Measurement {
  type: MeasurementType;
  value: any; // bp: { systolic:number, diastolic:number } | bg: number | hr: number
  takenAt: string; // ISO string
  source: MeasurementSource;
}

export type GateStatus = 'green' | 'yellow' | 'red';

export interface GateResult {
  status: GateStatus;
  reasons: string[];
  suggestedAction?: string;
}

export interface Prescription {
  id: string;
  createdAt: string; // ISO string
  fit: {
    freq: number;      // 次/周
    intensity: string; // 低/中/高，或RPE
    time: number;      // 每次分钟
    type: string;      // 运动类型，如步行、骑行
  };
  rules: string[];    // 管理与预警规则
}

export interface AdherenceLog {
  date: string;         // YYYY-MM-DD
  plannedMins: number;  // 计划时长（分钟）
  completedMins: number;// 完成时长（分钟）
  rpe?: number;         // 主观用力（1-10）
  symptoms?: string[];  // 不适症状记录
}