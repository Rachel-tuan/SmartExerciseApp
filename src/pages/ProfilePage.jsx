import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Switch, Space, Typography, message, Divider, Select, Modal, InputNumber, Tag } from 'antd';
import { UserOutlined, SettingOutlined, SoundOutlined, EyeOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { useHealthData } from '../contexts/HealthDataContext';
import { toChineseLabel } from '../utils/conditions';

const { Title, Text } = Typography;
const { Option } = Select;

const ProfileContainer = styled.div`
  .profile-card {
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

  .profile-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;
    color: white;
    font-size: 24px;
  }

  .settings-section {
    padding: 24px;
    background: #f8fafc;
    border-radius: 8px;
    margin-bottom: 16px;

    .setting-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;

      &:not(:last-child) {
        border-bottom: 1px solid #e2e8f0;
      }
    }
  }

  .form-section {
    max-width: 600px;
    margin: 0 auto;
  }
`;

const ProfilePage = () => {
  const { user, updateUser, updateSettings, elderlyMode, voiceEnabled, logout } = useUser();
  const { buildUserProfile } = useHealthData();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        name: user.name,
        age: user.age,
        gender: user.gender,
        phone: user.phone,
        emergency_contact: user.emergency_contact,
        medical_history: user.medical_history,
        height: user.height,
        weight: user.weight,
        waist: user.waist,
        onInsulinOrSecretagogue: Boolean(user.onInsulinOrSecretagogue)
      });
    }
  }, [user, form]);

  const handleUpdateProfile = async (values) => {
    try {
      setLoading(true);
      await updateUser(values);
      message.success('个人资料更新成功');
    } catch (error) {
      message.error('更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = async (setting, value) => {
    try {
      await updateSettings({ [setting]: value });
      message.success('设置更新成功');
    } catch (error) {
      message.error('设置更新失败，请重试');
    }
  };

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出登录',
      icon: <ExclamationCircleOutlined />,
      content: '退出后需要重新登录，是否继续？',
      okText: '退出',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await logout();
          message.success('已退出登录');
          navigate('/login', { replace: true });
        } catch (error) {
          message.error('退出失败，请稍后再试');
        }
      }
    });
  };

  return (
    <ProfileContainer>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card className="profile-card">
          <Space align="center">
            <div className="profile-icon">
              <UserOutlined />
            </div>
            <div>
              <Title level={2} style={{ margin: 0 }}>个人资料</Title>
              <Text type="secondary">
                管理您的个人信息和应用设置
              </Text>
            </div>
          </Space>
        </Card>

        <Card className="profile-card" title="慢病标签">
          <Space wrap>
            {(() => {
              const profile = buildUserProfile();
              const cond = Array.isArray(profile.conditions) ? profile.conditions : [];
              if (cond.length === 0) {
                return <Text type="secondary">未标注慢病</Text>;
              }
              return cond.map((c) => (
                <Tag color="geekblue" key={c}>{toChineseLabel(c)}</Tag>
              ));
            })()}
          </Space>
        </Card>

        <Card className="profile-card" title="基本信息">
          <div className="form-section">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleUpdateProfile}
              initialValues={{
                name: '',
                age: '',
                gender: '',
                phone: '',
                emergency_contact: '',
                medical_history: '',
                height: undefined,
                weight: undefined,
                waist: undefined,
                onInsulinOrSecretagogue: false
              }}
            >
              <Form.Item
                name="name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>

              <Form.Item
                name="age"
                label="年龄"
                rules={[
                  { required: true, message: '请输入年龄' },
                  { type: 'number', min: 18, max: 120, message: '请输入18-120之间的年龄' }
                ]}
              >
                <InputNumber style={{ width: '100%' }} placeholder="请输入年龄" />
              </Form.Item>

              <Form.Item
                name="gender"
                label="性别"
                rules={[{ required: true, message: '请选择性别' }]}
              >
                <Select placeholder="请选择性别">
                  <Option value="male">男</Option>
                  <Option value="female">女</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="phone"
                label="联系电话"
                rules={[
                  { required: true, message: '请输入联系电话' },
                  { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
                ]}
              >
                <Input placeholder="请输入联系电话" />
              </Form.Item>

              <Form.Item
                name="emergency_contact"
                label="紧急联系人"
                rules={[{ required: true, message: '请输入紧急联系人' }]}
              >
                <Input placeholder="请输入紧急联系人" />
              </Form.Item>

              <Form.Item
                name="medical_history"
                label="病史记录"
              >
                <Input.TextArea
                  placeholder="请输入病史记录"
                  autoSize={{ minRows: 3, maxRows: 6 }}
                />
              </Form.Item>

              <Form.Item
                name="height"
                label="身高 (cm)"
                rules={[
                  { required: true, message: '请输入身高' },
                  { type: 'number', min: 100, max: 250, message: '请输入100-250之间的数值' }
                ]}
              >
                <InputNumber style={{ width: '100%' }} placeholder="例如 170" />
              </Form.Item>

              <Form.Item
                name="weight"
                label="体重 (kg)"
                rules={[
                  { required: true, message: '请输入体重' },
                  { type: 'number', min: 30, max: 200, message: '请输入30-200之间的数值' }
                ]}
              >
                <InputNumber style={{ width: '100%' }} placeholder="例如 65.5" step={0.1} />
              </Form.Item>

              <Form.Item
                label="腰围(cm)"
                name="waist"
                rules={[
                  { required: true, message: '请输入腰围' },
                  { type: 'number', min: 50, max: 150, message: '请输入50-150之间的数值' }
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={50} max={150} placeholder="例如 88" />
              </Form.Item>

              <Form.Item label="使用胰岛素/促泌剂" name="onInsulinOrSecretagogue" valuePropName="checked">
                <Switch />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                >
                  保存修改
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Card>

        <Card className="profile-card" title="应用设置">
          <div className="settings-section">
            <div className="setting-item">
              <Space>
                <EyeOutlined />
                <Text>老年人模式</Text>
              </Space>
              <Switch
                checked={elderlyMode}
                onChange={(checked) => handleSettingChange('elderlyMode', checked)}
              />
            </div>

            <div className="setting-item">
              <Space>
                <SoundOutlined />
                <Text>语音播报</Text>
              </Space>
              <Switch
                checked={voiceEnabled}
                onChange={(checked) => handleSettingChange('voiceEnabled', checked)}
              />
            </div>
          </div>

          <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
            开启老年人模式后，界面将使用更大的字体和更简单的布局
          </Text>
        </Card>

        <Card className="profile-card" title="账号与安全">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>当前账号：{user?.name}</Text>
            <Button danger block onClick={handleLogout}>
              退出登录 / 切换账号
            </Button>
          </Space>
        </Card>
      </Space>
    </ProfileContainer>
  );
};

export default ProfilePage;