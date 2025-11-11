import React, { createContext, useContext, useState, useEffect } from 'react';
import { upsertUser, updateUserSettings, seedTestAccounts } from '../models';
import * as db from '../models/db';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [elderlyMode, setElderlyMode] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  useEffect(() => {
    async function initializeUser() {
      try {
        // 注入测试账号（仅在不存在时创建），密码均为 password
        try {
          await seedTestAccounts();
        } catch (e) {
          // 忽略种子错误，继续初始化
          console.warn('测试账号种子初始化失败或已存在:', e?.message || e);
        }
        // 首次进入保持未登录，确保展示登录/注册页
        setUser(null);
      } catch (error) {
        console.error('初始化用户数据失败:', error);
      } finally {
        setLoading(false);
      }
    }

    initializeUser();
  }, []);

  const updateUser = async (updates) => {
    try {
      const updatedUser = await upsertUser({ ...user, ...updates });
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('更新用户信息失败:', error);
      throw error;
    }
  };

  const updateSettings = async (settings) => {
    try {
      const updatedUser = await updateUserSettings(user.user_id, settings);
      setUser(updatedUser);
      setElderlyMode(settings.elderlyMode ?? elderlyMode);
      setVoiceEnabled(settings.voiceEnabled ?? voiceEnabled);
      return updatedUser;
    } catch (error) {
      console.error('更新用户设置失败:', error);
      throw error;
    }
  };

  // 注册
  const register = async (userData) => {
    const mapped = {
      name: userData.name || userData.username || '用户',
      username: userData.username || userData.name,
      password: userData.password,
      age: userData.age ?? 65,
      gender: userData.gender || 'male',
      phone: userData.phone || '',
      emergency_contact: userData.emergencyContact || userData.emergency_contact || '',
      height: userData.height,
      weight: userData.weight,
      waist: userData.waist,
      diseases: userData.diseases || [],
      settings: {
        elderlyMode: elderlyMode,
        voiceEnabled: voiceEnabled
      }
    };
    // 唯一性校验：用户名与手机号
    const users = await db.getAll('users');
    if (users.some(u => (u.username === mapped.username))) {
      throw new Error('该用户名已被注册');
    }
    if (mapped.phone && users.some(u => (u.phone === mapped.phone))) {
      throw new Error('该手机号已绑定账户');
    }
    const saved = await upsertUser(mapped);
    return saved;
  };

  // 鉴权登录：仅允许已注册或预置测试账号
  const authLogin = async (username, password) => {
    const users = await db.getAll('users');
    // 支持用用户名或姓名匹配
    const found = users.find(u => (u.username === username || u.name === username));
    if (!found || String(found.password || '') !== String(password)) {
      throw new Error('账号不存在或密码错误');
    }
    localStorage.setItem('current_user_id', found.user_id);
    setUser(found);
    const { settings } = found;
    if (settings) {
      setElderlyMode(settings.elderlyMode ?? true);
      setVoiceEnabled(settings.voiceEnabled ?? true);
    }
    return found;
  };

  // 一键体验：登录到预置示例用户（user_1）
  const loginAsDemo = async () => {
    const demoId = 'user_1';
    const demoUser = await db.get('users', demoId);
    if (demoUser) {
      localStorage.setItem('current_user_id', demoId);
      setUser(demoUser);
      const { settings } = demoUser;
      if (settings) {
        setElderlyMode(settings.elderlyMode ?? true);
        setVoiceEnabled(settings.voiceEnabled ?? true);
      }
      return demoUser;
    }
    // 回退：若不存在则从数据库取第一个用户
    const all = await db.getAll('users');
    if (all && all.length > 0) {
      const u = all[0];
      localStorage.setItem('current_user_id', u.user_id);
      setUser(u);
      const { settings } = u;
      if (settings) {
        setElderlyMode(settings.elderlyMode ?? true);
        setVoiceEnabled(settings.voiceEnabled ?? true);
      }
      return u;
    }
    return null;
  };

  // 重置密码：通过用户名（或姓名）匹配，并可选校验手机号
  const resetPassword = async ({ username, phone, newPassword }) => {
    if (!newPassword || String(newPassword).length < 6) {
      throw new Error('新密码至少6位');
    }
    const users = await db.getAll('users');
    const found = users.find(u => (u.username === username || u.name === username));
    if (!found) {
      throw new Error('账户不存在');
    }
    if (phone && found.phone && String(found.phone) !== String(phone)) {
      throw new Error('手机号与账户不匹配');
    }
    const updated = await upsertUser({ ...found, password: newPassword });
    if (user && user.user_id === updated.user_id) {
      setUser(updated);
    }
    return updated;
  };

  const logout = async () => {
    localStorage.removeItem('current_user_id');
    setUser(null);
  };

  const value = {
    user,
    loading,
    elderlyMode,
    voiceEnabled,
    updateUser,
    updateSettings,
    register,
    authLogin,
    resetPassword,
    loginAsDemo,
    logout
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};