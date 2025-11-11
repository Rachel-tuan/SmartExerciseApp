import React, { useState, useEffect } from 'react';
import { Card, List, Typography, Space, Tag, Empty, Progress } from 'antd';
import { TrophyOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useHealthData } from '../contexts/HealthDataContext';
import { useUser } from '../contexts/UserContext';
import { getWeeklyExerciseSummary, getWeeklyPlannedDaysGoal } from '../models';
import { format, startOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const { Title, Text } = Typography;

const BadgeContainer = styled.div`
  .badge-card {
    margin-bottom: 16px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    
    .ant-card-head {
      border-bottom: none;
    }
    
    .ant-card-body {
      padding-top: 0;
    }
  }

  .badge-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;
    color: white;
    font-size: 24px;
  }

  .badge-progress {
    margin-top: 16px;
    padding: 16px;
    background: #f9fafb;
    border-radius: 8px;
  }

  .badge-list {
    .ant-list-item {
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 8px;
      background: white;
      transition: all 0.3s;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    }
  }
`;

const BadgePage = () => {
  const { getBadges } = useHealthData();
  const { user } = useUser();
  const [badges, setBadges] = useState([]);
  const [currentProgress, setCurrentProgress] = useState(0);

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    const allBadges = await getBadges();
    setBadges(allBadges);

    // 使用运动打卡与每周目标天数计算本周运动处方完成进度
    if (user?.user_id) {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const plannedDays = getWeeklyPlannedDaysGoal(user.user_id, 5);
      const summary = await getWeeklyExerciseSummary(user.user_id, weekStart, plannedDays);
      setCurrentProgress(summary.adherencePercent || 0);
    }
  };

  const renderBadgeStatus = (badge) => {
    if (badge.achieved) {
      return (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          已获得
        </Tag>
      );
    }
    return (
      <Tag color="default" icon={<ClockCircleOutlined />}>
        未获得
      </Tag>
    );
  };

  return (
    <BadgeContainer>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card className="badge-card">
          <Space align="center">
            <div className="badge-icon">
              <TrophyOutlined />
            </div>
            <div>
              <Title level={2} style={{ margin: 0 }}>我的勋章</Title>
              <Text type="secondary">
                已获得 {badges.filter(badge => badge.achieved).length} 枚勋章
              </Text>
            </div>
          </Space>
        </Card>

        <Card className="badge-card" title="当前进度">
          <div className="badge-progress">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>本周运动处方完成进度</Text>
              <Progress
                percent={currentProgress}
                strokeColor={{
                  '0%': '#fbbf24',
                  '100%': '#d97706'
                }}
                format={percent => `${percent}%`}
              />
              <Text type="secondary">
                达到80%以上可获得连续达标勋章
              </Text>
            </Space>
          </div>
        </Card>

        <Card className="badge-card" title="勋章列表">
          {badges.length > 0 ? (
            <List
              className="badge-list"
              itemLayout="horizontal"
              dataSource={badges}
              renderItem={badge => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <div className="badge-icon" style={{
                        background: badge.achieved
                          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                          : '#e5e7eb'
                      }}>
                        <TrophyOutlined />
                      </div>
                    }
                    title={
                      <Space>
                        <Text strong>{badge.name}</Text>
                        {renderBadgeStatus(badge)}
                      </Space>
                    }
                    description={
                      <Space direction="vertical">
                        <Text>{badge.description}</Text>
                        {badge.achieved && (
                          <Text type="secondary">
                            获得时间：{format(new Date(badge.achieved_at), 'yyyy年MM月dd日', { locale: zhCN })}
                          </Text>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无勋章"
            />
          )}
        </Card>
      </Space>
    </BadgeContainer>
  );
};

export default BadgePage;