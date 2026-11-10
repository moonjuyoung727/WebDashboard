import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import useCameraList from "../hooks/useCameraList";
import { clearSession } from "../storage/authStorage";
import { logout } from "../api/authApi";
import "./Sidebar.css";

// 사이드바는 항상 떠 있으므로, 팝오버가 열려 있을 때만 보드 목록을 조회하도록 따로 둔다
function CameraPopoverList({ onSelect }) {
  const { cameras, source, errorMessage, isListReady } = useCameraList();

  if (!isListReady) {
    return (
      <p className="camera-empty">
        {source === "error"
          ? `카메라 목록을 불러오지 못했습니다. ${errorMessage}`
          : "불러오는 중..."}
      </p>
    );
  }

  if (cameras.length === 0) {
    return <p className="camera-empty">등록된 카메라가 없습니다.</p>;
  }

  return cameras.map((camera) => (
    <button
      key={camera.device_id}
      type="button"
      className="camera-popover-item"
      onClick={() => onSelect(camera.device_id)}
    >
      <span>{camera.name}</span>

      <span
        className={`camera-popover-status ${
          camera.status === "online" ? "online" : "offline"
        }`}
      >
        {camera.status}
      </span>
    </button>
  ));
}

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  const [isMonitoringPopoverOpen, setIsMonitoringPopoverOpen] =
    useState(false);

  const menuItems = [
    {
      path: "/dashboard",
      label: "대시보드",
    },
    {
      path: "/multiview",
      label: "다채널 멀티뷰",
    },
    {
      path: "/devices",
      label: "기기 관리",
    },
    {
      path: "/event-logs",
      label: "이벤트 로그",
    },
    {
      path: "/reports",
      label: "통계 및 리포트",
    },
    {
      path: "/vpn-manage",
      label: "VPN 연결 관리"
    },
    {
      path: "/settings",
      label: "설정",
    },
  ];

  const handleMonitoringClick = () => {
    setIsMonitoringPopoverOpen((prev) => !prev);
  };

  const handleCameraSelect = (cameraId) => {
    setIsMonitoringPopoverOpen(false);
    onClose();

    navigate(`/Monitoring/${cameraId}`);
  };

  const handleLogout = async () => {
    // 서버 세션을 먼저 끊는다. 요청이 실패해도 화면에서는 로그아웃한다
    try {
      await logout();
    } catch (error) {
      console.warn("로그아웃 요청 실패", error);
    }

    clearSession();

    setIsMonitoringPopoverOpen(false);
    onClose();

    navigate("/login", { replace: true });
  };

  return (
    <>
      {isOpen && (
        <div
          className="drawer-overlay"
          onClick={() => {
            setIsMonitoringPopoverOpen(false);
            onClose();
          }}
        />
      )}

      <aside
        className={`drawer-sidebar ${
          isOpen ? "drawer-open" : ""
        }`}
      >
        <div className="drawer-header">
          <strong>SECURE CAM</strong>

          <button
            type="button"
            className="drawer-close"
            onClick={() => {
              setIsMonitoringPopoverOpen(false);
              onClose();
            }}
            aria-label="메뉴 닫기"
          >
            ×
          </button>
        </div>

        <nav className="drawer-menu">
          <div className="monitoring-menu-wrapper">
            <button
              type="button"
              className={`drawer-link monitoring-menu-button ${
                isMonitoringPopoverOpen
                  ? "drawer-link-active"
                  : ""
              }`}
              onClick={handleMonitoringClick}
            >
              <span>실시간 모니터링</span>

              <span className="monitoring-arrow">
                {isMonitoringPopoverOpen ? "◀" : "▶"}
              </span>
            </button>

            {isMonitoringPopoverOpen && (
              <div className="camera-popover">
                <div className="camera-popover-header">
                  카메라 선택
                </div>

                <div className="camera-popover-list">
                  <CameraPopoverList onSelect={handleCameraSelect} />
                </div>
              </div>
            )}
          </div>

          {menuItems.map((menu) => (
            <NavLink
              key={menu.path}
              to={menu.path}
              onClick={() => {
                setIsMonitoringPopoverOpen(false);
                onClose();
              }}
              className={({ isActive }) =>
                isActive
                  ? "drawer-link drawer-link-active"
                  : "drawer-link"
              }
            >
              {menu.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="drawer-logout"
          onClick={handleLogout}
        >
          로그아웃
        </button>
      </aside>
    </>
  );
}

export default Sidebar;