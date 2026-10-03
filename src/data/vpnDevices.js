// VPN 연결 관리 화면 목업 (서버 연결 전 시연용)
// 대시보드 · 통계 · 멀티뷰와 같은 Device VPN 목록(getDeviceVpnList)에서 만들어서
// 기기 수와 연결 상태(정상 / 연결 끊김 / 오류)가 모든 화면에서 같도록 함

import { cameras } from "./cameras";
import { getDeviceVpnList } from "./statisticsMock";

const VPN_SERVER = "vpn.securecam.com";

// 기기별 자동 연결 설정 (지정하지 않은 기기는 모두 켜짐)
const AUTO_CONNECT_OVERRIDES = {
  3: { startAutoConnect: false },
  4: { reconnectOnNetworkChange: false },
};

export const initialVpnDevices = getDeviceVpnList().map((device) => {
  const camera = cameras.find((item) => item.id === device.cameraId) ?? {};
  const isConnected = device.vpnStatus === "connected";

  return {
    id: device.cameraId,
    name: device.cameraName,
    serial: camera.hwnum ?? "-",
    vpnStatus: device.vpnStatus,
    duration: isConnected ? camera.uptime ?? "-" : "-",
    server: VPN_SERVER,
    vpnIp: isConnected ? camera.ip ?? "-" : "-",
    // 오류 기기는 마지막으로 성공한 Handshake 시간을 남김
    lastHandshake:
      device.vpnStatus === "disconnected"
        ? "-"
        : camera.lastConnectedAt?.slice(0, 16) ?? "-",
    error: device.error,
    autoConnect: true,
    startAutoConnect: true,
    reconnectOnNetworkChange: true,
    ...AUTO_CONNECT_OVERRIDES[device.cameraId],
  };
});
