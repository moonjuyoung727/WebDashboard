/*
  대시보드 (홈) API — 서버 연결 후 주석 해제
  현재 Dashboard.jsx는 data/statisticsMock.js 목업 데이터 사용
*/

/* WEB-F-001 대시보드 요약 정보
   응답: { totalCameras, onlineCameras, offlineCameras, todayEvents, unreadAlerts }

export async function getDashboardSummary() {
  const response = await fetch("/api/dashboard/summary");

  if (!response.ok) {
    throw new Error("대시보드 요약 정보 조회 실패");
  }

  return response.json();
}
*/


/* WEB-F-002 최근 이벤트
   응답: [{ eventId, occurredAt, cameraId, cameraName, type, status }]

export async function getRecentEvents(limit = 5) {
  const response = await fetch(`/api/dashboard/recent-events?limit=${limit}`);

  if (!response.ok) {
    throw new Error("최근 이벤트 조회 실패");
  }

  return response.json();
}
*/


/* WEB-F-002 이벤트 유형별 통계
   period: today | week | month
   응답: [{ type, count, ratio }]

export async function getEventTypeStats(period = "today") {
  const response = await fetch(
    `/api/dashboard/event-type-stats?period=${encodeURIComponent(period)}`
  );

  if (!response.ok) {
    throw new Error("이벤트 유형별 통계 조회 실패");
  }

  return response.json();
}
*/


/* WEB-F-003 Device VPN 상태 목록
   응답: [{ cameraId, cameraName, vpnStatus }]  vpnStatus: connected | disconnected | error

export async function getDeviceVpnStatusList() {
  const response = await fetch("/api/dashboard/device-vpn");

  if (!response.ok) {
    throw new Error("Device VPN 상태 조회 실패");
  }

  return response.json();
}
*/


/* WEB-F-004 / WEB-F-050 / WEB-F-074 Client VPN 내부 서버 연결 확인
   → api/vpnApi.js 의 fetchClientVpnStatus() 사용 (VpnContext.checkClientVpn)
*/
