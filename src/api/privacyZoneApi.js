import { apiFetch, toApiError } from "./client";

/*
  프라이버시 존 API (ICD 2.6 / WEB-F-024, WEB-F-064)

  화면 zone: { id, name, x, y, width, height, enabled, color }
  서버 zone: { zone_id, zone_name, is_active, color, coordinates: { x1, y1, x2, y2 } }
  좌표는 모두 영상 크기 대비 비율 (0 ~ 1). 보드 1개당 최대 20개
*/

const READ_TIMEOUT_MS = 5000;

/* 서버 ↔ 화면 모양 변환 */

function toZone(item) {
  const { x1 = 0, y1 = 0, x2 = 0, y2 = 0 } = item.coordinates ?? {};

  return {
    id: item.zone_id,
    name: item.zone_name ?? "",
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    enabled: Boolean(item.is_active),
    color: item.color ?? null
  };
}

function toZoneBody(zone) {
  return {
    zone_name: zone.name,
    is_active: zone.enabled,
    ...(zone.color && { color: zone.color }),
    coordinates: {
      x1: zone.x,
      y1: zone.y,
      x2: zone.x + zone.width,
      y2: zone.y + zone.height
    }
  };
}

function zonePath(mac, zoneId = "") {
  return `/devices/${encodeURIComponent(mac)}/privacy-zones${zoneId && `/${encodeURIComponent(zoneId)}`}`;
}

async function sendZoneRequest(path, method, body, fallbackMessage) {
  const response = await apiFetch(path, {
    method,
    ...(body !== undefined && {
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    })
  });

  if (!response.ok) {
    throw await toApiError(response, fallbackMessage);
  }
}


// 2.6.1 보드별 프라이버시 존 목록 조회
// silent: true면 실패해도 오류 토스트를 띄우지 않는다 (자동 재시도용)
export async function getPrivacyZones(mac, { silent = false } = {}) {
  const response = await apiFetch(zonePath(mac), { timeoutMs: READ_TIMEOUT_MS });

  if (!response.ok) {
    throw await toApiError(response, "프라이버시 존 조회에 실패했습니다.", { notify: !silent });
  }

  const data = await response.json();
  const list = Array.isArray(data) ? data : data?.zones ?? data?.items ?? [];

  return list.map(toZone);
}

// 2.6.2 프라이버시 존 추가
export async function addPrivacyZone(mac, zone) {
  await sendZoneRequest(zonePath(mac), "POST", toZoneBody(zone), "프라이버시 존 추가에 실패했습니다.");
}

// 2.6.3 프라이버시 존 수정
export async function updatePrivacyZone(mac, zone) {
  await sendZoneRequest(zonePath(mac, zone.id), "PATCH", toZoneBody(zone), "프라이버시 존 수정에 실패했습니다.");
}

// 2.6.3 프라이버시 존 다중 삭제
export async function deletePrivacyZones(mac, zoneIds) {
  await sendZoneRequest(zonePath(mac), "DELETE", { zone_ids: zoneIds }, "프라이버시 존 삭제에 실패했습니다.");
}

/* 보드별 프라이버시 존 일괄 저장 (추가 · 수정 · 삭제 반영)
   명세에 일괄 저장 API가 없어서, 서버 목록과 비교해 2.6.2 / 2.6.3을 나눠 호출한다
   저장이 끝나면 서버 목록을 다시 받아 돌려준다 */
export async function savePrivacyZones(mac, zones) {
  const serverZones = await getPrivacyZones(mac);
  const serverById = new Map(serverZones.map((zone) => [zone.id, zone]));
  const keptIds = new Set(zones.map((zone) => zone.id));

  const removedIds = serverZones
    .filter((zone) => !keptIds.has(zone.id))
    .map((zone) => zone.id);

  if (removedIds.length > 0) {
    await deletePrivacyZones(mac, removedIds);
  }

  for (const zone of zones) {
    const serverZone = serverById.get(zone.id);

    if (!serverZone) {
      await addPrivacyZone(mac, zone);
    } else if (JSON.stringify(toZoneBody(zone)) !== JSON.stringify(toZoneBody(serverZone))) {
      await updatePrivacyZone(mac, zone);
    }
  }

  return getPrivacyZones(mac);
}
