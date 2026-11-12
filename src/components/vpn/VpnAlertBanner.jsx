import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { FiAlertTriangle, FiX } from "react-icons/fi";
import { useVpn } from "../../context/VpnContext";
import { VPN_CHECK_MESSAGE } from "../../api/client";
import { VPN_SERVER_IP } from "../../api/config";
import VpnGuideModal from "./VpnGuideModal";
import "./VpnAlertBanner.css";

// Client VPN 연결 이상 시 재연결 안내 (WEB-F-050)
// MainLayout 상단에 표시 — peerVpnStatus 가 error 일 때만 노출
// (서버가 VPN 미연결로 응답하거나, API 요청이 서버에 닿지 못했을 때)
// VPN 서버 연결 확인 화면(/vpn-check)은 화면 자체가 같은 안내를 보여 주므로 배너를 숨긴다
function VpnAlertBanner() {
  const location = useLocation();
  const { peerVpnStatus, checkClientVpn } = useVpn();

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  // 닫아 둔 배너도 연결이 회복됐다가 다시 끊기면 다시 보여 준다
  useEffect(() => {
    if (peerVpnStatus === "connected") {
      setIsHidden(false);
    }
  }, [peerVpnStatus]);

  if (
    peerVpnStatus !== "error" ||
    isHidden ||
    location.pathname === "/vpn-check"
  ) {
    return null;
  }

  async function handleRetry() {
    const connected = await checkClientVpn();

    if (connected) {
      setIsGuideOpen(false);
    }
  }

  return (
    <>
      <div className="vpn-alert-banner" role="alert">
        <FiAlertTriangle className="vpn-alert-icon" />

        <div className="vpn-alert-text">
          <strong>{VPN_CHECK_MESSAGE}</strong>
          <span>내부 서버({VPN_SERVER_IP})에 연결할 수 없어 실시간 영상 및 데이터가 갱신되지 않을 수 있습니다.</span>
        </div>

        <button type="button" className="btn small" onClick={() => setIsGuideOpen(true)}>
          재연결 안내
        </button>

        <button type="button" className="btn small primary" onClick={handleRetry}>
          다시 확인
        </button>

        <button
          type="button"
          className="vpn-alert-close"
          onClick={() => setIsHidden(true)}
          aria-label="안내 닫기"
        >
          <FiX />
        </button>
      </div>

      {isGuideOpen && (
        <VpnGuideModal
          onClose={() => setIsGuideOpen(false)}
          onRetry={handleRetry}
          isChecking={peerVpnStatus === "connecting"}
        />
      )}
    </>
  );
}

export default VpnAlertBanner;
