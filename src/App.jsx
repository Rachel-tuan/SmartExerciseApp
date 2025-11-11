import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';

// 导入上下文提供者
import { UserProvider } from './contexts/UserContext';
import { HealthDataProvider } from './contexts/HealthDataContext';

// 导入页面组件
import HomePage from './pages/HomePage';
import PrescriptionPage from './pages/PrescriptionPage';
import DataRecordPage from './pages/DataRecordPage';
import BadgePage from './pages/BadgePage';
import DoctorPage from './pages/DoctorPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import ExercisePage from './pages/ExercisePage';
import OnboardingPage from './pages/OnboardingPage';
import MeasurePage from './pages/MeasurePage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';

// 导入布局组件
import MainLayout from './components/Layout/MainLayout';
import { useUser } from './contexts/UserContext';

function RequireAuth({ children }) {
  const { user, loading } = useUser();
  if (loading) return null;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#00b96b',
          borderRadius: 8,
        },
      }}
    >
      <UserProvider>
        <HealthDataProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>}>
              <Route index element={<HomePage />} />
              <Route path="home" element={<HomePage />} />
              <Route path="onboarding" element={<OnboardingPage />} />
              <Route path="measure" element={<MeasurePage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="prescription" element={<PrescriptionPage />} />
              <Route path="exercise" element={<ExercisePage />} />
              <Route path="data-record" element={<DataRecordPage />} />
              <Route path="badge" element={<BadgePage />} />
              <Route path="doctor" element={<DoctorPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HealthDataProvider>
      </UserProvider>
    </ConfigProvider>
  );
}

export default App;