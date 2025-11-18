// 条件编码规范与映射工具
// 统一：引擎/规则层使用英文代码，UI 层可映射中文标签

export const CONDITION_MAP_CN_TO_EN: Record<string, string> = {
  '高血压': 'hypertension',
  '糖尿病': 'diabetes',
  '心脏病': 'heart_disease',
  '冠心病': 'coronary_heart_disease',
  '缺血性心脏病': 'coronary_heart_disease',
  '冠状动脉粥样硬化性心脏病': 'coronary_heart_disease',
  '肥胖': 'obesity',
  '高脂血症': 'hyperlipidemia',
  '高血脂': 'hyperlipidemia',
  '血脂异常': 'hyperlipidemia',
  '脂肪肝': 'fatty_liver',
  '骨关节炎': 'arthritis',
  '关节炎': 'arthritis',
  '心力衰竭': 'heart_failure',
  '心律失常': 'arrhythmia',
  '脑卒中': 'stroke',
  '中风': 'stroke',
  '卒中': 'stroke',
  '骨质疏松': 'osteoporosis',
  '膝骨关节炎': 'knee_osteoarthritis',
  '膝关节骨关节炎': 'knee_osteoarthritis',
  '腰痛': 'low_back_pain',
  '下背痛': 'low_back_pain',
  '心绞痛': 'angina'
};

export const CONDITION_LABELS_EN_TO_CN: Record<string, string> = {
  hypertension: '高血压',
  diabetes: '糖尿病',
  heart_disease: '心脏病',
  coronary_heart_disease: '冠心病',
  obesity: '肥胖',
  hyperlipidemia: '高脂血症',
  fatty_liver: '脂肪肝',
  arthritis: '关节炎',
  heart_failure: '心力衰竭',
  arrhythmia: '心律失常',
  stroke: '卒中',
  osteoporosis: '骨质疏松',
  knee_osteoarthritis: '膝骨关节炎',
  low_back_pain: '下背痛',
  angina: '心绞痛'
};

const KNOWN_EN_CODES = new Set<string>([
  'hypertension',
  'diabetes',
  'heart_disease',
  'coronary_heart_disease',
  'obesity',
  'hyperlipidemia',
  'fatty_liver',
  'arthritis',
  'heart_failure',
  'arrhythmia',
  'stroke',
  'osteoporosis',
  'knee_osteoarthritis',
  'low_back_pain',
  'angina'
]);

/**
 * 规范化条件编码：将中文疾病名或自由文本映射为英文代码
 */
export function normalizeConditions(input: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const raw of input || []) {
    if (!raw) continue;
    const s = String(raw).trim();
    if (!s) continue;
    // 若已是英文代码（白名单），直接保留
    if (KNOWN_EN_CODES.has(s)) {
      if (!out.includes(s)) out.push(s);
      continue;
    }
    // 精确中文映射
    const direct = CONDITION_MAP_CN_TO_EN[s];
    if (direct) {
      if (!out.includes(direct)) out.push(direct);
      continue;
    }
    // 文本启发式包含映射
    const lower = s.toLowerCase();
    if (s.includes('高血压') || lower.includes('hypertension')) {
      if (!out.includes('hypertension')) out.push('hypertension');
      continue;
    }
    if (s.includes('糖尿病') || lower.includes('diabetes')) {
      if (!out.includes('diabetes')) out.push('diabetes');
      continue;
    }
    if (
      s.includes('冠心病') ||
      s.includes('缺血性心脏病') ||
      s.includes('冠状动脉') ||
      lower.includes('coronary heart disease') ||
      lower.includes('ischemic heart disease') ||
      lower.includes('coronary artery disease') ||
      lower.includes('cad') || lower.includes('chd') || lower.includes('ihd')
    ) {
      if (!out.includes('coronary_heart_disease')) out.push('coronary_heart_disease');
      continue;
    }
    if (s.includes('心脏病')) {
      if (!out.includes('heart_disease')) out.push('heart_disease');
      continue;
    }
    if (s.includes('关节')) {
      if (!out.includes('arthritis')) out.push('arthritis');
      continue;
    }
    if (s.includes('心力衰竭') || lower.includes('heart failure')) {
      if (!out.includes('heart_failure')) out.push('heart_failure');
      continue;
    }
    if (s.includes('心律失常') || lower.includes('arrhythmia')) {
      if (!out.includes('arrhythmia')) out.push('arrhythmia');
      continue;
    }
    if (s.includes('卒中') || s.includes('脑卒中') || s.includes('中风') || lower.includes('stroke')) {
      if (!out.includes('stroke')) out.push('stroke');
      continue;
    }
    if (s.includes('骨质疏松') || lower.includes('osteoporosis')) {
      if (!out.includes('osteoporosis')) out.push('osteoporosis');
      continue;
    }
    if (s.includes('膝骨关节炎')) {
      if (!out.includes('knee_osteoarthritis')) out.push('knee_osteoarthritis');
      continue;
    }
    if (s.includes('腰痛') || s.includes('下背痛')) {
      if (!out.includes('low_back_pain')) out.push('low_back_pain');
      continue;
    }
    if (s.includes('心绞痛') || lower.includes('angina')) {
      if (!out.includes('angina')) out.push('angina');
      continue;
    }
    if (s.includes('肥胖')) {
      if (!out.includes('obesity')) out.push('obesity');
      continue;
    }
    if (s.includes('脂肪肝')) {
      if (!out.includes('fatty_liver')) out.push('fatty_liver');
      continue;
    }
    if (s.includes('高脂') || s.includes('血脂异常') || lower.includes('dyslipidemia')) {
      if (!out.includes('hyperlipidemia')) out.push('hyperlipidemia');
      continue;
    }
    // 其他文本暂不纳入（避免污染编码）。如需扩展可在此添加。
  }
  return out;
}

/** 将英文代码映射为中文展示标签（未知则回退原文） */
export function toChineseLabel(code: string): string {
  return CONDITION_LABELS_EN_TO_CN[code] || code;
}

/** 从中文病史文本中提取英文条件编码 */
export function extractConditionsFromText(text?: string | null): string[] {
  const t = typeof text === 'string' ? text : '';
  const flags: string[] = [];
  if (!t) return flags;
  if (t.includes('高血压')) flags.push('hypertension');
  if (t.includes('糖尿病')) flags.push('diabetes');
  if (
    t.includes('冠心病') ||
    t.includes('缺血性心脏病') ||
    t.includes('冠状动脉')
  ) flags.push('coronary_heart_disease');
  if (t.includes('心脏病')) flags.push('heart_disease');
  if (t.includes('关节')) flags.push('arthritis');
  if (t.includes('脂肪肝')) flags.push('fatty_liver');
  if (t.includes('高脂') || t.includes('血脂异常')) flags.push('hyperlipidemia');
  return Array.from(new Set(flags));
}