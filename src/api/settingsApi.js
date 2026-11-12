import { apiFetch, toApiError } from "./client";

// 설정 조회 공통: VPN이 끊겨 있으면 응답 없이 오래 걸려서 5초가 지나면 끊는다
// (시간 초과는 NetworkError → "서버에 접근할 수 없습니다. VPN 연결을 확인하세요.")
// silent: true면 실패해도 오류 토스트를 띄우지 않는다 (useServerResource의 자동 재시도용)
const READ_TIMEOUT_MS = 5000;

async function getJson(path, fallbackMessage, { silent = false } = {}) {
  const response = await apiFetch(path, { timeoutMs: READ_TIMEOUT_MS });

  if (!response.ok) {
    throw await toApiError(response, fallbackMessage, { notify: !silent });
  }

  return response.json();
}

async function sendJson(path, method, body, fallbackMessage) {
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

  // 응답 본문이 없을 수도 있다
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}


/* 일반 설정 [명세 없음]
   응답: { autoRefresh, showOfflineBoards, defaultChannel } */
export async function getGeneralSettings(options) {
  return getJson(`/general-settings`, "일반 설정 조회에 실패했습니다.", options);
}

export async function updateGeneralSetting(key, value) {
  await sendJson(`/general-settings/${encodeURIComponent(key)}`, "PATCH", { value }, "일반 설정 변경에 실패했습니다.");
}


/* 알림 설정 (ICD 2.7) */

// 서버 응답(snake_case)을 알림 설정 화면에서 쓰는 모양으로 바꾼다
function toNotificationSettings(data) {
  return {
    motion: Boolean(data.motion_alert),
    sound: Boolean(data.sound_alert),
    offline: Boolean(data.offline_alert),
    reconnect: Boolean(data.reconnect_alert),
    importantOnly: Boolean(data.important_only),
    deviceAlerts: (data.device_alerts ?? []).map((item) => ({
      mac: item.mac,
      enabled: item.enabled
    }))
  };
}

// 2.7.1 알림 설정 조회
export async function getNotificationSettings(options) {
  return toNotificationSettings(
    await getJson(`/notifications/settings`, "알림 설정 조회에 실패했습니다.", options)
  );
}

// 2.7.2 알림 설정 수정 — 항목별 수정이 없어서 전체 설정을 한 번에 저장한다
export async function updateNotificationSettings(settings) {
  await sendJson(
    `/notifications/settings`,
    "PUT",
    {
      motion_alert: settings.motion,
      sound_alert: settings.sound,
      offline_alert: settings.offline,
      reconnect_alert: settings.reconnect,
      important_only: settings.importantOnly,
      device_alerts: (settings.deviceAlerts ?? []).map((item) => ({
        mac: item.mac,
        enabled: item.enabled
      }))
    },
    "알림 설정 변경에 실패했습니다."
  );
}


/* ===== 구독 · 결제 수단 (WEB-F-061) [명세 없음] ===== */

/* 구독 정보 조회
   응답: { plan, status, nextPaymentDate, autoRenew }
   plan: 요금제 이름 (예: "Standard"), status: active | expired */
export async function getSubscription(options) {
  return getJson(`/subscriptions`, "구독 정보 조회에 실패했습니다.", options);
}

/* 요금제 목록 조회
   응답: [{ id, name, price, features: [] }] */
export async function getSubscriptionPlans(options) {
  const data = await getJson(`/subscriptions/plans`, "요금제 목록 조회에 실패했습니다.", options);

  return Array.isArray(data) ? data : data?.plans ?? [];
}

// 요금제 변경
export async function changeSubscriptionPlan(planId) {
  return sendJson(`/subscriptions/plan`, "PATCH", { planId }, "요금제 변경에 실패했습니다.");
}

// 자동 갱신 변경
export async function updateAutoRenew(enabled) {
  await sendJson(`/subscriptions/auto-renew`, "PATCH", { enabled }, "자동 갱신 변경에 실패했습니다.");
}

/* 결제 수단 조회
   카드 정보는 PG사 결제창(토큰화)으로 등록 — 프론트에서 카드 번호를 직접 보내지 않는다
   응답: [{ id, brand, last4, expiry, isDefault }] */
export async function getPaymentMethods(options) {
  const data = await getJson(`/payment-methods`, "결제 수단 조회에 실패했습니다.", options);

  return Array.isArray(data) ? data : data?.items ?? [];
}

// 결제 수단 등록 (PG 결제창이 돌려준 빌링키)
export async function addPaymentMethod(billingKey) {
  return sendJson(`/payment-methods`, "POST", { billingKey }, "결제 수단 등록에 실패했습니다.");
}

export async function setDefaultPaymentMethod(paymentMethodId) {
  await sendJson(
    `/payment-methods/${encodeURIComponent(paymentMethodId)}/default`,
    "PATCH",
    undefined,
    "기본 결제 수단 변경에 실패했습니다."
  );
}

export async function deletePaymentMethod(paymentMethodId) {
  await sendJson(
    `/payment-methods/${encodeURIComponent(paymentMethodId)}`,
    "DELETE",
    undefined,
    "결제 수단 삭제에 실패했습니다."
  );
}


// WEB-F-063 저장소 설정 조회 / 변경 (ICD 2.4.3)
// 화면 화질 low / medium / high ↔ 서버 video_quality SD / HD / FHD
// 응답: { autoSave, quality, retentionDays, usage: { totalGb, usedGb } }

const QUALITY_TO_SERVER = { low: "SD", medium: "HD", high: "FHD" };
const QUALITY_FROM_SERVER = { SD: "low", HD: "medium", FHD: "high" };

// 2.4.3.1 저장소 설정 및 사용량 조회
export async function getStorageSettings(options) {
  const data = await getJson(`/storage/settings`, "저장소 설정 조회에 실패했습니다.", options);

  return {
    autoSave: data.auto_save_enabled,
    quality: QUALITY_FROM_SERVER[data.video_quality] ?? "high",
    retentionDays: data.retention_days,
    usage: {
      totalGb: data.storage_total_gb ?? 0,
      usedGb: data.storage_used_gb ?? 0
    }
  };
}

// 2.4.3.2 저장소 설정 수정. 응답 본문이 명세에 없어서 저장 후 다시 조회해 돌려준다
export async function updateStorageSettings({ autoSave, quality, retentionDays }) {
  await sendJson(
    `/storage/settings`,
    "PUT",
    {
      auto_save_enabled: autoSave,
      retention_days: retentionDays,
      video_quality: QUALITY_TO_SERVER[quality]
    },
    "저장소 설정 변경에 실패했습니다."
  );

  return getStorageSettings();
}
