import { openDB } from 'idb';
import { nanoid } from 'nanoid';

const DB_NAME = 'zkl_db';
const DB_VERSION = 6;

// 示例数据
const SAMPLE_DATA = {
  users: [
    {
      user_id: 'user_1',
      name: '张大爷',
      age: 68,
      gender: 'male',
      phone: '13800138000',
      emergency_contact: '13900139000',
      medical_history: '高血压10年，饮食偏咸，偶有头晕',
      height: 170,
      weight: 65,
      settings: {
        elderlyMode: true,
        voiceEnabled: true
      }
    }
  ],
  health_records: [
    // 最近10天的样例数据，包含 record_date 与 timestamp 以适配各页面
    ...Array.from({ length: 10 }).map((_, i) => {
      const dayOffset = 9 - i; // 9天前到今天
      const date = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
      const iso = date.toISOString();
      // 制造一些波动数据
      const systolic = [150, 145, 140, 135, 138, 142, 130, 128, 132, 136][i] || 135;
      const diastolic = [95, 92, 90, 85, 88, 89, 82, 80, 84, 86][i] || 85;
      const bloodSugar = [7.5, 7.2, 6.9, 6.5, 6.8, 6.6, 6.1, 5.9, 6.0, 6.2][i] || 6.2;
      const weight = [65.5, 65.3, 65.1, 65.0, 64.9, 64.8, 64.8, 64.7, 64.7, 64.6][i] || 65;
      return {
        record_id: `record_${i + 1}`,
        user_id: 'user_1',
        timestamp: iso,
        record_date: iso,
        systolic,
        diastolic,
        blood_sugar: bloodSugar,
        weight,
        height: 170,
        notes: i % 3 === 0 ? '按时服药，感觉良好' : i % 3 === 1 ? '清淡饮食，少盐' : '今日适量运动'
      };
    })
  ],
  exercise_logs: [
    // 结构：{ log_id, user_id, date: 'YYYY-MM-DD', completed: true, created_at }
  ],
  gate_events: [
    // 结构：{ event_id, user_id, date: 'YYYY-MM-DD', status: 'green'|'yellow'|'red', reasons:[], suggestedAction, forcedStart, prescription_id }
  ],
  prescriptions: [
    {
      prescription_id: 'prescription_1',
      user_id: 'user_1',
      medicine_name: '盐酸贝那普利片',
      instructions: '饭后服用，注意少盐少油',
      daily_count: 2,
      dosage: '10mg',
      start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      notes: '如有头晕乏力等不适，及时就医',
      status: 'active',
      taken_count: 10
    },
    {
      prescription_id: 'prescription_2',
      user_id: 'user_1',
      medicine_name: '二甲双胍缓释片',
      instructions: '晚餐后服用，配合控糖饮食',
      daily_count: 1,
      dosage: '0.5g',
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      notes: '注意监测空腹血糖',
      status: 'completed',
      taken_count: 28
    }
  ],
  badges: [
    {
      badge_id: 'badge_1',
      user_id: 'user_1',
      name: '坚持服药7天',
      description: '连续7天处方完成度达80%以上',
      achieved: true,
      achieved_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      badge_id: 'badge_2',
      user_id: 'user_1',
      name: '连续记录3天',
      description: '连续3天填写健康数据',
      achieved: true,
      achieved_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      badge_id: 'badge_3',
      user_id: 'user_1',
      name: '血压改善',
      description: '近期收缩压较基线下降5mmHg',
      achieved: false
    }
  ],
  doctor_notes: [
    {
      note_id: 'note_1',
      user_id: 'user_1',
      visit_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      content: '血压略高，建议控制盐摄入，按时服药并监测血压',
      doctor_name: '李医生'
    },
    {
      note_id: 'note_2',
      user_id: 'user_1',
      visit_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      content: '血压控制趋于稳定，继续当前方案，注意适量运动',
      doctor_name: '王医生'
    }
  ]
};

// 数据库连接实例
let dbInstance = null;

