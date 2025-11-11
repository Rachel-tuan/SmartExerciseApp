import React, { useEffect, useMemo, useState } from 'react';
import { Card, Typography, Space, Tabs } from 'antd';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useHealthData } from '../contexts/HealthDataContext';
import { useUser } from '../contexts/UserContext';
import { getExerciseLogs, getDailyGoalMinutes } from '../models';

const { Title, Text } = Typography;

function formatDateLabel(dateStr) {
  // YYYY-MM-DD -> MM/DD
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}`;
}

function lastNDays(n) {
  const res = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const dd = `${d.getDate()}`.padStart(2, '0');
    res.push(`${y}-${m}-${dd}`);
  }
  return res;
}

export default function HistoryPage(){
  const { healthRecords } = useHealthData();
  const { user } = useUser();
  const [exerciseLogs, setExerciseLogs] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (user?.user_id) {
        try {
          const logs = await getExerciseLogs(user.user_id);
          if (mounted) setExerciseLogs(logs || []);
        } catch (_e) {
          if (mounted) setExerciseLogs([]);
        }
      }
    })();
    return () => { mounted = false };
  }, [user?.user_id]);

  const days = useMemo(() => lastNDays(14), []);

  const bpData = useMemo(() => {
    // 为每一天取最近一次记录的血压
    return days.map(d => {
      const rec = (healthRecords || []).find(r => r.timestamp?.slice(0,10) === d);
      return {
        date: d,
        label: formatDateLabel(d),
        systolic: rec?.systolic ?? null,
        diastolic: rec?.diastolic ?? null,
      };
    });
  }, [days, healthRecords]);

  const adherenceData = useMemo(() => {
    // 近14天完成率：按当日累计时长 / 当日目标时长 计算百分比（无记录为0）
    const map = new Map((exerciseLogs || []).map(l => [l.date, l]));
    return days.map(d => {
      const log = map.get(d);
      const mins = Number(log?.duration_mins) || 0;
      const goal = getDailyGoalMinutes(user?.user_id || 'unknown', d, 30);
      const pct = goal > 0 ? Math.min(100, Math.round((mins / goal) * 100)) : 0;
      return { date: d, label: formatDateLabel(d), completed: pct };
    });
  }, [days, exerciseLogs, user?.user_id]);

  const tabs = [
    {
      key: 'bp',
      label: '血压趋势',
      children: (
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={bpData} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis domain={[60, 200]} tickCount={8} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="systolic" name="收缩压" stroke="#ef4444" strokeWidth={2} connectNulls />
              <Line type="monotone" dataKey="diastolic" name="舒张压" stroke="#3b82f6" strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )
    },
    {
      key: 'adherence',
      label: '完成率（打卡）',
      children: (
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={adherenceData} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
              <Bar dataKey="completed" name="完成率" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    }
  ];

  return (
    <div style={{padding:16}}>
      <Space direction="vertical" size="large" style={{width:'100%'}}>
        <Title level={3}>趋势</Title>
        <Card>
          <Tabs defaultActiveKey="bp" items={tabs} />
          <Text type="secondary">数据来源：近14天内的健康记录与打卡日志；无记录的日期按0%显示。</Text>
        </Card>
      </Space>
    </div>
  );
}