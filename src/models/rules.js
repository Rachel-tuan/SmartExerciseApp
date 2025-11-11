// 健康指标阈值常量（保留原导出名）
export const ALERTS = {
  BLOOD_PRESSURE: {
    systolic: 160,    // 收缩压警戒值（用于运动注意阈值）
    diastolic: 100    // 舒张压警戒值（用于运动注意阈值）
  },
  BLOOD_SUGAR: {
    low: 3.9,         // 血糖过低警戒值
    high: 13.9        // 血糖过高警戒值
  }
};

// 中国成人 BMI 分档
export const CN_BMI_BANDS = [
  { category: '偏低', min: -Infinity, max: 18.5 },
  { category: '正常', min: 18.5, max: 23.9 },
  { category: '超重', min: 24, max: 27.9 },
  { category: '肥胖', min: 28, max: Infinity }
];

// 中国成人腰围中心性肥胖（cm）
export const CN_WAIST_CUTOFFS = { male: 90, female: 85 };

// 运动安全闸门阈值
export const EXERCISE_GATES = {
  bp: {
    caution: { sbp: 160, dbp: 100 },
    stop: { sbp: 180, dbp: 110 }
  },
  glucose: {
    lowStop: 3.9,
    highCaution: 13.9,
    insulinPreSnack: 5.6
  }
};

// 计算 BMI
export function computeBMI(heightCm, weightKg) {
  const heightM = heightCm / 100;
  return (weightKg / (heightM * heightM)).toFixed(1);
}

// BMI 指标判定（中国成人标准）
// 分类：偏低 <18.5；正常 18.5–23.9；超重 24–27.9；肥胖 ≥28
export function checkBMI(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) {
    return { isNormal: true, category: '未知', alert: null };
  }
  if (v < 18.5) {
    return { isNormal: false, category: '偏低', alert: 'BMI偏低（<18.5），建议加强营养与力量练习' };
  }
  if (v >= 28) {
    return { isNormal: false, category: '肥胖', alert: 'BMI肥胖（≥28），建议控制饮食并增加有氧运动' };
  }
  if (v >= 24) {
    return { isNormal: false, category: '超重', alert: 'BMI超重（24–27.9），建议增加体力活动，优化饮食结构' };
  }
  return { isNormal: true, category: '正常', alert: null };
}

// BMI 分类（返回分类字符串）
export function classifyBMI(bmiValue) {
  const v = Number(bmiValue);
  if (!Number.isFinite(v)) return '未知';
  for (const band of CN_BMI_BANDS) {
    if (v >= band.min && v < band.max) return band.category;
  }
  return '未知';
}

// 中国成人血压分级
export function bpCategoryCN(systolic, diastolic) {
  const sbp = Number(systolic);
  const dbp = Number(diastolic);
  if (!Number.isFinite(sbp) || !Number.isFinite(dbp)) return '未知';
  if (sbp >= 180 || dbp >= 110) return '3级';
  if (sbp >= 160 || dbp >= 100) return '2级';
  if (sbp >= 140 || dbp >= 90) return '1级';
  if ((sbp >= 130 && sbp < 140) || (dbp >= 85 && dbp < 90)) return '正常高值';
  return '正常';
}

// 腰围中心性肥胖判断
export function checkCentralObesity({ sex, waistCm }) {
  const cutoff = sex === 'male' ? CN_WAIST_CUTOFFS.male : sex === 'female' ? CN_WAIST_CUTOFFS.female : null;
  if (!Number.isFinite(Number(waistCm)) || cutoff == null) {
    return { centralObesity: false, alert: null };
  }
  const central = Number(waistCm) >= cutoff;
  return {
    centralObesity: central,
    alert: central ? '腰围提示中心性肥胖（男≥90cm/女≥85cm），建议控制饮食与增加有氧运动' : null
  };
}

