import React from 'react'
import { Layout, Typography, Button, Space, Avatar, Dropdown } from 'antd'
import {
  UserOutlined,
  SoundOutlined,
  SoundFilled,
  SettingOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { useUser } from '../../contexts/UserContext'

const { Header } = Layout
const { Title } = Typography

const StyledHeader = styled(Header)`
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  
  @media (max-width: 768px) {
    padding: 0 16px;
  }
`

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  .logo-icon {
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }
  
  .logo-text {
    color: white;
    margin: 0;
    font-size: 20px;
    font-weight: bold;
    
    @media (max-width: 768px) {
      display: none;
    }
  }
`

const UserActions = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`

const VoiceToggle = styled(Button)`
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  background: rgba(255, 255, 255, 0.1);
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
    color: white;
  }
`

const UserAvatar = styled(Avatar)`
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`

const AppHeader = ({ onVoiceToggle }) => {
  const navigate = useNavigate()
  const { user, voiceEnabled, updateSettings, logout } = useUser()

  const handleVoiceToggle = () => {
    const newVoiceEnabled = !voiceEnabled
    updateSettings({ voiceEnabled: newVoiceEnabled })
    if (onVoiceToggle) {
      onVoiceToggle(newVoiceEnabled)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => navigate('/profile')
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => navigate('/profile')
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ]

  return (
    <StyledHeader>
      <Logo onClick={() => navigate('/')}>
        <div className="logo-icon">🏥</div>
        <Title className="logo-text">智康乐</Title>
      </Logo>

      <UserActions>
        <VoiceToggle
          shape="round"
          icon={voiceEnabled ? <SoundFilled /> : <SoundOutlined />}
          onClick={handleVoiceToggle}
          title={voiceEnabled ? '关闭语音播报' : '开启语音播报'}
        >
          {voiceEnabled ? '语音开' : '语音关'}
        </VoiceToggle>

        <Dropdown
          menu={{ items: userMenuItems }}
          placement="bottomRight"
          trigger={['click']}
        >
          <UserAvatar
            size="large"
            icon={<UserOutlined />}
            title={user?.name || '用户'}
          />
        </Dropdown>
      </UserActions>
    </StyledHeader>
  )
}

export default AppHeader