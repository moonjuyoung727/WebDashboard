export async function getEvents() {
  const response = await fetch("/api/events");

  if (!response.ok) {
    throw new Error("이벤트 조회 실패");
  }

  return response.json();
}


/* ===== 추가 예정 API — 서버 연결 후 주석 해제 ===== */

/* WEB-F-031 이벤트 처리 상태 변경
   status: unconfirmed | confirmed

export async function updateEventStatus(eventId, status) {
  const response = await fetch(`/api/events/${eventId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    throw new Error("이벤트 상태 변경 실패");
  }

  return response.json();
}
*/


/* WEB-F-033 이벤트 처리 상태 일괄 변경
   응답: { updatedIds: [], failedIds: [] }

export async function bulkUpdateEventStatus(eventIds, status) {
  const response = await fetch("/api/events/status", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ eventIds, status })
  });

  if (!response.ok) {
    throw new Error("이벤트 일괄 상태 변경 실패");
  }

  return response.json();
}
*/


/* WEB-F-032 이벤트 미디어(스냅샷/영상) 접근 정보 조회
   응답: { snapshot: { url, fileName }, video: { url, fileName, duration } }

export async function getEventMedia(eventId) {
  const response = await fetch(`/api/events/${eventId}/media`);

  if (!response.ok) {
    throw new Error("이벤트 미디어 조회 실패");
  }

  return response.json();
}
*/


/* WEB-F-032 이벤트 미디어 다운로드
   mediaType: snapshot | video
   응답: 파일(blob)

export async function downloadEventMedia(eventId, mediaType) {
  const response = await fetch(
    `/api/events/${eventId}/media/${mediaType}/download`
  );

  if (!response.ok) {
    throw new Error("이벤트 미디어 다운로드 실패");
  }

  return response.blob();
}
*/
