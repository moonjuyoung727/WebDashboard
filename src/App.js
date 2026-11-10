import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import AuthLayout from "./layouts/AuthLayout";
import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./routes/ProtectedRoute";

import Login from "./pages/auth/Login";
import FindId from "./pages/auth/FindId";
import FindPw from "./pages/auth/FindPw";

import Settings from "./pages/settings/Settings";
import GeneralSettings from "./pages/settings/GeneralSettings";
import NotificationSettings from "./pages/settings/NotificationSettings";
import AccountSettings from "./pages/settings/AccountSettings";
import StorageSettings from "./pages/settings/StorageSettings";
import PrivacyZoneSettings from "./pages/settings/PrivacyZoneSettings";

import Dashboard from "./pages/Dashboard";
import Multiview from "./pages/Multiview";
import DeviceManagement from "./pages/DeviceManage";
import EventLogs from "./pages/EventLogs";
import Monitoring from "./pages/Monitoring";
import NotFound from "./pages/NotFound";
import VpnManage from "./pages/VpnManage";
import VpnCheck from "./pages/VpnCheck";
import { VpnProvider } from "./context/VpnContext";
import ComingSoon from "./components/ComingSoon";

// 서버 API 명세가 없는 화면. 명세가 나오면 pages/Reports, pages/settings/SubscriptionSettings를 다시 연결한다
const reportsComingSoon = (
  <ComingSoon
    title="통계 및 리포트는 준비 중입니다."
    description="서버 통계 API가 제공되면 이용할 수 있습니다."
  />
);

const subscriptionComingSoon = (
  <ComingSoon
    title="구독 관리는 준비 중입니다."
    description="서버 구독 · 결제 API가 제공되면 이용할 수 있습니다."
  />
);

function App() {
  return (
    <VpnProvider>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        {/* 로그인 전: 같은 카드가 주소에 맞춰 로그인 / 회원가입 / 찾기로 바뀐다 */}
        <Route element={<AuthLayout />}> 
          <Route path="/login" element={<Login />} />
          <Route path="/find-id" element={<FindId />} />
          <Route path="/reset-password" element={<FindPw />} />
          <Route path="/find-pw" element={<Login />} />
          <Route path="/signup" element={<Login />} />
        </Route>

        {/* 로그인 후 */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            <Route
              path="/multiview"
              element={<Multiview />}
            />

            <Route
              path="/subscription"
              element={subscriptionComingSoon}
            />

            <Route
              path="/devices"
              element={<DeviceManagement />}
            />

            <Route
              path="/monitoring/:cameraId"
              element={<Monitoring />}
            />

            <Route
              path="/event-logs"
              element={<EventLogs />}
            />

            <Route
              path="/reports"
              element={reportsComingSoon}
            />

            <Route 
              path="/vpn-manage"
              element={<VpnManage />}
            />
            <Route 
              path="/vpn-check" 
              element={<VpnCheck />} 
            />

            <Route path="/settings" element={<Settings />}>
              <Route index element={<GeneralSettings />} />
              <Route path="general" element={<GeneralSettings />} />
              <Route path="notifications" element={<NotificationSettings />} />
              <Route path="account" element={<AccountSettings />} />
              <Route path="subscription" element={subscriptionComingSoon} />
              <Route path="storage" element={<StorageSettings />} />
              <Route path="privacy-zones" element={<PrivacyZoneSettings />} />
            </Route>

          </Route>
        </Route>

        <Route
          path="*"
          element={<NotFound />}
        />
      </Routes>
    </BrowserRouter>
    </VpnProvider>
  );
}

export default App;