// 初始化数据库
export async function initDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // 创建存储对象
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'user_id' });
      }
      if (!db.objectStoreNames.contains('health_records')) {
        db.createObjectStore('health_records', { keyPath: 'record_id' });
      }
      if (!db.objectStoreNames.contains('prescriptions')) {
        db.createObjectStore('prescriptions', { keyPath: 'prescription_id' });
      }
      if (!db.objectStoreNames.contains('badges')) {
        db.createObjectStore('badges', { keyPath: 'badge_id' });
      }
      if (!db.objectStoreNames.contains('doctor_notes')) {
        db.createObjectStore('doctor_notes', { keyPath: 'note_id' });
      }
      if (!db.objectStoreNames.contains('exercise_logs')) {
        db.createObjectStore('exercise_logs', { keyPath: 'log_id' });
      }
      if (!db.objectStoreNames.contains('gate_events')) {
        db.createObjectStore('gate_events', { keyPath: 'event_id' });
      }
      if (!db.objectStoreNames.contains('measurements_audit_log')) {
        db.createObjectStore('measurements_audit_log', { keyPath: 'audit_id' });
      }
      if (!db.objectStoreNames.contains('crf_audit_logs')) {
        db.createObjectStore('crf_audit_logs', { keyPath: 'crf_audit_id' });
      }

      // 初始化示例数据
      const stores = ['users', 'health_records', 'prescriptions', 'badges', 'doctor_notes', 'exercise_logs', 'gate_events'];
      stores.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        SAMPLE_DATA[storeName].forEach(item => {
          // 使用 put 以便在版本升级时覆盖旧数据，确保演示数据最新
          store.put(item);
        });
      });
    }
  });

  return dbInstance;
}

// 通用CRUD操作
export async function add(storeName, data) {
  const db = await initDB();
  return db.add(storeName, data);
}

export async function get(storeName, key) {
  const db = await initDB();
  return db.get(storeName, key);
}

export async function getAll(storeName) {
  const db = await initDB();
  return db.getAll(storeName);
}

export async function put(storeName, data) {
  const db = await initDB();
  return db.put(storeName, data);
}

export async function remove(storeName, key) {
  const db = await initDB();
  return db.delete(storeName, key);
}

// 获取指定用户的所有健康记录
export async function getUserHealthRecords(userId) {
  const db = await initDB();
  const tx = db.transaction('health_records', 'readonly');
  const store = tx.objectStore('health_records');
  const records = await store.getAll();
  return records.filter(record => record.user_id === userId);
}

// 获取指定用户的活跃处方
export async function getUserActivePrescription(userId) {
  const db = await initDB();
  const tx = db.transaction('prescriptions', 'readonly');
  const store = tx.objectStore('prescriptions');
  const prescriptions = await store.getAll();
  return prescriptions.find(
    prescription => 
      prescription.user_id === userId && 
      prescription.status === 'active' &&
      new Date(prescription.end_date) > new Date()
  );
}

// 获取指定用户的所有勋章
export async function getUserBadges(userId) {
  const db = await initDB();
  const tx = db.transaction('badges', 'readonly');
  const store = tx.objectStore('badges');
  const badges = await store.getAll();
  return badges.filter(badge => badge.user_id === userId);
}

// 获取指定用户的所有医生笔记
export async function getUserDoctorNotes(userId) {
  const db = await initDB();
  const tx = db.transaction('doctor_notes', 'readonly');
  const store = tx.objectStore('doctor_notes');
  const notes = await store.getAll();
  return notes.filter(note => note.user_id === userId);
}

// 运动打卡相关
export async function getUserExerciseLogs(userId) {
  const db = await initDB();
  const tx = db.transaction('exercise_logs', 'readonly');
  const store = tx.objectStore('exercise_logs');
  const logs = await store.getAll();
  return logs.filter(log => log.user_id === userId);
}

