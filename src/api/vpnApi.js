import { getAccessToken } from "../storage/authStorage";

// 클라이언트 VPN 연결 여부 확인
export async function fetchClientVpnStatus() {

  /*  실제 서버 연동 시 사용
  const token = getAccessToken();

  const response = await fetch("/api/status", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("VPN_STATUS_FAILED");
  }

  const data = await response.json();

  return data.connected;
  */

  const vpnConnected = true;  /* 임시 테스트용 */

  return vpnConnected;
}

// 클라이언트 VPN 연결 요청
export async function connectClientVpn() {
  const token = getAccessToken();

  const response = await fetch("/api/vpn/connect", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("VPN 연결 실패");
  }

  return response.json();
}

// 카메라 보드 VPN 장치 목록 조회
export async function getVpnDevices() {
  const response = await fetch("/api/vpn/devices");

  if (!response.ok) {
    throw new Error("VPN 장치 목록 조회 실패");
  }

  return response.json();
}


/* ===== 추가 예정 API — 서버 연결 후 주석 해제 ===== */

/* WEB-F-051 Device VPN 상태 요약
   응답: { connected, disconnected, error }

export async function getVpnSummary() {
  const response = await fetch("/api/vpn/devices/summary");

  if (!response.ok) {
    throw new Error("VPN 상태 요약 조회 실패");
  }

  return response.json();
}
*/


/* WEB-F-053 Device VPN 복구 요청
   응답: { result, vpnStatus }

export async function requestVpnRecovery(deviceId) {
  const response = await fetch(`/api/vpn/devices/${deviceId}/recover`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("VPN 복구 요청 실패");
  }

  return response.json();
}
*/


/* WEB-F-054 Device VPN 상세 정보
   응답: { deviceId, lastHandshake, vpnIp, connectedDuration, server,
           error: { code, message, occurredAt } | null, history: [{ at, status, message }] }

export async function getVpnDeviceDetail(deviceId) {
  const response = await fetch(`/api/vpn/devices/${deviceId}`);

  if (!response.ok) {
    throw new Error("VPN 상세 정보 조회 실패");
  }

  return response.json();
}
*/
