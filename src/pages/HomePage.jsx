import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Typography, Space, Avatar, Modal } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  RightOutlined,
  UserOutlined,
  MedicineBoxOutlined,
  FormOutlined,
  SoundOutlined,
  HeartOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { useUser } from '../contexts/UserContext';
import { useHealthData } from '../contexts/HealthDataContext';
import FreshnessBadge from '../components/FreshnessBadge';
import { preExerciseGate, getRuleMetaById, getRuleRecommendedFitById, getRulePriorityById } from '../engine';
import { getActivePrescription } from '../models';
// gate 事件改用 IndexedDB 封装
import { logGateEvent, updateGateEvent } from '../models';
import { useVoiceAssist } from '../components/useVoiceAssist';

const { Title, Text } = Typography;

// 样式组件
const HomeContainer = styled.div`
  .health-score-card {
    text-align: center;
    background: linear-gradient(135deg, #00b96b 0%, #00977b 100%);
    color: white;
    border-radius: 16px;
    overflow: hidden;
    
    .ant-card-body {
      padding: 24px;
    }
    
    .ant-typography {
      color: white;
    }
  }

  .quick-action-card {
    cursor: pointer;
    transition: all 0.3s;
    
    &:hover {
      transform: translateY(-3px);
    }
  }

  .action-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .action-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 20px;
  }
`;

