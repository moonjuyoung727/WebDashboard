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
