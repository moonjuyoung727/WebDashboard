import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiX } from "react-icons/fi";
import { useVpn } from "../../context/VpnContext";
import Modal from "../Modal";
import "../Modal.css";
import "./VpnAlertBanner.css";

// Client VPN 연결 이상 시 재연결 안내 (WEB-F-050)
// MainLayout 상단에 표시 — peerVpnStatus 가 error 일 때만 노출
function VpnAlertBanner() {
  const navigate = useNavigate();
  const { peerVpnStatus, checkClientVpn } = useVpn();

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  if (peerVpnStatus !== "error" || isHidden) {
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
          <strong>VPN 연결이 끊어졌습니다.</strong>
          <span>내부 서버에 연결할 수 없어 실시간 영상 및 데이터가 갱신되지 않을 수 있습니다.</span>
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
        <Modal
          title="VPN 재연결 안내"
          onClose={() => setIsGuideOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setIsGuideOpen(false);
                  navigate("/vpn-manage");
                }}
              >
                VPN 연결 관리
              </button>
              <button type="button" className="btn primary" onClick={handleRetry}>
                연결 다시 확인
              </button>
            </>
          }
        >
          <ol className="vpn-guide-steps">
            <li>
              <strong>VPN 클라이언트 실행 확인</strong>
              <p>PC에 설치된 WireGuard(VPN) 클라이언트가 실행 중인지 확인하세요.</p>
            </li>
            <li>
              <strong>터널 활성화</strong>
              <p>SECURE CAM 터널을 선택하고 [활성화] 버튼을 눌러 연결하세요.</p>
            </li>
            <li>
              <strong>네트워크 확인</strong>
              <p>인터넷 연결이 정상인지, 회사/공용 네트워크에서 VPN 포트가 차단되지 않았는지 확인하세요.</p>
            </li>
            <li>
              <strong>연결 다시 확인</strong>
              <p>아래 [연결 다시 확인] 버튼을 눌러 내부 서버 연결을 재확인하세요.</p>
            </li>
          </ol>

          {peerVpnStatus === "connecting" && (
            <p className="vpn-guide-status">연결 상태를 확인하는 중...</p>
          )}
        </Modal>
      )}
    </>
  );
}

export default VpnAlertBanner;
