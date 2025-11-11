import React, { useEffect } from 'react';
import { Layout, Menu, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  HomeOutlined,
  MedicineBoxOutlined,
  FormOutlined,
  TrophyOutlined,
  FileTextOutlined,
  UserOutlined,
  HeartOutlined,
  BarChartOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useUser } from '../../contexts/UserContext';

const { Header, Content, Footer } = Layout;

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { elderlyMode } = useUser();
  const { token } = theme.useToken();

  // 根据当前路径设置选中的菜单项
  const selectedKey = location.pathname === '/' ? 'home' : location.pathname.slice(1);

  // 菜单项配置
  const menuItems = [
    {
      key: 'home',
      icon: <HomeOutlined />,
      label: '首页',
      path: '/'
    },
    {
      key: 'exercise',
      icon: <HeartOutlined />,
      label: '运动',
      path: '/exercise'
    },
    {
      key: 'prescription',
      icon: <MedicineBoxOutlined />,
      label: '处方',
      path: '/prescription'
    },
    {
      key: 'data-record',
      icon: <FormOutlined />,
      label: '记录',
      path: '/data-record'
    },
    {
      key: 'history',
      icon: <BarChartOutlined />,
      label: '趋势',
      path: '/history'
    },
    {
      key: 'badge',
      icon: <TrophyOutlined />,
      label: '勋章',
      path: '/badge'
    },
    {
      key: 'doctor',
      icon: <FileTextOutlined />,
      label: '医生',
      path: '/doctor'
    },
    {
      key: 'admin',
      icon: <SettingOutlined />,
      label: '管理',
      path: '/admin'
    },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '我的',
      path: '/profile'
    }
  ];

  // 处理菜单点击
  const handleMenuClick = (info) => {
    const item = menuItems.find(item => item.key === info.key);
    if (item) {
      navigate(item.path);
    }
  };

  // 应用老年模式样式
  useEffect(() => {
    const body = document.body;
    if (elderlyMode) {
      body.classList.add('elderly-mode');
    } else {
      body.classList.remove('elderly-mode');
    }
  }, [elderlyMode]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          position: 'fixed',
          top: 0,
          zIndex: 1,
          width: '100%',
          background: token.colorBgContainer,
          padding: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <Menu
          theme="light"
          mode="horizontal"
          selectedKeys={[selectedKey]}
          onClick={handleMenuClick}
          items={menuItems}
          style={{
            fontSize: elderlyMode ? '16px' : '14px',
            justifyContent: 'center'
          }}
        />
      </Header>

      <Content
        style={{
          marginTop: 64,
          padding: '24px',
          background: token.colorBgLayout
        }}
      >
        <div
          style={{
            padding: 24,
            minHeight: 380,
            background: token.colorBgContainer,
            borderRadius: token.borderRadius
          }}
        >
          <Outlet />
        </div>
      </Content>

      <Footer
        style={{
          textAlign: 'center',
          background: 'transparent'
        }}
      >
        智康乐 ©{new Date().getFullYear()} 老年慢病智能管理助手
      </Footer>
    </Layout>
  );
};

export default MainLayout;