import { describe, it, expect } from 'vitest';
import { generatePrescription, setCRFConfig, preExerciseGate } from '../src/engine';

const mkProfile = (age: number, height: number, weight: number, conditions: string[] = []) => ({
  age,
  sex: 'male',
  height,
  weight,
  waist: 80,
  conditions
});

const mkMeas = (items: { type: 'bp'|'bg'|'hr'; value: any }[]) => items.map((v, i) => ({
  type: v.type,
  value: v.value,
  takenAt: new Date(Date.now() - i * 1000).toISOString(),
  source: 'manual'
}));

describe('CRF融合处方引擎', () => {
  it('Case A: age 60-64 且 BMI≥24 触发 OW-001 与 MID-001，CRF融合后不应高强度', () => {
    setCRFConfig({ USE_CRF: true, alpha: 1, beta: 0.1, priorityFactors: { 6: 0.6, 5: 0.5 } });
    const p = mkProfile(62, 170, 75, []);
    const m = mkMeas([]);
    const rx = generatePrescription(p as any, m as any);
    expect(['低强度','中低强度','中等强度']).toContain(rx.fit.intensity);
  });

  it('Case B: age≥65 且 diabetes 触发 DM-001 与 AGE-001，融合后强度不高，时间不超过45', () => {
    setCRFConfig({ USE_CRF: true, alpha: 1, beta: 0.2, priorityFactors: { 8: 0.8, 7: 0.7 } });
    const p = mkProfile(68, 165, 68, ['diabetes']);
    const m = mkMeas([{ type: 'bg', value: { value: 7.5, isFasting: true } }]);
    const rx = generatePrescription(p as any, m as any);
    expect(['低强度','中低强度','中等强度']).toContain(rx.fit.intensity);
    expect(rx.fit.time).toBeLessThanOrEqual(45);
  });

  it('Case C: age 40-59 无慢病 仅触发 MID-001，融合输出与中年模板接近', () => {
    setCRFConfig({ USE_CRF: true, alpha: 1, beta: 0.1 });
    const p = mkProfile(45, 172, 68, []);
    const m = mkMeas([]);
    const rx = generatePrescription(p as any, m as any);
    expect(rx.fit.freq).toBeGreaterThanOrEqual(3);
    expect(['中等强度','中低强度']).toContain(rx.fit.intensity);
    expect(rx.fit.time).toBeGreaterThanOrEqual(30);
  });

  it('CASE_D_HIGH_BP: 极高血压触发红灯，慢病规则贡献Top包含 HTN-001', () => {
    setCRFConfig({ USE_CRF: true, alpha: 1.0, beta: 0.1, priorityFactors: { 8: 1.25, 7: 1.12 } });
    const p = mkProfile(70, 168, 72, ['hypertension']);
    const m = mkMeas([{ type: 'bp', value: { systolic: 180, diastolic: 110 } }]);
    const gate = preExerciseGate(m as any, p as any);
    expect(gate.status).toBe('red');
    const rx = generatePrescription(p as any, m as any);
    expect(['低强度','中低强度','中等强度']).toContain(rx.fit.intensity);
    expect(rx.explain && Array.isArray(rx.explain.top) ? rx.explain.top.map((t:any)=>t.id) : []).toContain('HTN-001');
  });

  it('CASE_E_HIGH_BG: 空腹血糖严重升高，DM-001贡献最高', () => {
    setCRFConfig({ USE_CRF: true, alpha: 1.0, beta: 0.1, priorityFactors: { 8: 1.25, 7: 1.12 } });
    const p = mkProfile(58, 170, 68, ['diabetes']);
    const m = mkMeas([{ type: 'bg', value: { value: 11.0, isFasting: true } }]);
    const rx = generatePrescription(p as any, m as any);
    expect(['低强度','中低强度','中等强度']).toContain(rx.fit.intensity);
    expect(rx.explain && Array.isArray(rx.explain.top) && rx.explain.top.length>0 ? rx.explain.top[0].id : '').toBe('DM-001');
  });
});