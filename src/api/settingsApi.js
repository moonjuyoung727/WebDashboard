/* 일반 설정 */
export async function getGeneralSettings() {
  const response = await fetch("/api/general-settings");

  if (!response.ok) {
    throw new Error("일반 설정 정보 조회 실패");
  }

  return response.json();
}

export async function updateGeneralSetting(key, value) {
  const response = await fetch(`/api/general-settings/${key}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ value })
  });

  if (!response.ok) {
    throw new Error("설정 업데이트 실패");
  }
}


/* 알림 설정 */
export async function getNotificationSettings() {
  const response = await fetch("/api/notification-settings");

  if (!response.ok) {
    throw new Error("알림 설정 정보 조회 실패");
  }

  return response.json();
}

export async function updateNotificationSetting(key, enabled) {
  const response = await fetch(`/api/notification-settings/${key}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ enabled })
  });

  if (!response.ok) {
    throw new Error("설정 변경 실패");
  }
}


/* 구독 설정 */
export async function updateAutoRenew(enabled) {
  const response = await fetch("/api/subscriptions/auto-renew", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ enabled })
  });

  if (!response.ok) {
    throw new Error("자동 갱신 변경 실패");
  }
}


/* ===== 추가 예정 API — 서버 연결 후 주석 해제 ===== */

/* WEB-F-061 구독 정보 조회
   응답: { plan, status, paymentStatus, nextPaymentDate, autoRenew }

export async function getSubscription() {
  const response = await fetch("/api/subscriptions");

  if (!response.ok) {
    throw new Error("구독 정보 조회 실패");
  }

  return response.json();
}
*/


/* WEB-F-061 구독 플랜 변경

export async function changeSubscriptionPlan(planId) {
  const response = await fetch("/api/subscriptions/plan", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ planId })
  });

  if (!response.ok) {
    throw new Error("요금제 변경 실패");
  }

  return response.json();
}
*/


/* WEB-F-061 결제 수단 조회 / 등록 / 기본 결제 수단 변경 / 삭제
   카드 정보는 PG사 결제창(토큰화)으로 등록 — 프론트에서 카드 번호를 직접 전송하지 않음

export async function getPaymentMethods() {
  const response = await fetch("/api/payment-methods");

  if (!response.ok) {
    throw new Error("결제 수단 조회 실패");
  }

  return response.json();
}

export async function addPaymentMethod(billingKey) {
  const response = await fetch("/api/payment-methods", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ billingKey })
  });

  if (!response.ok) {
    throw new Error("결제 수단 등록 실패");
  }

  return response.json();
}

export async function setDefaultPaymentMethod(paymentMethodId) {
  const response = await fetch(`/api/payment-methods/${paymentMethodId}/default`, {
    method: "PATCH"
  });

  if (!response.ok) {
    throw new Error("기본 결제 수단 변경 실패");
  }
}

export async function deletePaymentMethod(paymentMethodId) {
  const response = await fetch(`/api/payment-methods/${paymentMethodId}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("결제 수단 삭제 실패");
  }
}
*/


/* WEB-F-063 저장소 설정 조회 / 변경
   응답: { autoSave, saveMode, quality, retentionDays, overwriteWhenFull,
           usage: { totalGb, usedGb, byType: [{ key, label, gb }] } }

export async function getStorageSettings() {
  const response = await fetch("/api/storage-settings");

  if (!response.ok) {
    throw new Error("저장소 설정 조회 실패");
  }

  return response.json();
}

export async function updateStorageSettings(settings) {
  const response = await fetch("/api/storage-settings", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(settings)
  });

  if (!response.ok) {
    throw new Error("저장소 설정 변경 실패");
  }

  return response.json();
}
*/
