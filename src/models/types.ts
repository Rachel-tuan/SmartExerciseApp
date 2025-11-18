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

// 明确血糖值结构，支持空腹/随机标注
export interface BloodGlucoseValue {
  value: number;
  isFasting?: boolean; // true: 空腹；false/undefined: 随机
}

export interface Measurement {
  type: MeasurementType;
  value:
    | { systolic: number; diastolic: number } // bp
    | BloodGlucoseValue // bg（兼容旧数据：可能为纯 number）
    | number; // hr 或旧版 bg
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
  prescription_id: string;
  createdAt: string; // ISO string
  fit: {
    freq: number;      // 次/周
    intensity: string; // 低/中/高，或RPE
    time: number;      // 每次分钟
    type: string;      // 运动类型，如步行、骑行
  };
  rules: string[];    // 管理与预警规则
  rules_for_ui?: string[];
  explain?: any;
}

export interface AdherenceLog {
  date: string;         // YYYY-MM-DD
  plannedMins: number;  // 计划时长（分钟）
  completedMins: number;// 完成时长（分钟）
  rpe?: number;         // 主观用力（1-10）
  symptoms?: string[];  // 不适症状记录
}