// 检查血压是否正常
export function checkBloodPressure(systolic, diastolic) {
  const stage = bpCategoryCN(systolic, diastolic);
  const reasons = [];
  let ok = true;
  let caution = false;
  const sbp = Number(systolic);
  const dbp = Number(diastolic);

  if (Number.isFinite(sbp) && Number.isFinite(dbp)) {
    if (sbp >= EXERCISE_GATES.bp.stop.sbp || dbp >= EXERCISE_GATES.bp.stop.dbp) {
      ok = false;
      reasons.push('血压≥180/110：暂缓运动');
    } else if (sbp >= EXERCISE_GATES.bp.caution.sbp || dbp >= EXERCISE_GATES.bp.caution.dbp) {
      caution = true;
      reasons.push('血压≥160/100：仅低-中等强度并缩短');
    }
  }

  const isNormal = stage === '正常' || stage === '正常高值';
  let alert = null;
  if (stage === '正常高值') alert = '血压正常高值，建议生活方式调整（限盐、规律运动）';
  if (stage === '1级') alert = '血压1级升高（≥140/90），建议监测与生活方式干预';
  if (stage === '2级') alert = '血压2级升高（≥160/100），运动仅低-中强度并缩短';
  if (stage === '3级') alert = '血压3级升高（≥180/110），暂缓运动并尽快就医评估';

  return {
    isNormal,
    alert,
    stage,
    gate: { ok, caution, reasons }
  };
}

// 检查血糖是否正常
export function checkBloodSugar(value) {
  const v = Number(value);
  const isLow = v < ALERTS.BLOOD_SUGAR.low;
  const isHigh = v > ALERTS.BLOOD_SUGAR.high;
  return {
    isNormal: !isLow && !isHigh,
    alert: isLow ? '血糖偏低（<3.9），请及时进食并暂缓运动' : 
           isHigh ? '血糖偏高（>13.9），建议监测并控制饮食' : null
  };
}

// 计算处方完成度
export function calculateAdherence(prescription, records) {
  if (!prescription) return 0;

  // 新模型：使用 daily_count 与 taken_count 计算（与 UI 与示例数据一致）
  if (!Array.isArray(prescription.medications)) {
    const daily = Number(prescription.daily_count) || 0;
    const taken = Number(prescription.taken_count) || 0;
    if (daily <= 0) return 0;

    // 计算观察天数，默认按近7天；若有起止时间，则取 start->min(now,end) 的天数（上限7）
    let daysWindow = 7;
    try {
      if (prescription.start_date) {
        const start = new Date(prescription.start_date);
        const now = new Date();
        const end = prescription.end_date ? new Date(prescription.end_date) : now;
        const actualEnd = end > now ? now : end;
        const days = Math.max(1, Math.ceil((actualEnd - start) / (24 * 60 * 60 * 1000)) + 1);
        daysWindow = Math.min(7, days);
      }
    } catch (e) {
      // ignore parse errors, keep default 7
    }

    const planned = daily * daysWindow;
    if (planned <= 0) return 0;
    const ratio = Math.min(taken / planned, 1);
    return (ratio * 100).toFixed(1);
  }

  // 旧模型：按 medications/timing 计算
  if (!records || records.length === 0) return 0;

  const medicationTimes = prescription.medications.reduce((total, med) =>
    total + (Array.isArray(med.timing) ? med.timing.length : 0), 0);

  if (medicationTimes <= 0) return 0;

  const dailyRecords = records.reduce((acc, record) => {
    const date = (record.timestamp || record.record_date || '').split('T')[0];
    if (!date) return acc;
    if (!acc[date]) {
      acc[date] = 1;
    } else {
      acc[date]++;
    }
    return acc;
  }, {});

  const adherenceRates = Object.values(dailyRecords).map((takenTimes) =>
    Math.min(takenTimes / medicationTimes, 1)
  );

  if (adherenceRates.length === 0) return 0;
  const averageAdherence = adherenceRates.reduce((sum, rate) => sum + rate, 0) / adherenceRates.length;
  return (averageAdherence * 100).toFixed(1);
}

