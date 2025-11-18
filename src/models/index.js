import { nanoid } from 'nanoid';
import * as db from './db';
import * as rules from './rules';
import { generateExercisePrescription, computeAdherenceForWeek } from './exercise';
import { computeConfidenceScore } from '../utils/computeConfidence';
import { normalizeConditions, extractConditionsFromText } from '../utils/conditions';

// 用户相关
export async function getCurrentUser() {
  const users = await db.getAll('users');
  return users[0]; // 示例数据中只有一个用户
}

export async function upsertUser(userData) {
  // 统一疾病编码为英文，兼容从病史文本抽取
  const rawDiseases = Array.isArray(userData?.diseases) ? userData.diseases : [];
  const extraFromHistory = extractConditionsFromText(userData?.medical_history || userData?.medicalHistory || '');
  const canonicalDiseases = normalizeConditions([ ...rawDiseases, ...extraFromHistory ]);
  const user = {
    ...userData,
    diseases: canonicalDiseases,
    user_id: userData.user_id || nanoid()
  };
  await db.put('users', user);
  return user;
}

export async function migrateConditionsExistingData(normalize_map = {}) {
  const users = await db.getAll('users');
  const map = normalize_map || {};
  for (const u of users) {
    const raw = Array.isArray(u?.diseases) ? u.diseases : [];
    const mapped = raw.map(d => (map[d] ? map[d] : d));
    const extras = extractConditionsFromText(u?.medical_history || u?.medicalHistory || '');
    const canonical = normalizeConditions([ ...mapped, ...extras ]);
    const same = Array.isArray(u?.diseases) && u.diseases.length === canonical.length && u.diseases.every((x, i) => x === canonical[i]);
    if (!same) {
      await db.put('users', { ...u, diseases: canonical });
    }
  }
}

export async function updateUserSettings(userId, settings) {
  const user = await db.get('users', userId);
  if (!user) throw new Error('用户不存在');
  
  user.settings = {
    ...user.settings,
    ...settings
  };
  
  await db.put('users', user);
  return user;
}

// 预置测试账号（仅在不存在时创建），密码均为 "password"
export async function seedTestAccounts() {
  const existing = await db.getAll('users');
  const hasUsername = (uname) => existing.some(u => u.username === uname || u.name === uname);

  const testUsers = [
    {
      name: '糖先生', username: '糖先生', password: 'password', gender: 'male', age: 55,
      phone: '13800000001', height: 170, weight: 72, waist: 92, diseases: ['diabetes']
    },
    {
      name: '压先生', username: '压先生', password: 'password', gender: 'male', age: 60,
      phone: '13800000002', height: 168, weight: 70, waist: 90, diseases: ['hypertension']
    },
    {
      name: '胖先生', username: '胖先生', password: 'password', gender: 'male', age: 50,
      phone: '13800000003', height: 165, weight: 85, waist: 102, diseases: ['obesity']
    },
    {
      name: '脂先生', username: '脂先生', password: 'password', gender: 'male', age: 58,
      phone: '13800000004', height: 172, weight: 78, waist: 96, diseases: ['hyperlipidemia']
    },
    {
      name: '冠先生', username: '冠先生', password: 'password', gender: 'male', age: 62,
      phone: '13800000005', height: 169, weight: 73, waist: 94, diseases: ['coronary_heart_disease']
    },
    {
      name: '肝先生', username: '肝先生', password: 'password', gender: 'male', age: 52,
      phone: '13800000006', height: 171, weight: 80, waist: 98, diseases: ['fatty_liver']
    }
  ];

  const createdUsers = [];
  for (const tu of testUsers) {
    if (!hasUsername(tu.username)) {
      const user = {
        ...tu,
        user_id: nanoid(),
        settings: { elderlyMode: true, voiceEnabled: true }
      };
      await db.put('users', user);
      createdUsers.push(user);

      // 为每位测试用户生成1条示例健康记录，用于展示
      const record = {
        record_id: nanoid(),
        user_id: user.user_id,
        timestamp: new Date().toISOString(),
        height: user.height,
        weight: user.weight,
        waist: user.waist,
      };
      // 按疾病特征赋值关键指标
      if (user.diseases.includes('hypertension')) {
        record.systolic = 150; // 收缩压偏高
        record.diastolic = 95;
      }
      if (user.diseases.includes('diabetes')) {
        record.blood_sugar = 9.8; // 血糖偏高
      }
      if (user.diseases.includes('obesity')) {
        record.blood_sugar = 6.2;
        record.systolic = 135;
        record.diastolic = 88;
      }
      if (user.diseases.includes('hyperlipidemia')) {
        record.blood_sugar = 5.8;
        record.systolic = 130;
        record.diastolic = 85;
      }
      if (user.diseases.includes('coronary_heart_disease')) {
        record.systolic = 140;
        record.diastolic = 90;
        record.blood_sugar = 6.0;
      }
      if (user.diseases.includes('fatty_liver')) {
        record.blood_sugar = 6.5;
        record.systolic = 128;
        record.diastolic = 82;
      }
      await db.add('health_records', record);
    }
  }

  return createdUsers;
}

