import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchClientVpnStatus } from "../api/vpnApi";
import { VPN_SERVER_REACHABLE_EVENT, VPN_UNREACHABLE_EVENT } from "../api/client";
import { getAccessToken } from "../storage/authStorage";

const VpnContext = createContext(null);

// Client VPN이 끊긴 동안 연결 상태(GET /status)를 자동으로 다시 확인하는 간격
// 앞 확인이 끝난 뒤 이만큼 기다렸다가 다음 확인을 한다 (요청이 겹치지 않음)
const VPN_PROBE_MS = 10000;

export function VpnProvider({ children }) {
  // connecting | connected | disconnected | error
  const [ peerVpnStatus, setStatus ] = useState("disconnected");

  // Client VPN이 끊겼다고 판단된 상태 (error가 되면 true, connected가 되어야 false)
  // "다시 확인" 중(connecting)에도 끊긴 상태를 유지해서, 확인이 끝나기 전에 자동 재시도가 다시 돌지 않게 한다
  // true인 동안 영상 재연결 · 목록 재조회 같은 자동 재시도는 모두 멈춘다 (로그인처럼 사용자가 직접 하는 요청은 그대로)
  // 대신 연결 상태(GET /status)만 VPN_PROBE_MS마다 다시 확인해서, 연결되면 자동으로 false로 돌아온다
  const [ isVpnDown, setIsVpnDown ] = useState(false);

  const setPeerVpnStatus = useCallback((status) => {
    setStatus(status);

    if (status === "error") {
      setIsVpnDown(true);
    } else if (status === "connected") {
      setIsVpnDown(false);
    }
  }, []);

  // 서버에 클라이언트 VPN 연결 확인 후 결과를 공유 상태에 반영
  const checkClientVpn = useCallback(async () => {
    setPeerVpnStatus("connecting");

    try {
      const connected = await fetchClientVpnStatus();

      setPeerVpnStatus(connected ? "connected" : "error");

      return connected;
    } catch (error) {
      console.error("VPN 상태 확인 실패:", error);

      setPeerVpnStatus("error");

      return false;
    }
  }, [setPeerVpnStatus]);

  // 어떤 API 요청이든 서버에 닿지 못하면(네트워크 오류) VPN 안내 배너를 띄운다
  useEffect(() => {
    function handleUnreachable() {
      setPeerVpnStatus("error");
    }

    window.addEventListener(VPN_UNREACHABLE_EVENT, handleUnreachable);

    return () => {
      window.removeEventListener(VPN_UNREACHABLE_EVENT, handleUnreachable);
    };
  }, [setPeerVpnStatus]);

  // VPN이 끊긴 동안에는 다른 자동 재시도를 모두 멈추므로, 연결 상태만 주기적으로 다시 확인한다
  // - 연결이 확인되면 connected로 바꿔서 멈춰 둔 영상 · 목록 조회가 바로 다시 시작되게 한다
  // - 확인 중에도 status를 connecting으로 바꾸지 않는다 (VPN 안내 배너가 깜빡이지 않게)
  // - 로그인하지 않았거나 브라우저 탭이 숨겨져 있으면 건너뛰고, 탭이 다시 보이면 바로 확인한다
  // - 다른 요청(화면 첫 조회 · 사용자가 직접 한 요청)이 서버에서 응답을 받으면, 다음 차례를 기다리지 않고 바로 확인한다
  //   그 응답으로 connected를 정하지는 않는다. 연결 여부는 항상 /status 결과로만 정한다
  useEffect(() => {
    if (!isVpnDown) {
      return undefined;
    }

    let timer = null;
    let stopped = false;
    let probing = false;  // 확인 요청이 진행 중인지 (겹쳐 보내지 않는다)
    const controller = new AbortController();

    // /status를 한 번 확인한다. 아직 연결되지 않았거나 확인하지 못하면 false
    async function checkOnce() {
      if (!getAccessToken() || document.hidden) {
        return false;
      }

      try {
        return await fetchClientVpnStatus({ signal: controller.signal });
      } catch {
        // 아직 연결 안 됨 (서버에 닿지 못하면 apiFetch가 error 상태를 다시 알린다)
        return false;
      }
    }

    async function probe() {
      // 이미 확인 중이면 그 결과를 기다린다
      if (probing) {
        return;
      }

      probing = true;
      clearTimeout(timer);

      const connected = await checkOnce();

      probing = false;

      if (stopped) {
        return;
      }

      if (connected) {
        setPeerVpnStatus("connected");
        return;
      }

      timer = setTimeout(probe, VPN_PROBE_MS);
    }

    // 브라우저 탭이 다시 보이면 다음 차례를 기다리지 않고 바로 확인한다 (숨겨진 동안은 확인을 건너뛰므로)
    function handleVisibilityChange() {
      if (!document.hidden) {
        probe();
      }
    }

    timer = setTimeout(probe, VPN_PROBE_MS);
    window.addEventListener(VPN_SERVER_REACHABLE_EVENT, probe);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
      window.removeEventListener(VPN_SERVER_REACHABLE_EVENT, probe);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isVpnDown, setPeerVpnStatus]);

  return (
    <VpnContext.Provider
      value={{ peerVpnStatus, isVpnDown, setPeerVpnStatus, checkClientVpn }}
    >
      {children}
    </VpnContext.Provider>
  );
}

export function useVpn() {
  const context = useContext(VpnContext);

  if (!context) {
    throw new Error("useVpn은 VpnProvider 안에서만 사용할 수 있습니다.");
  }

  return context;
}
