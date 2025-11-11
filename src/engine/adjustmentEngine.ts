import { AdherenceLog, Prescription } from '../models/types';

/**
 * 根据最近7天完成率与平均RPE对处方进行微调
 * 规则：
 * - 每7天评估一次；
 * - 完成率低(<60%)或平均RPE高(>=7)：时长/频次下调10–15%，强度不升只降；
 * - 完成率高(>=90%)且平均RPE低(<=5)：时长/频次上调10–15%，强度不升只降（不提升强度，仅在建议中保留原强度或更低）；
 * - 其他情况：微调幅度为±10%；
 * 返回为 Partial<Prescription>，其中 fit.freq 与 fit.time 表示相对于当前处方的“倍率”（例如1.1表示+10%，0.9表示-10%）。
 */
export function adjustWeeklyPrescription(history: AdherenceLog[]): Partial<Prescription> {
  // 仅取最近7天
  const recent = history
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, 7);

  if (recent.length === 0) {
    return { rules: ['#ADJ-000: 无历史记录，暂不调整'] };
  }

  const totalPlanned = recent.reduce((sum, d) => sum + (d.plannedMins || 0), 0);
  const totalCompleted = recent.reduce((sum, d) => sum + (d.completedMins || 0), 0);
  const completionRate = totalPlanned > 0 ? totalCompleted / totalPlanned : 0;

  const rpeValues = recent.map(d => d.rpe).filter((v): v is number => typeof v === 'number');
  const avgRPE = rpeValues.length ? rpeValues.reduce((s, v) => s + v, 0) / rpeValues.length : 0;

  let multiplier = 1.0; // 应用于 freq 与 time 的统一倍率
  let intensitySuggestion: string | undefined = undefined;
  const appliedRules: string[] = [];

  if (completionRate < 0.6 || avgRPE >= 7) {
    multiplier = 0.85; // 下调15%
    intensitySuggestion = '低'; // 强度不升只降
    appliedRules.push('#ADJ-101: 完成率低或RPE高，时长/频次下调15%');
  } else if (completionRate >= 0.9 && avgRPE <= 5) {
    multiplier = 1.1; // 上调10%
    intensitySuggestion = undefined; // 不提升强度，仅维持或更低（由调用方决定是否保持原强度）
    appliedRules.push('#ADJ-102: 完成率高且RPE低，时长/频次上调10%');
  } else {
    // 中等区间，轻微调整
    multiplier = completionRate >= 0.8 ? 1.05 : 0.95;
    appliedRules.push('#ADJ-103: 中等区间，时长/频次±5%微调');
  }

  const partial: Partial<Prescription> = {
    fit: {
      freq: multiplier, // 作为倍率，调用方需用当前处方freq * multiplier
      time: Math.round(multiplier * 100) / 100, // 与freq一致的倍率，保留两位小数
      ...(intensitySuggestion ? { intensity: intensitySuggestion } : {})
    },
    rules: appliedRules
  };

  return partial;
}