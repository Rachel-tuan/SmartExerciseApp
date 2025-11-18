import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from './UserContext';
import {
  getHealthRecords,
  getAllHealthRecords,
  getActivePrescription,
  getBadges,
  getDoctorNotes,
  addHealthRecord,
  updateHealthRecord,
  removeHealthRecord,
  addPrescription,
  addDoctorNote,
  getHealthStats,
  getAuditLogs
} from '../models';
import { normalizeConditions, extractConditionsFromText } from '../utils/conditions';
import { setCRFConfig, getCRFConfig } from '../engine';

const HealthDataContext = createContext();

export const useHealthData = () => {
  const context = useContext(HealthDataContext);
  if (!context) {
    throw new Error('useHealthData must be used within a HealthDataProvider');
  }
  return context;
};

export const HealthDataProvider = ({ children }) => {
  const { user } = useUser();
  const [healthRecords, setHealthRecords] = useState([]);
  const [activePrescription, setActivePrescription] = useState(null);
  const [badges, setBadges] = useState([]);
  const [doctorNotes, setDoctorNotes] = useState([]);
  const [healthStats, setHealthStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [crfOptions, setCrfOptions] = useState(() => {
    try {
      const raw = localStorage.getItem('crf_options');
      return raw ? JSON.parse(raw) : { USE_CRF: true, alpha: 1, beta: 0.1, priorityFactors: { 8: 1.25, 7: 1.12, 6: 1.0, 5: 0.9 } };
    } catch (_e) {
      return { USE_CRF: true, alpha: 1, beta: 0.1, priorityFactors: { 8: 1.25, 7: 1.12, 6: 1.0, 5: 0.9 } };
    }
  });

  // 刷新所有数据
  const refreshData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const [records, prescription, userBadges, notes, stats] = await Promise.all([
        getHealthRecords(user.user_id),
        getActivePrescription(user.user_id),
        getBadges(user.user_id),
        getDoctorNotes(user.user_id),
        getHealthStats(user.user_id)
      ]);

      setHealthRecords(records);
      setActivePrescription(prescription);
      setBadges(userBadges);
      setDoctorNotes(notes);
      setHealthStats(stats);
    } catch (err) {
      console.error('加载健康数据失败:', err);
      setError('加载健康数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载数据
  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user]);

  useEffect(() => {
    try { localStorage.setItem('crf_options', JSON.stringify(crfOptions)); } catch (_e) {}
    setCRFConfig(crfOptions);
  }, [crfOptions]);

  // 添加健康记录
  const addRecord = async (recordData) => {
    try {
      const result = await addHealthRecord(user.user_id, recordData);
      await refreshData();
      return result;
    } catch (err) {
      console.error('添加健康记录失败:', err);
      throw err;
    }
  };

  // 暴露与页面一致的方法别名
  const getAllRecords = async () => {
    return getAllHealthRecords(user.user_id);
  };

  const addHealthRecordAlias = async (recordData) => {
    return addRecord(recordData);
  };

  const updateHealthRecordAlias = async (recordId, updates) => {
    const res = await updateHealthRecord(recordId, updates);
    await refreshData();
    return res;
  };

  const removeHealthRecordAlias = async (recordId) => {
    await removeHealthRecord(recordId);
    await refreshData();
    return true;
  };

  // 添加处方
  const addNewPrescription = async (prescriptionData) => {
    try {
      const result = await addPrescription(user.user_id, prescriptionData);
      await refreshData();
      return result;
    } catch (err) {
      console.error('添加处方失败:', err);
      throw err;
    }
  };

  // 添加医生笔记
  const addNote = async (noteData) => {
    try {
      const result = await addDoctorNote(user.user_id, noteData);
      await refreshData();
      return result;
    } catch (err) {
      console.error('添加医生笔记失败:', err);
      throw err;
    }
  };

  // 医生笔记获取与方法别名
  const getDoctorNotesWrap = async () => {
    return getDoctorNotes(user.user_id);
  };

  const addDoctorNoteAlias = async (noteData) => {
    return addNote(noteData);
  };

  // 审计日志获取（按当前用户过滤）
  const getAuditLogsWrap = async () => {
    return getAuditLogs(user.user_id);
  };

  // 勋章与处方别名
  const getBadgesWrap = async () => {
    return getBadges(user.user_id);
  };

  const getActivePrescriptionWrap = async () => {
    return getActivePrescription(user.user_id);
  };

  // 获取今日数据
  const getTodayData = () => {
    if (!healthRecords || healthRecords.length === 0) return null;
    return healthRecords[0]; // 假设记录按时间倒序排列
  };

  // 获取健康评分
  const getHealthScore = () => {
    if (!healthStats) return 0;

    const { bloodPressureStatus, bloodSugarStatus, adherenceRate, bmiCategory } = healthStats;
    
    // 简单评分算法：基于血压、血糖和处方完成度的加权平均
    let score = 100;
    
    if (!bloodPressureStatus.isNormal) score -= 20;
    if (!bloodSugarStatus.isNormal) score -= 20;
    // BMI 权重（中国成人标准）：正常不扣分；超重/偏低 -10；肥胖 -20
    if (bmiCategory) {
      if (bmiCategory === '超重' || bmiCategory === '偏低') {
        score -= 10;
      } else if (bmiCategory === '肥胖') {
        score -= 20;
      }
    }
    
    const adherenceScore = (parseFloat(adherenceRate) / 100) * 40;
    score = Math.max(0, Math.min(100, score + adherenceScore - 40));

    return Math.round(score);
  };

  // 构建供引擎/规则使用的 UserProfile（规范化 conditions 为英文代码）
  const buildUserProfile = () => {
    const conditions = Array.isArray(user?.diseases) ? user.diseases : [];
    const mhText = user?.medical_history || user?.medicalHistory || '';
    const extras = extractConditionsFromText(mhText);
    const canonical = normalizeConditions([...(conditions || []), ...extras]);
    return {
      age: Number(user?.age) || 0,
      sex: (user?.gender === 'male' || user?.gender === 'female') ? user.gender : 'other',
      height: user?.height != null ? Number(user.height) : undefined,
      weight: user?.weight != null ? Number(user.weight) : undefined,
      waist: user?.waist != null ? Number(user.waist) : undefined,
      conditions: canonical
    };
  };

  const value = {
    healthRecords,
    activePrescription,
    badges,
    doctorNotes,
    healthStats,
    loading,
    error,
    refreshData,
    addRecord,
    // 页面调用兼容
    getAllHealthRecords: getAllRecords,
    addHealthRecord: addHealthRecordAlias,
    updateHealthRecord: updateHealthRecordAlias,
    removeHealthRecord: removeHealthRecordAlias,
    getDoctorNotes: getDoctorNotesWrap,
    addDoctorNote: addDoctorNoteAlias,
    getBadges: getBadgesWrap,
    getActivePrescription: getActivePrescriptionWrap,
    getAuditLogs: getAuditLogsWrap,
    addNewPrescription,
    addNote,
    getTodayData,
    getHealthScore
    ,buildUserProfile
    ,getCRFOptions: () => ({ ...getCRFConfig() })
    ,updateCRFOptions: (opts) => setCrfOptions(prev => ({ ...prev, ...opts }))
  };

  return (
    <HealthDataContext.Provider value={value}>
      {children}
    </HealthDataContext.Provider>
  );
};