// 健康记录相关
export async function addHealthRecord(userId, recordData) {
  const measuredAt = recordData?.measuredAt || new Date().toISOString();
  const source_type = recordData?.source_type || (recordData?.source ? String(recordData.source).toLowerCase() : 'manual');
  const source_id = recordData?.source_id || null;

  const baseRecord = {
    record_id: nanoid(),
    user_id: userId,
    measuredAt,
    timestamp: measuredAt,
    source_type,
    source_id,
    ...recordData
  };

  const confidence_score = computeConfidenceScore(baseRecord);
  const record = { ...baseRecord, confidence_score };

  try {
    await db.add('health_records', record);
    await db.saveAuditLog({ user_id: userId, action: 'add', status: 'success', record_id: record.record_id, payload: record });
  } catch (e) {
    await db.saveAuditLog({ user_id: userId, action: 'add', status: 'blocked', reason: e?.message || String(e), record_id: record.record_id, payload: record });
    throw e;
  }

  // 生成健康建议
  // 合并用户基础信息（性别、腰围）以增强建议
  let user = null;
  try {
    const users = await db.getAll('users');
    user = users.find(u => u.user_id === userId) || null;
  } catch (e) {
    user = null;
  }
  const advice = rules.generateHealthAdvice({
    ...record,
    sex: user?.gender || user?.sex,
    waist: user?.waist
  });

  // 检查是否需要添加新的勋章
  const records = await db.getUserHealthRecords(userId);
  const prescription = await db.getUserActivePrescription(userId);
  
  if (prescription) {
    const adherenceHistory = records.map(r => 
      rules.calculateAdherence(prescription, [r])
    );

    if (rules.checkAdherenceBadge(adherenceHistory)) {
      await addBadge(userId, {
        type: 'adherence',
        title: '坚持服药7天',
        description: '连续7天保持服药率80%以上'
      });
    }
  }

  return {
    record,
    advice
  };
}

export async function getHealthRecords(userId) {
  return db.getUserHealthRecords(userId);
}

// 别名：获取全部健康记录（与页面调用保持一致）
export async function getAllHealthRecords(userId) {
  return getHealthRecords(userId);
}

// 审计日志：获取（可按用户过滤）
export async function getAuditLogs(userId) {
  const logs = await db.getAll('measurements_audit_log');
  return userId ? logs.filter(l => l.user_id === userId) : logs;
}

// 更新健康记录
export async function updateHealthRecord(recordId, updates) {
  const existing = await db.get('health_records', recordId);
  if (!existing) {
    await db.saveAuditLog({ action: 'update', status: 'blocked', reason: '记录不存在', record_id: recordId });
    throw new Error('记录不存在');
  }
  const updated = { ...existing, ...updates };
  await db.put('health_records', updated);
  await db.saveAuditLog({ user_id: existing.user_id, action: 'update', status: 'success', record_id: recordId, payload: updates });
  return updated;
}

