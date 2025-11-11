import React, { useState } from 'react'
import {
  App as AntdApp,
  Card,
  Form,
  Input,
  Button,
  Typography,
  Space,
  Divider,
  Tabs,
  InputNumber,
  Select,
  Checkbox,
  Modal
} from 'antd'
import {
  UserOutlined,
  LockOutlined,
  MobileOutlined,
  SafetyOutlined,
  HeartOutlined
} from '@ant-design/icons'
import styled from 'styled-components'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../contexts/UserContext'
import * as db from '../models/db'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

const LoginContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`

const LoginCard = styled(Card)`
  width: 100%;
  max-width: 480px;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  
  .ant-card-body {
    padding: 40px;
    
    @media (max-width: 768px) {
      padding: 24px;
    }
  }
`

const LogoSection = styled.div`
  text-align: center;
  margin-bottom: 32px;
  
  .logo-icon {
    font-size: 64px;
    color: #6366f1;
    margin-bottom: 16px;
  }
  
  .logo-title {
    color: #1e293b;
    margin-bottom: 8px;
  }
  
  .logo-subtitle {
    color: #64748b;
    font-size: 16px;
  }
`

const ActionButton = styled(Button)`
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  
  &.primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border: none;
    
    &:hover {
      background: linear-gradient(135deg, #5855eb 0%, #7c3aed 100%);
    }
  }
`

const FeatureList = styled.div`
  margin-top: 24px;
  
  .feature-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    color: #64748b;
    font-size: 14px;
    
    .feature-icon {
      color: #6366f1;
    }
  }
