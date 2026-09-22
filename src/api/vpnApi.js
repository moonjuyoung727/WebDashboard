// 클라이언트 VPN 연결 여부 확인
export async function fetchClientVpnStatus() {

  /*  실제 서버 연동 시 사용
  const token = localStorage.getItem("accessToken");

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
  const token = localStorage.getItem("accessToken");

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