// 删除健康记录
export async function removeHealthRecord(recordId) {
  const existing = await db.get('health_records', recordId);
  if (!existing) {
    await db.saveAuditLog({ action: 'remove', status: 'blocked', reason: '记录不存在', record_id: recordId });
    return false;
  }
  await db.remove('health_records', recordId);
  await db.saveAuditLog({ user_id: existing.user_id, action: 'remove', status: 'success', record_id: recordId });
  return true;
}

// 处方相关
export async function getActivePrescription(userId) {
  return db.getUserActivePrescription(userId);
}

// 获取全部处方（按开始时间倒序），可选按用户过滤
export async function getPrescriptions(userId) {
  const list = await db.getAll('prescriptions');
  const filtered = userId ? list.filter(p => p.user_id === userId) : list;
  return filtered.sort((a, b) => new Date(b.start_date || b.created_at || 0) - new Date(a.start_date || a.created_at || 0));
}

export async function saveCRFAuditLog(entry) {
  return db.saveCRFAuditLog(entry);
}

export async function getCRFAuditLogs() {
  return db.getCRFAuditLogs();
}

export async function addPrescription(userId, prescriptionData) {
  const prescription = {
    prescription_id: nanoid(),
    user_id: userId,
    status: 'active',
    start_date: new Date().toISOString(),
    ...prescriptionData
  };

  await db.add('prescriptions', prescription);
  return prescription;
}

export async function updatePrescription(prescriptionId, updates) {
  const prescription = await db.get('prescriptions', prescriptionId);
  if (!prescription) throw new Error('处方不存在');

  const updatedPrescription = {
    ...prescription,
    ...updates
  };

  await db.put('prescriptions', updatedPrescription);
  return updatedPrescription;
}

// 勋章相关
export async function getBadges(userId) {
  return db.getUserBadges(userId);
}

export async function addBadge(userId, badgeData) {
  const { title, name, description, ...rest } = badgeData || {};
  const displayName = name || title || '新勋章';
  const badge = {
    badge_id: nanoid(),
    user_id: userId,
    name: displayName,
    description: description || '',
    achieved: true,
    achieved_at: new Date().toISOString(),
    // 兼容旧字段
    title: displayName,
    earned_date: new Date().toISOString(),
    ...rest
  };

  await db.add('badges', badge);
  return badge;
}

// 医生笔记相关
export async function getDoctorNotes(userId) {
  return db.getUserDoctorNotes(userId);
}

export async function addDoctorNote(userId, noteData) {
  const note = {
    note_id: nanoid(),
    user_id: userId,
    timestamp: new Date().toISOString(),
    ...noteData
  };

  await db.add('doctor_notes', note);
  return note;
}

// 健康统计相关
export async function getHealthStats(userId) {
  const records = await getHealthRecords(userId);
  const prescription = await getActivePrescription(userId);

  if (!records || records.length === 0) {
    return null;
  }

  // 获取最近的记录
  const latestRecord = records[0];
  
  // 计算处方完成度
  const adherenceRate = rules.calculateAdherence(prescription, records);

  // 检查各项指标
  const bloodPressureStatus = rules.checkBloodPressure(
    latestRecord.systolic,
    latestRecord.diastolic
  );

  const bloodSugarStatus = rules.checkBloodSugar(latestRecord.blood_sugar);

  // 计算BMI（如果有身高体重数据）
  let bmi = null;
  if (latestRecord.height && latestRecord.weight) {
    bmi = rules.computeBMI(latestRecord.height, latestRecord.weight);
  }

  // BMI 分类（中国成人标准），保留原有返回结构并附加分类信息
  let bmiCategory = null;
  if (bmi != null) {
    const bmiCheck = rules.checkBMI(Number(bmi));
    bmiCategory = bmiCheck.category;
  }

  return {
    latestRecord,
    adherenceRate,
    bloodPressureStatus,
    bloodSugarStatus,
    bmi,
    bmiCategory
  };
}

