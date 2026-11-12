import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { FiHelpCircle, FiRefreshCw, FiShield } from "react-icons/fi";
import { fetchClientVpnStatus } from "../api/vpnApi";
import { getAuthToken, setAuthToken } from "../api/client";
import { useVpn } from "../context/VpnContext";
import VpnGuideModal from "../components/vpn/VpnGuideModal";
import "../components/Modal.css";
import "./VpnCheck.css";

function VpnCheck() {
  const navigate = useNavigate();
  const { setPeerVpnStatus } = useVpn();
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const requestController = useRef(null);
  const redirectTimer = useRef(null);
  const check = useCallback(async () => {
    requestController.current?.abort();
    clearTimeout(redirectTimer.current);
    const controller = new AbortController();
    requestController.current = controller;
    if (!getAuthToken()) {
      navigate("/login", { replace: true });
      return;
    }
    setStatus("checking");
    const fail = (text) => {
      setStatus("fail");
      setPeerVpnStatus("error");
      setMessage(text);
    };
    try {
      // GET /v1/status: 요청이 클라이언트 VPN 대역(10.0.2.x)을 거쳐 왔는지 서버가 판단한다
      const connected = await fetchClientVpnStatus({ signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!connected) {
        fail(
          "VPN 대역을 거치지 않은 요청입니다. WireGuard 앱에서 클라이언트 VPN을 연결한 후 다시 확인해주세요.",
        );
        return;
      }
      setStatus("success");
      setPeerVpnStatus("connected");
      setMessage("VPN 서버에 접근할 수 있습니다. 대시보드로 이동합니다.");
      redirectTimer.current = setTimeout(
        () => navigate("/dashboard", { replace: true }),
        1200,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error.status === 401) {
        setAuthToken(null);
        navigate("/login", { replace: true });
        return;
      }
      fail(
        "VPN 서버에 접근하지 못했습니다. WireGuard 앱에서 VPN을 연결한 후 다시 확인해주세요.",
      );
    }
  }, [navigate, setPeerVpnStatus]);
  useEffect(() => {
    check();
    return () => {
      requestController.current?.abort();
      clearTimeout(redirectTimer.current);
    };
  }, [check]);
  return (
    <main className="vpn-check-page">
      <div className="vpn-check-box">
        {status === "checking" ? (
          <div className="vpn-loader" />
        ) : status === "success" ? (
          <FaCheckCircle className="vpn-success-icon" />
        ) : (
          <FaTimesCircle className="vpn-fail-icon" />
        )}
        <h1>VPN 서버 연결 확인</h1>
        <p
          className={`vpn-message ${status}`}
          role={status === "fail" ? "alert" : "status"}
        >
          {status === "checking"
            ? "VPN 서버 응답을 확인하고 있습니다..."
            : message}
        </p>
        {status === "fail" && (
          <div className="vpn-check-actions">
            <button type="button" className="btn" onClick={() => setIsGuideOpen(true)}>
              <FiHelpCircle />
              재연결 안내
            </button>
            <button type="button" className="btn" onClick={() => navigate("/vpn-manage")}>
              <FiShield />
              VPN 관리로 이동
            </button>
            <button type="button" className="btn primary" onClick={check}>
              <FiRefreshCw />
              다시 확인
            </button>
          </div>
        )}
      </div>

      {isGuideOpen && (
        <VpnGuideModal
          onClose={() => setIsGuideOpen(false)}
          onRetry={() => {
            setIsGuideOpen(false);
            check();
          }}
        />
      )}
    </main>
  );
}
export default VpnCheck;