export async function upsertExerciseLog({ user_id, date, completed, log_id, rpe, symptoms, duration_mins, notes }) {
  const db = await initDB();
  const tx = db.transaction('exercise_logs', 'readwrite');
  const store = tx.objectStore('exercise_logs');
  // 先查找同一天是否已有
  const all = await store.getAll();
  let existing = all.find(l => l.user_id === user_id && l.date === date);
  // 若已有当天记录，则对时长进行“累计”而非覆盖
  const log = existing ? {
    ...existing,
    completed: Boolean(completed),
    rpe: typeof rpe === 'number' ? rpe : existing.rpe,
    symptoms: Array.isArray(symptoms) ? symptoms : existing.symptoms,
    duration_mins: typeof duration_mins === 'number' ? ((Number(existing.duration_mins) || 0) + Number(duration_mins)) : existing.duration_mins,
    notes: notes != null ? notes : existing.notes
  } : {
    log_id: log_id || nanoid(),
    user_id,
    date, // YYYY-MM-DD
    completed: Boolean(completed),
    rpe: typeof rpe === 'number' ? rpe : undefined,
    symptoms: Array.isArray(symptoms) ? symptoms : undefined,
    duration_mins: typeof duration_mins === 'number' ? duration_mins : undefined,
    notes: notes || undefined,
    created_at: new Date().toISOString()
  };
  await store.put(log);
  await tx.done;
  return log;
}

export async function getExerciseLogsByDates(userId, dates = []) {
  const logs = await getUserExerciseLogs(userId);
  const set = new Set(dates);
  return logs.filter(l => set.has(l.date));
}

// Gate events
export async function getUserGateEvents(userId) {
  const db = await initDB();
  const tx = db.transaction('gate_events', 'readonly');
  const store = tx.objectStore('gate_events');
  const events = await store.getAll();
  return events.filter(e => e.user_id === userId);
}

export async function upsertGateEvent({ event_id, user_id, date, status, reasons, suggestedAction, forcedStart, prescription_id }) {
  const db = await initDB();
  const tx = db.transaction('gate_events', 'readwrite');
  const store = tx.objectStore('gate_events');
  const all = await store.getAll();
  let existing = all.find(e => e.user_id === user_id && e.date === date && e.prescription_id === prescription_id);
  const evt = existing ? { ...existing, status, reasons, suggestedAction, forcedStart } : {
    event_id: event_id || nanoid(),
    user_id,
    date,
    status,
    reasons: Array.isArray(reasons) ? reasons : [],
    suggestedAction: suggestedAction || undefined,
    forcedStart: Boolean(forcedStart),
    prescription_id: prescription_id || undefined,
    created_at: new Date().toISOString()
  };
  await store.put(evt);
  await tx.done;
  return evt;
}

export async function updateGateEvent(event_id, updates = {}) {
  const db = await initDB();
  const tx = db.transaction('gate_events', 'readwrite');
  const store = tx.objectStore('gate_events');
  const existing = await store.get(event_id);
  if (!existing) return null;
  const evt = { ...existing, ...updates };
  await store.put(evt);
  await tx.done;
  return evt;
}

export async function getGateEventsByDates(userId, dates = []) {
  const events = await getUserGateEvents(userId);
  const set = new Set(dates);
  return events.filter(e => set.has(e.date));
}

export async function saveAuditLog({ audit_id, user_id, action, status, reason, record_id, payload, created_at }) {
  const db = await initDB();
  const tx = db.transaction('measurements_audit_log', 'readwrite');
  const store = tx.objectStore('measurements_audit_log');
  const log = {
    audit_id: audit_id || nanoid(),
    user_id,
    action, // 'add' | 'update' | 'remove' | 'validation_error'
    status, // 'success' | 'blocked'
    reason: reason || undefined,
    record_id: record_id || undefined,
    payload: payload || undefined,
    created_at: created_at || new Date().toISOString()
  };
  await store.put(log);
  await tx.done;
  return log;
}

export async function saveCRFAuditLog({ crf_audit_id, timestamp, admin, action, old_config, new_config }) {
  const db = await initDB();
  const tx = db.transaction('crf_audit_logs', 'readwrite');
  const store = tx.objectStore('crf_audit_logs');
  const log = {
    crf_audit_id: crf_audit_id || nanoid(),
    timestamp: timestamp || new Date().toISOString(),
    admin: admin || undefined,
    action,
    old_config: old_config || undefined,
    new_config: new_config || undefined
  };
  await store.put(log);
  await tx.done;
  return log;
}

export async function getCRFAuditLogs() {
  const db = await initDB();
  const tx = db.transaction('crf_audit_logs', 'readonly');
  const store = tx.objectStore('crf_audit_logs');
  const logs = await store.getAll();
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