// 检查是否达到连续达标勋章要求
export function checkAdherenceBadge(adherenceHistory) {
  const REQUIRED_DAYS = 7;
  const REQUIRED_RATE = 80;

  if (!adherenceHistory || adherenceHistory.length < REQUIRED_DAYS) {
    return false;
  }

  // 获取最近7天的记录
  const recentRates = adherenceHistory.slice(-REQUIRED_DAYS);
  
  // 检查是否所有天数都达到要求
  return recentRates.every(rate => rate >= REQUIRED_RATE);
}

// 生成健康建议
export function generateHealthAdvice(healthData) {
  const advices = [];

  if (healthData.systolic && healthData.diastolic) {
    const bpCheck = checkBloodPressure(healthData.systolic, healthData.diastolic);
    if (!bpCheck.isNormal) {
      advices.push(bpCheck.alert);
    }
    // 对分级与闸门进行补充提示
    if (bpCheck.stage === '正常高值') {
      advices.push('血压正常高值：建议限盐、规律运动与体重管理');
    }
    if (bpCheck.gate && bpCheck.gate.reasons?.length) {
      advices.push(...bpCheck.gate.reasons);
    }
  }

  if (healthData.blood_sugar) {
    const bsCheck = checkBloodSugar(healthData.blood_sugar);
    if (!bsCheck.isNormal) {
      advices.push(bsCheck.alert);
    }
  }

  if (healthData.height && healthData.weight) {
    const bmiStr = computeBMI(healthData.height, healthData.weight);
    const bmiCheck = checkBMI(Number(bmiStr));
    if (bmiCheck.alert) {
      advices.push(bmiCheck.alert);
    }
  }

  // 腰围中心性肥胖
  if (healthData.sex && healthData.waist != null) {
    const co = checkCentralObesity({ sex: healthData.sex, waistCm: healthData.waist });
    if (co.alert) advices.push(co.alert);
  }

  return advices;
}

// 运动前安全闸门（开始运动或打卡前调用）
export function preExerciseGate({
  sbp,
  dbp,
  glucose,
  ketonePositive = false,
  onInsulinOrSecretagogue = false,
  meds = [],
  plannedLoad = 'moderate'
} = {}) {
  const reasons = [];
  let ok = true;
  let caution = false;

  const sbpNum = Number(sbp);
  const dbpNum = Number(dbp);
  const gluNum = Number(glucose);

  // 血压闸门
  if (Number.isFinite(sbpNum) && Number.isFinite(dbpNum)) {
    if (sbpNum >= EXERCISE_GATES.bp.stop.sbp || dbpNum >= EXERCISE_GATES.bp.stop.dbp) {
      ok = false;
      reasons.push('血压≥180/110：暂缓运动');
    } else if (sbpNum >= EXERCISE_GATES.bp.caution.sbp || dbpNum >= EXERCISE_GATES.bp.caution.dbp) {
      caution = true;
      reasons.push('血压≥160/100：仅低-中等强度并缩短');
    }
  }

  // 血糖闸门
  if (Number.isFinite(gluNum)) {
    if (gluNum < EXERCISE_GATES.glucose.lowStop) {
      ok = false;
      reasons.push('血糖<3.9：暂缓运动');
    } else {
      if (onInsulinOrSecretagogue && gluNum < EXERCISE_GATES.glucose.insulinPreSnack) {
        caution = true;
        reasons.push('使用胰岛素/促泌剂且血糖<5.6：运动前先补碳水');
      }
      if (gluNum > EXERCISE_GATES.glucose.highCaution) {
        caution = true;
        reasons.push('血糖>13.9：建议监测并适当降低强度时长');
      }
    }
  }

  // 酮体提示
  if (ketonePositive) {
    caution = true;
    reasons.push('酮体阳性：补水与监测，必要时暂缓运动');
  }

  // 强度提示
  if (caution && plannedLoad === 'high') {
    reasons.push('当前仅建议低-中等强度，避免高强度训练');
  }

  return { ok, caution, reasons };
}
