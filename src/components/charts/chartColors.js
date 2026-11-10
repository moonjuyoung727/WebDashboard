// 차트 공통 색상
// 다크 배경(#2b2e34) 기준으로 색각이상(CVD) · 대비 검증을 통과한 순서 — 순서를 바꾸지 말 것

export const CATEGORY_COLORS = [
  "#6B85B3", 
  "#A77BC7", 
  "#63BFA3", 
  "#B8CC63", 
  "#E08A6B", 
  "#8F9AA8", 
];

// 이벤트 유형 → 색상 (필터로 유형 수가 바뀌어도 색은 유형을 따라감)
export const EVENT_TYPE_META = {
  motion: { label: "움직임 감지", color: CATEGORY_COLORS[0] },
  sound: { label: "소리 감지", color: CATEGORY_COLORS[1] },
  camera_connect: { label: "카메라 연결", color: CATEGORY_COLORS[2] },
  camera_disconnect: { label: "카메라 연결 끊김", color: CATEGORY_COLORS[3] },
  vpn_connect: { label: "VPN 연결", color: CATEGORY_COLORS[4] },
  vpn_disconnect: { label: "VPN 연결 끊김", color: CATEGORY_COLORS[5] },
  // ICD 2.3.1 event_type
  connection: { label: "연결 상태", color: CATEGORY_COLORS[2] },
  system: { label: "시스템", color: CATEGORY_COLORS[5] },
};

// ICD 2.3.1 event_type 전체 (필터 · 유형별 통계의 기본 항목)
export const EVENT_TYPES = ["motion", "sound", "connection", "system"];

// 명세에 없는 유형이 와도 화면이 깨지지 않게 받은 값을 그대로 이름으로 쓴다
export function getEventTypeMeta(type) {
  return EVENT_TYPE_META[type] ?? { label: type, color: CATEGORY_COLORS[5] };
}

// 상태 색상은 index.css 토큰 사용 (항상 라벨과 함께 표시)
export const VPN_STATUS_META = {
  connected: { label: "정상", color: "var(--success)" },
  disconnected: { label: "연결 끊김", color: "var(--text-muted)" },
  error: { label: "오류", color: "var(--danger)" },
};

// 단일 계열 차트 색상
export const SERIES_COLOR = "var(--accent)";
