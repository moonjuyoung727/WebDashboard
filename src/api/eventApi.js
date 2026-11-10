import { apiFetch, toApiError } from "./client.js";

const LIST_TIMEOUT_MS = 5000;
const EVENT_PAGE_SIZE = 100;

// 서버 응답(snake_case)을 이벤트 로그 화면에서 쓰는 모양으로 바꾼다
function toEvent(item) {
  return {
    id: item.event_id,
    occurredAt: item.occurred_at || item.event_time || item.created_at,
    cameraId: item.mac || item.device_id,
    cameraName: item.device_name ?? "",
    location: item.location ?? "",
    type: item.event_type,  // motion / sound / connection / system
    status: item.status,    // unconfirmed / confirmed
    snapshotUrl: item.snapshot_url ?? null,
    videoUrl: item.clip_url ?? null,
    soundLevelDb: item.sound_level_db ?? null,
    zoneId: item.zone_id ?? null,
    memo: item.memo || "",
    description: item.detail || item.description || ""
  };
}

// 2.3.1 이벤트 목록 조회 (페이지네이션)
// filters: { page, size, startDate, endDate (YYYY-MM-DD), mac, eventType, status } 모두 선택
// 응답: { total, page, size, items: [이벤트] }
// silent: true면 실패해도 오류 토스트를 띄우지 않는다 (자동 재조회용)
export async function getEvents({
  page,
  size,
  startDate,
  endDate,
  mac,
  eventType,
  status,
  silent = false
} = {}) {
  const query = {
    page,
    size,
    start_date: startDate,
    end_date: endDate,
    mac,
    event_type: eventType,
    status
  };

  // 값이 없는 조건은 쿼리에서 뺀다
  const params = new URLSearchParams(
    Object.entries(query).filter(([, value]) => value != null && value !== "")
  );
  const queryString = params.toString();

  // VPN이 끊겨 있으면 응답 없이 오래 걸려서 일정 시간이 지나면 끊는다 (cameraApi getCameras와 동일)
  const response = await apiFetch(`/events${queryString ? `?${queryString}` : ""}`, {
    signal: AbortSignal.timeout(LIST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw await toApiError(response, "이벤트 조회에 실패했습니다.", { notify: !silent });
  }

  const data = await response.json();
  const items = (data.items ?? []).map(toEvent);

  return {
    total: data.total ?? items.length,
    page: data.page,
    size: data.size,
    items
  };
}

// 조건에 맞는 이벤트 전체를 페이지를 넘겨 가며 모은다 (화면 쪽에서 필터 · 페이지 처리)
export async function getAllEvents(filters = {}) {
  const items = [];

  for (let page = 1; ; page += 1) {
    const result = await getEvents({ ...filters, page, size: EVENT_PAGE_SIZE });

    items.push(...result.items);

    if (result.items.length === 0 || items.length >= result.total) {
      return items;
    }
  }
}


// 2.3.2 이벤트 상태 처리 (WEB-F-031)
// changes: { status: "confirmed", isImportant, memo (최대 500자) } 중 바꿀 항목만
export async function updateEvent(eventId, { status, isImportant, memo }) {
  const response = await apiFetch(`/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status,
      is_important: isImportant,
      memo
    })
  });

  if (!response.ok) {
    throw await toApiError(response, "이벤트 상태 변경 실패");
  }
}


// WEB-F-033 이벤트 처리 상태 일괄 변경
// 명세에 일괄 변경 API가 없어서 2.3.2를 이벤트마다 호출한다
// 응답: { updatedIds: [], failedIds: [] }
export async function bulkUpdateEventStatus(eventIds, status) {
  const results = await Promise.allSettled(
    eventIds.map((eventId) => updateEvent(eventId, { status }))
  );

  return {
    updatedIds: eventIds.filter((_, index) => results[index].status === "fulfilled"),
    failedIds: eventIds.filter((_, index) => results[index].status === "rejected")
  };
}


/* ===== 추가 예정 API — 서버 연결 후 주석 해제 ===== */

/* WEB-F-032 이벤트 미디어(스냅샷/영상) 접근 정보 조회 [명세 없음]
   2.3.1 목록 응답의 snapshot_url / clip_url(→ snapshotUrl / videoUrl)로 대신할 수 있다
   응답: { snapshot: { url, fileName }, video: { url, fileName, duration } }

export async function getEventMedia(eventId) {
  const response = await apiFetch(`/events/${eventId}/media`);

  if (!response.ok) {
    throw await toApiError(response, "이벤트 미디어 조회 실패");
  }

  return response.json();
}
*/


/* WEB-F-032 이벤트 미디어 다운로드 [명세 없음]
   mediaType: snapshot | video
   응답: 파일(blob)

export async function downloadEventMedia(eventId, mediaType) {
  const response = await apiFetch(
    `/events/${eventId}/media/${mediaType}/download`
  );

  if (!response.ok) {
    throw await toApiError(response, "이벤트 미디어 다운로드 실패");
  }

  return response.blob();
}
*/

export const eventApi = { getEvents, updateEvent, bulkUpdateEventStatus };
export default eventApi;