`

const LoginPage = () => {
  const { message } = AntdApp.useApp()
  const navigate = useNavigate()
  const [loginForm] = Form.useForm()
  const [registerForm] = Form.useForm()
  const [resetForm] = Form.useForm()
  const [activeTab, setActiveTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [showAgreement, setShowAgreement] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showReset, setShowReset] = useState(false)

  const { register, authLogin, resetPassword } = useUser()

  const handleLogin = async (values) => {
    setLoading(true)
    try {
      await authLogin(values.username, values.password)
      message.success('登录成功！')
      navigate('/')
    } catch (error) {
      message.error('账号不存在或密码错误，请先注册')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (values) => {
    setLoading(true)
    try {
      const userData = {
        name: values.name,
        username: values.username,
        password: values.password,
        age: values.age,
        gender: values.gender,
        phone: values.phone,
        height: values.height,
        weight: values.weight,
        waist: values.waist,
        diseases: (values.diseases || []).filter(d => d !== 'none'),
        emergencyContact: values.emergencyContact
      }

      await register(userData)
      message.success('注册成功！请使用密码登录')
      // 切回登录页并预填用户名，便于用户直接登录
      setActiveTab('login')
      loginForm.setFieldsValue({ username: values.username })
      // 清空注册表单
      registerForm.resetFields()
    } catch (error) {
      message.error(error?.message || '注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (values) => {
    setLoading(true)
    try {
      await resetPassword({ username: values.username, phone: values.phone, newPassword: values.newPassword })
      message.success('密码已重置，请使用新密码登录')
      setShowReset(false)
      loginForm.setFieldsValue({ username: values.username })
      resetForm.resetFields()
    } catch (error) {
      message.error(error?.message || '重置失败，请检查信息')
    } finally {
      setLoading(false)
    }
  }

  const renderLoginForm = () => (
    <Form
      form={loginForm}
      layout="vertical"
      onFinish={handleLogin}
      size="large"
    >
      <Form.Item
        label="用户名"
        name="username"
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="请输入用户名"
        />
      </Form.Item>

      <Form.Item
        label="密码"
        name="password"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请输入密码"
        />
      </Form.Item>

      <Form.Item>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Checkbox>记住密码</Checkbox>
          <Button type="link" style={{ padding: 0 }} onClick={() => setShowReset(true)}>
            忘记密码？
          </Button>
        </div>
      </Form.Item>

      <Form.Item>
        <ActionButton
          type="primary"
          htmlType="submit"
          loading={loading}
          className="primary"
          block
        >
          登录
        </ActionButton>
      </Form.Item>
    </Form>
  )

  const renderRegisterForm = () => (
    <Form
      form={registerForm}
      layout="vertical"
      onFinish={handleRegister}
      size="large"
    >
      <Form.Item
        label="姓名"
        name="name"
        rules={[{ required: true, message: '请输入姓名' }]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="请输入真实姓名"
        />
      </Form.Item>

      <Form.Item
        label="用户名"
        name="username"
        rules={[
          { required: true, message: '请输入用户名' },
          { pattern: /^[A-Za-z0-9_]{3,20}$/, message: '仅限字母、数字、下划线，长度3-20位' },
          ({ getFieldValue }) => ({
            async validator(_, value) {
              if (!value || !/^[A-Za-z0-9_]{3,20}$/.test(value)) return Promise.resolve()
              const users = await db.getAll('users')
              const exists = users.some(u => (u.username === value || u.name === value))
              return exists ? Promise.reject(new Error('该用户名已被注册')) : Promise.resolve()
            }
          })
        ]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="请设置用户名"
        />
      </Form.Item>

      <Form.Item
        label="密码"
        name="password"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 6, message: '密码至少6位' }
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请设置密码"
        />
      </Form.Item>

      <Form.Item
        label="确认密码"
        name="confirmPassword"
        dependencies={['password']}
        rules={[
          { required: true, message: '请确认密码' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve()
              }
              return Promise.reject(new Error('两次输入的密码不一致'))
            },
          }),
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请再次输入密码"
        />
      </Form.Item>

      <Form.Item
        label="手机号"
        name="phone"
        rules={[
          { required: true, message: '请输入手机号' },
          { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
          ({ getFieldValue }) => ({
            async validator(_, value) {
              if (!value) return Promise.resolve()
              const users = await db.getAll('users')
              const exists = users.some(u => (u.phone === value))
              return exists ? Promise.reject(new Error('该手机号已绑定账户')) : Promise.resolve()
            }
          })
        ]}
      >
        <Input
          prefix={<MobileOutlined />}
          placeholder="请输入手机号"
        />
      </Form.Item>

      <div style={{ display: 'flex', gap: 16 }}>
        <Form.Item
          label="年龄"
          name="age"
          style={{ flex: 1 }}
          rules={[{ required: true, message: '请输入年龄' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="年龄"
            min={18}
            max={120}
          />
        </Form.Item>

        <Form.Item
          label="性别"
          name="gender"
          style={{ flex: 1 }}
          rules={[{ required: true, message: '请选择性别' }]}
        >
          <Select placeholder="请选择性别">
            <Option value="male">男</Option>
            <Option value="female">女</Option>
          </Select>
        </Form.Item>
      </div>

      <Form.Item
        label="腰围（cm）"
        name="waist"
        rules={[
          { required: true, message: '请输入腰围' },
          { type: 'number', min: 50, max: 150, message: '腰围范围为50-150cm' }
        ]}
      >
        <InputNumber style={{ width: '100%' }} placeholder="请输入腰围（cm）" />
      </Form.Item>

      <div style={{ display: 'flex', gap: 16 }}>
        <Form.Item
          label="身高 (cm)"
          name="height"
          style={{ flex: 1 }}
          rules={[
            { required: true, message: '请输入身高' },
            { type: 'number', min: 100, max: 250, message: '请输入100-250之间的数值' }
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="身高"
            min={100}
            max={250}
          />
        </Form.Item>

        <Form.Item
          label="体重 (kg)"
          name="weight"
          style={{ flex: 1 }}
          rules={[
            { required: true, message: '请输入体重' },
            { type: 'number', min: 30, max: 200, message: '请输入30-200之间的数值' }
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="体重"
            min={30}
            max={200}
            step={0.1}
          />
        </Form.Item>
      </div>

      <Form.Item
        label="慢性疾病（若无请选择“无”）"
        name="diseases"
        rules={[{ required: true, type: 'array', min: 1, message: '请选择至少一项慢性疾病，若无请选择“无”' }]}
      >
        <Select
          mode="multiple"
          placeholder="请选择您的慢性疾病"
          allowClear
        >
          <Option value="none">无</Option>
          <Option value="hypertension">高血压</Option>
          <Option value="diabetes">糖尿病</Option>
          <Option value="obesity">肥胖症</Option>
          <Option value="hyperlipidemia">高血脂</Option>
          <Option value="coronary_heart_disease">冠心病</Option>
          <Option value="fatty_liver">脂肪肝</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="紧急联系人"
        name="emergencyContact"
      >
        <Input
          placeholder="紧急联系人姓名和电话（可选）"
        />
      </Form.Item>

      <Form.Item
        name="agree"
        valuePropName="checked"
        rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject(new Error('请阅读并同意用户协议与隐私政策')) }]} 
      >
        <Checkbox>
          我已阅读并同意 
          <Button type="link" style={{ padding: 0 }} onClick={() => setShowAgreement(true)}>用户协议</Button> 
          和 
          <Button type="link" style={{ padding: 0 }} onClick={() => setShowPrivacy(true)}>隐私政策</Button>
        </Checkbox>
      </Form.Item>

      <Form.Item>
        <ActionButton
          type="primary"
          htmlType="submit"
          loading={loading}
          className="primary"
          block
        >
          注册
        </ActionButton>
      </Form.Item>
    </Form>
  )

  return (
    <LoginContainer>
      <LoginCard>
        <LogoSection>
          <div className="logo-icon">
            <HeartOutlined />
          </div>
          <Title level={2} className="logo-title">
            智康乐
          </Title>
          <Paragraph className="logo-subtitle">
            老年慢病智能管理助手
          </Paragraph>
        </LogoSection>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          size="large"
          items={[
            {
              key: 'login',
              label: '登录',
              children: renderLoginForm()
            },
            {
              key: 'register',
              label: '注册',
              children: renderRegisterForm()
            }
          ]}
        />

        <FeatureList>
          <div className="feature-item">
            <SafetyOutlined className="feature-icon" />
            <Text>基于循证医学的健康管理</Text>
          </div>
          <div className="feature-item">
            <HeartOutlined className="feature-icon" />
            <Text>个性化健康处方生成</Text>
          </div>
          <div className="feature-item">
            <UserOutlined className="feature-icon" />
            <Text>老年友好的界面设计</Text>
          </div>
        </FeatureList>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            © 2025 智康乐. 保留所有权利.
          </Text>
        </div>
      </LoginCard>
      {/* 用户协议与隐私政策弹窗 */}
      <Modal
        title="用户协议"
        open={showAgreement}
        onCancel={() => setShowAgreement(false)}
        onOk={() => setShowAgreement(false)}
        okText="我已阅读"
      >
        <Typography.Paragraph>
          欢迎使用智康乐。为保障您的合法权益，请您在注册或使用本服务前仔细阅读并同意本用户协议。
        </Typography.Paragraph>
        <Typography.Paragraph>
          1. 服务说明：本应用提供慢性病管理相关的记录、提醒与建议功能，建议仅供参考，不构成医疗诊断或治疗意见。
        </Typography.Paragraph>
        <Typography.Paragraph>
          2. 账户与安全：您应妥善保管账户与密码。如发现账户被盗用或安全漏洞，请立即联系我们处理。
        </Typography.Paragraph>
        <Typography.Paragraph>
          3. 合理使用：不得利用本服务从事违法违规行为，不得上传危害公共安全或侵犯他人合法权益的内容。
        </Typography.Paragraph>
        <Typography.Paragraph>
          4. 责任限制：因设备故障、网络原因或第三方因素导致的服务中断与数据丢失，我们不承担由此造成的损失。
        </Typography.Paragraph>
        <Typography.Paragraph>
          5. 变更与终止：我们可能根据业务发展对服务进行调整或中止，并提前在应用内通知。
        </Typography.Paragraph>
      </Modal>
      <Modal
        title="隐私政策"
        open={showPrivacy}
        onCancel={() => setShowPrivacy(false)}
        onOk={() => setShowPrivacy(false)}
        okText="我已阅读"
      >
        <Typography.Paragraph>
          我们重视您的隐私与个人信息保护。本政策依据《个人信息保护法》《网络安全法》等中国相关法律制定。
        </Typography.Paragraph>
        <Typography.Paragraph>
          1. 收集范围：我们收集您在注册与使用过程中主动提供的信息（如姓名、手机号、身高体重、健康记录），以及为提供服务所必需的设备与日志信息。
        </Typography.Paragraph>
        <Typography.Paragraph>
          2. 使用目的：用于账户管理、健康记录展示与建议生成、服务维护与安全保障，不会超出声明目的使用。
        </Typography.Paragraph>
        <Typography.Paragraph>
          3. 共享与转移：除法律法规要求或获得您明确同意外，不会向第三方共享您的个人信息；如需跨境传输，将依法征得同意并采取安全措施。
        </Typography.Paragraph>
        <Typography.Paragraph>
          4. 存储期限：我们仅在实现目的所必需的期限内保存您的信息；到期后将删除或匿名化处理。
        </Typography.Paragraph>
        <Typography.Paragraph>
          5. 权利保障：您有权访问、更正、删除个人信息并撤回同意；可通过应用内渠道联系我们行使权利。
        </Typography.Paragraph>
        <Typography.Paragraph>
          6. 安全措施：我们采取加密与访问控制等技术措施保护数据安全，但无法保证绝对安全。
        </Typography.Paragraph>
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        title="重置密码"
        open={showReset}
        onCancel={() => setShowReset(false)}
        onOk={() => resetForm.submit()}
        okText="确认重置"
      >
        <Form form={resetForm} layout="vertical" onFinish={handleReset} size="large">
          <Form.Item
            label="用户名/姓名"
            name="username"
            rules={[{ required: true, message: '请输入用户名或姓名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入用户名或姓名" />
          </Form.Item>
          <Form.Item
            label="手机号"
            name="phone"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
            ]}
          >
            <Input prefix={<MobileOutlined />} placeholder="请输入绑定的手机号" />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '新密码至少6位' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmNewPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                  return Promise.reject(new Error('两次输入的新密码不一致'))
                }
              })
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </LoginContainer>
  )
}

export default LoginPage