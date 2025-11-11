/*
  轻量存储封装：localStorage 起步，预留 Supabase 适配。
  - 所有API返回 Promise，以便后续切换为远端存储。
*/
import type { UserProfile, Measurement, Prescription, AdherenceLog, GateResult, GateStatus } from './types';

type Key = 'user_profile' | 'measurements' | 'prescriptions' | 'adherence_logs' | 'gate_events';

let supabaseClient: any | null = null;
export function configureSupabase(client: any) {
  supabaseClient = client;
}

function lsGet<T>(key: Key, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (_e) {
    return defaultValue;
  }
}

function lsSet<T>(key: Key, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// 用户档案
export async function getUserProfile(): Promise<UserProfile | null> {
  if (supabaseClient) {
    // TODO: 从 Supabase 读取
  }
  return lsGet<UserProfile | null>('user_profile', null);
}

export async function setUserProfile(profile: UserProfile): Promise<void> {
  if (supabaseClient) {
    // TODO: 写入 Supabase
  }
  lsSet('user_profile', profile);
}

// 测量记录
export async function addMeasurement(m: Measurement): Promise<void> {
  const all = lsGet<Measurement[]>('measurements', []);
  all.unshift(m); // 最近优先
  lsSet('measurements', all);
}

export async function getMeasurements(type?: Measurement['type']): Promise<Measurement[]> {
  const all = lsGet<Measurement[]>('measurements', []);
  return type ? all.filter(m => m.type === type) : all;
}

// 处方
export async function getPrescriptions(): Promise<Prescription[]> {
  return lsGet<Prescription[]>('prescriptions', []);
}

export async function upsertPrescription(p: Prescription): Promise<void> {
  const all = lsGet<Prescription[]>('prescriptions', []);
  const idx = all.findIndex(x => x.id === p.id);
  if (idx >= 0) all[idx] = p; else all.unshift(p);
  lsSet('prescriptions', all);
}

// 打卡与完成度日志
export async function getAdherenceLogs(): Promise<AdherenceLog[]> {
  return lsGet<AdherenceLog[]>('adherence_logs', []);
}

export async function addAdherenceLog(log: AdherenceLog): Promise<void> {
  const all = lsGet<AdherenceLog[]>('adherence_logs', []);
  const idx = all.findIndex(x => x.date === log.date);
  if (idx >= 0) all[idx] = log; else all.push(log);
  lsSet('adherence_logs', all);
}

// 运动前闸门事件日志
export interface GateEvent {
  id: string;
  date: string; // YYYY-MM-DD
  status: GateStatus;
  reasons: string[];
  suggestedAction?: string;
  forcedStart?: boolean; // 黄/红灯仍强行开始
  prescriptionId?: string;
}

export async function getGateEvents(): Promise<GateEvent[]> {
  return lsGet<GateEvent[]>('gate_events', []);
}

export async function logGateEvent(evt: GateEvent): Promise<void> {
  const all = lsGet<GateEvent[]>('gate_events', []);
  const idx = all.findIndex(x => x.id === evt.id || (x.date === evt.date && x.prescriptionId === evt.prescriptionId));
  if (idx >= 0) all[idx] = { ...all[idx], ...evt }; else all.unshift(evt);
  lsSet('gate_events', all);
}

export async function updateGateEvent(id: string, updates: Partial<GateEvent>): Promise<void> {
  const all = lsGet<GateEvent[]>('gate_events', []);
  const idx = all.findIndex(x => x.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    lsSet('gate_events', all);
  }
}

// 工具函数：最近N天（含今天）日期数组 YYYY-MM-DD
export function lastNDays(n: number): string[] {
  const res: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    const y = x.getFullYear();
    const m = `${x.getMonth() + 1}`.padStart(2, '0');
    const dd = `${x.getDate()}`.padStart(2, '0');
    res.push(`${y}-${m}-${dd}`);
  }
  return res;
}