// 运动（处方与打卡）相关
export async function getExercisePrescriptionForUser(userId) {
  const users = await db.getAll('users')
  const user = users.find(u => u.user_id === userId)
  const records = await getHealthRecords(userId)
  const latestRecord = records && records.length > 0 ? records[0] : null
  return generateExercisePrescription({ user, latestRecord })
}

function ymd(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const dd = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export async function getExerciseLogs(userId) {
  return db.getUserExerciseLogs(userId)
}

export async function setExerciseCompletion(userId, date, completed, extra = {}) {
  return db.upsertExerciseLog({ user_id: userId, date: ymd(date), completed: Boolean(completed), ...extra })
}

// 每日目标时长：优先读取用户自定义值，其次使用处方推荐时长，最后默认30分钟
export function getDailyGoalMinutes(userId, dateStr, fallbackMinutes) {
  try {
    const key = `goal_minutes_${userId}_${dateStr}`
    const v = localStorage.getItem(key)
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return n
  } catch (_e) {}
  const f = Number(fallbackMinutes)
  if (Number.isFinite(f) && f > 0) return f
  return 30
}

export function setDailyGoalMinutes(userId, dateStr, minutes) {
  try {
    const key = `goal_minutes_${userId}_${dateStr}`
    localStorage.setItem(key, String(Math.max(1, Number(minutes) || 0)))
  } catch (_e) {}
}

// 每周目标天数：优先读取用户自定义值，其次使用处方推荐频次，最后默认5天
export function getWeeklyPlannedDaysGoal(userId, fallbackDays = 5) {
  try {
    const key = `weekly_goal_days_${userId}`
    const v = localStorage.getItem(key)
    const n = Number(v)
    if (Number.isFinite(n) && n > 0 && n <= 7) return n
  } catch (_e) {}
  const f = Number(fallbackDays)
  if (Number.isFinite(f) && f > 0) return Math.min(Math.max(f, 1), 7)
  return 5
}

export function setWeeklyPlannedDaysGoal(userId, days) {
  try {
    const key = `weekly_goal_days_${userId}`
    const d = Math.min(Math.max(Number(days) || 0, 1), 7)
    localStorage.setItem(key, String(d))
  } catch (_e) {}
}

export async function getWeeklyExerciseSummary(userId, weekStartDate, plannedSessionsPerWeek = 5) {
  const dates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() + i)
    return ymd(d)
  })
  const logs = await db.getExerciseLogsByDates(userId, dates)
  // 获取默认目标时长（来自活动处方），用于每日目标回退
  let defaultGoal = 30
  try {
    const rx = await db.getUserActivePrescription(userId)
    defaultGoal = rx?.plan?.weekly?.sessionMinutes ?? rx?.fit?.time ?? 30
  } catch (_e) {}
  // 完成标准：当日累计时长 ≥ 当日目标时长
  const isEffective = (l) => {
    if (!l) return false
    const goal = getDailyGoalMinutes(userId, l.date, defaultGoal)
    const mins = typeof l.duration_mins === 'number' ? l.duration_mins : 0
    return mins >= goal
  }
  const completedSet = new Set(logs.filter(isEffective).map(l => l.date))
  const completedCount = completedSet.size
  const adherencePercent = computeAdherenceForWeek({ completedCount, plannedSessions: plannedSessionsPerWeek })
  return { dates, completedDates: Array.from(completedSet), completedCount, adherencePercent }
}

// Gate 事件封装
export async function logGateEvent(userId, { date, status, reasons = [], suggestedAction, forcedStart = false, prescription_id }) {
  return db.upsertGateEvent({
    user_id: userId,
    date,
    status,
    reasons,
    suggestedAction,
    forcedStart,
    prescription_id
  })
}

export async function updateGateEvent(eventId, updates) {
  return db.updateGateEvent(eventId, updates)
}

export async function getGateEvents(userId) {
  return db.getUserGateEvents(userId)
}

export async function getGateEventsByDates(userId, dates) {
  return db.getGateEventsByDates(userId, dates)
}
