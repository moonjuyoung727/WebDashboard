/*
  프라이버시 존 API (WEB-F-024, WEB-F-064) — 서버 연결 후 주석 해제
  현재는 data/privacyZoneStore.js 목업 저장소 사용

  zone: { id, name, x, y, width, height, enabled }
  좌표(x, y, width, height)는 영상 크기 대비 비율 (0 ~ 1)
*/

/* 카메라별 프라이버시 존 조회

export async function getPrivacyZones(cameraId) {
  const response = await fetch(`/api/cameras/${cameraId}/privacy-zones`);

  if (!response.ok) {
    throw new Error("프라이버시 존 조회 실패");
  }

  return response.json();
}
*/


/* 카메라별 프라이버시 존 일괄 저장 (추가 · 수정 · 삭제 반영)
   서버는 보드로 설정 전달 [S → B] 후 적용 결과 [B → S]를 받아 응답
   응답: { applied: boolean, zones: [...] }

export async function savePrivacyZones(cameraId, zones) {
  const response = await fetch(`/api/cameras/${cameraId}/privacy-zones`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ zones })
  });

  if (!response.ok) {
    throw new Error("프라이버시 존 저장 실패");
  }

  return response.json();
}
*/


/* 프라이버시 존 단건 삭제

export async function deletePrivacyZone(cameraId, zoneId) {
  const response = await fetch(
    `/api/cameras/${cameraId}/privacy-zones/${zoneId}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw new Error("프라이버시 존 삭제 실패");
  }
}
*/