const QuickActionCard = styled(Card)`
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const VoiceButton = styled(Button)`
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
`;

const HomePage = () => {
  const navigate = useNavigate();
  const { user, voiceEnabled } = useUser();
  const { getTodayData, buildUserProfile } = useHealthData();
  const { speak, cancel, speaking, supported } = useVoiceAssist({ lang: 'zh-CN', rate: 0.85 });
  const [exercisePrescription, setExercisePrescription] = useState(null);

  // 获取今日数据
  const todayData = getTodayData();

  // 简化首页：不计算评分与建议，仅展示最近测量与三大按钮

  // 语音播报健康状态
  const speakHealthStatus = () => {
    if (!todayData || !supported) return;
    const text = `您好，${user?.name || '用户'}。最近一次测量：血压 ${todayData?.systolic || '—'}/${todayData?.diastolic || '—'} mmHg，血糖 ${todayData?.blood_sugar || '—'} mmol/L。`;
    speak(text);
  };

  // 组件卸载时停止语音播报
  useEffect(() => {
    return () => {
      cancel();
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const rx = await getActivePrescription(user?.user_id);
        setExercisePrescription(rx || null);
      } catch (_e) {
        setExercisePrescription(null);
      }
    })();
  }, [user?.user_id]);

  return (
    <HomeContainer>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 用户信息卡片 */}
        <Card>
          <Row align="middle" justify="space-between">
            <Col>
              <Space size="middle">
                <Avatar size={64} icon={<UserOutlined />} />
                <div>
                  <Title level={4} style={{ margin: 0 }}>{user?.name}</Title>
                  <Text type="secondary">{user?.age}岁</Text>
                </div>
              </Space>
            </Col>
            <Col>
              <Button type="link" onClick={() => navigate('/profile')}>
                个人信息 <RightOutlined />
              </Button>
            </Col>
          </Row>
        </Card>
        {/* 最近测量时间 + 新鲜度徽章 */}
        {todayData && (
          <Card>
            <Space align="center" size="middle">
              <Text>最近测量：</Text>
              <Text strong>{new Date(todayData.timestamp).toLocaleString('zh-CN')}</Text>
              <FreshnessBadge timestamp={todayData.timestamp} source={todayData.source} confidence={todayData.confidence ?? todayData.confidence_score} />
            </Space>
          </Card>
        )}

        {/* 处方卡（FITT + 规则编号） */}
        {exercisePrescription && (
          <Card title="个体化运动处方" variant="outlined">
            <Space direction="vertical">
              <Text>频率：每周 {exercisePrescription?.fit?.freq ?? '—'} 天</Text>
              <Text>强度：{exercisePrescription?.fit?.intensity ?? '—'}</Text>
              <Text>时长：每次 {exercisePrescription?.fit?.time ?? '—'} 分钟</Text>
              <Text>类型：{exercisePrescription?.fit?.type ?? '—'}</Text>
              <Space wrap>
                <Text type="secondary">规则编号：</Text>
                {(exercisePrescription?.rules || []).map(id => (
                  <Button
                    key={id}
                    size="small"
                    onClick={() => {
                      const meta = getRuleMetaById(id);
                      if (meta) {
                        const fit = getRuleRecommendedFitById(id);
                        Modal.info({
                          title: meta.name,
                          content: (
                            <div>
                              <p>编号：{meta.id}</p>
                              <p>来源：{meta.source}</p>
                              {fit && (
                                <div style={{ marginTop: 8 }}>
                                  <p>推荐频率：每周 {fit.freq} 次</p>
                                  <p>推荐强度：{fit.intensity}</p>
                                  <p>推荐时长：每次 {fit.time} 分钟</p>
                                  <p>推荐类型：{fit.type}</p>
                                </div>
                              )}
                            </div>
                          )
                        });
                      } else {
                        Modal.info({ title: '规则说明', content: `未找到编号 ${id} 的规则说明` });
                      }
                    }}
                  >
                    {id}
                  </Button>
                ))}
              </Space>
            </Space>
          </Card>
        )}

        {/* 三大按钮 */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={6}>
            <QuickActionCard onClick={async () => {
              // 将今日数据映射为 Measurement[]
              const measurements = [];
              if (todayData?.systolic != null && todayData?.diastolic != null) {
                measurements.push({
                  type: 'bp',
                  value: { systolic: Number(todayData.systolic), diastolic: Number(todayData.diastolic) },
                  takenAt: todayData?.timestamp || new Date().toISOString(),
                  source: 'manual'
                });
              }
              if (todayData?.blood_sugar != null) {
                measurements.push({
                  type: 'bg',
                  value: { value: Number(todayData.blood_sugar), isFasting: Boolean(todayData?.blood_glucose_is_fasting) },
                  takenAt: todayData?.timestamp || new Date().toISOString(),
                  source: 'manual'
                });
              }
              if (todayData?.heart_rate != null) {
                measurements.push({
                  type: 'hr',
                  value: Number(todayData.heart_rate),
                  takenAt: todayData?.timestamp || new Date().toISOString(),
                  source: 'manual'
                });
              }

              // 映射用户档案到 UserProfile
              const profile = buildUserProfile();

              const gate = preExerciseGate(measurements, profile);
              const today = new Date();
              const y = today.getFullYear();
              const m = `${today.getMonth() + 1}`.padStart(2, '0');
              const d = `${today.getDate()}`.padStart(2, '0');
              const dateStr = `${y}-${m}-${d}`;
              // 记录闸门事件（IndexedDB）
              const evt = await logGateEvent(user?.user_id, {
                date: dateStr,
                status: gate.status,
                reasons: gate.reasons || [],
                suggestedAction: gate.suggestedAction,
                forcedStart: false,
                prescription_id: exercisePrescription?.prescription_id
              });

              if (gate.status === 'red') {
                Modal.confirm({
                  title: '暂缓运动',
                  content: (<ul>{gate.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>),
                  okText: '仍然开始',
                  cancelText: '取消',
                  onOk: async () => {
                    await updateGateEvent(evt?.event_id, { forcedStart: true });
                    navigate('/exercise');
                  }
                });
                return;
              }
              if (gate.status === 'yellow') {
                Modal.confirm({
                  title: '注意事项',
                  content: (
                    <div>
                      <ul>{gate.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                      {gate.suggestedAction && <p style={{ marginTop: 8 }}>建议：{gate.suggestedAction}</p>}
                    </div>
                  ),
                  okText: '仍然开始',
                  cancelText: '取消',
                  onOk: async () => {
                    await updateGateEvent(evt?.event_id, { forcedStart: true });
                    navigate('/exercise');
                  }
                });
                return;
              }
              navigate('/exercise');
            }}>
              <div className="action-content">
                <div className="action-icon" style={{ background: '#16a34a' }}>
                  <HeartOutlined />
                </div>
                <Text strong>开始运动</Text>
              </div>
            </QuickActionCard>
          </Col>
          <Col xs={12} sm={8} md={6}>
            <QuickActionCard onClick={() => navigate('/measure')}>
              <div className="action-content">
                <div className="action-icon" style={{ background: '#1890ff' }}>
                  <FormOutlined />
                </div>
                <Text strong>录入测量</Text>
              </div>
            </QuickActionCard>
          </Col>
          <Col xs={12} sm={8} md={6}>
            <QuickActionCard onClick={() => navigate('/prescription')}>
              <div className="action-content">
                <div className="action-icon" style={{ background: '#0891b2' }}>
                  <MedicineBoxOutlined />
                </div>
                <Text strong>查看处方</Text>
              </div>
            </QuickActionCard>
          </Col>
        </Row>

        {/* 语音播报按钮 */}
        {voiceEnabled && supported && (
          <VoiceButton
            type="primary"
            icon={<SoundOutlined />}
            onClick={speakHealthStatus}
            loading={speaking}
          />
        )}
      </Space>
    </HomeContainer>
  );
};

export default HomePage;