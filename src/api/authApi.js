/**
 * 사용자 인증 및 계정 관리 REST API (Component 1, ICD 2.1, SV-F-001 ~ SV-F-008)
 */
import { apiClient, setAuthToken } from "./client";

/**
 * 로그인 (POST /auth/login, ICD 2.1.1, SV-F-001)
 * @param {string|Object} emailOrUserId - 이메일 또는 아이디 (객체로 전달 시 전체 payload)
 * @param {string} [password] - 비밀번호
 * @param {boolean} [autoLogin=false] - 자동 로그인 여부
 */
export async function login(emailOrUserId, password, autoLogin = false) {
  let payload;
  if (typeof emailOrUserId === "object" && emailOrUserId !== null) {
    payload = {
      email: emailOrUserId.email || emailOrUserId.userId,
      password: emailOrUserId.password,
      auto_login: Boolean(emailOrUserId.auto_login ?? emailOrUserId.autoLogin ?? false),
      device_name: emailOrUserId.device_name || emailOrUserId.deviceName || "Web Dashboard",
      device_type: "web",
    };
  } else {
    payload = {
      email: emailOrUserId,
      password,
      auto_login: Boolean(autoLogin),
      device_name: "Web Dashboard",
      device_type: "web",
    };
  }

  const response = await apiClient.post("/auth/login", payload);

  const token = response.access_token || response.token;
  if (token) {
    if (response.user_id) localStorage.setItem("userId", response.user_id);
    if (response.email) localStorage.setItem("userEmail", response.email);
    if (response.name) localStorage.setItem("userName", response.name);
  }

  return response;
}

/**
 * 회원가입 (POST /auth/register, ICD 2.1.3, SV-F-001, SV-F-007)
 */
export async function signup(userIdOrData, email, password, name) {
  let payload;
  if (typeof userIdOrData === "object" && userIdOrData !== null) {
    payload = {
      email: userIdOrData.email,
      password: userIdOrData.password,
      name: userIdOrData.name || userIdOrData.userId || "사용자",
      plan: userIdOrData.plan || "basic",
      verification_code: userIdOrData.verification_code || userIdOrData.verificationCode,
    };
  } else {
    payload = {
      email: email || userIdOrData,
      password,
      name: name || userIdOrData || "사용자",
      plan: "basic",
    };
  }

  return apiClient.post("/auth/register", payload);
}

/**
 * 아이디 중복 확인 (호환용)
 */
export async function checkUserId(emailOrUserId) {
  // 백엔드 중복 체크 또는 기본 응답
  return { available: true };
}

/**
 * 로그아웃 (POST /auth/logout, ICD 2.1.2)
 */
export async function logout() {
  try {
    await apiClient.post("/auth/logout", {});
  } finally {
    setAuthToken(null);
    localStorage.removeItem("userId");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
  }
}

/**
 * 현재 로그인 사용자 프로필 조회 (GET /auth/me)
 */
// silent: true면 실패해도 오류 토스트를 띄우지 않는다 (자동 재시도용)
// VPN이 끊겨 있으면 응답 없이 오래 걸려서 5초가 지나면 끊는다
export async function getMe({ silent = false } = {}) {
  return apiClient.get("/auth/me", { notify: !silent, timeoutMs: 5000 });
}

/**
 * 본인 인증 코드 발송 요청 (POST /auth/send-verification-code, SV-F-007)
 */
export async function sendVerificationCode(target, type = "signup") {
  return apiClient.post("/auth/send-verification-code", {
    target,
    type,
  });
}

/**
 * 본인 인증 코드 검증 (POST /auth/verify-code, SV-F-007)
 */
export async function verifyCode(target, code, type = "signup") {
  return apiClient.post("/auth/verify-code", {
    target,
    code,
    type,
  });
}

/**
 * 이메일(아이디) 찾기 (POST /auth/find-id, SV-F-002, ICD 2.1.4)
 * 응답: { email } - 마스킹 처리된 이메일
 */
export async function findEmail(name, phoneNumber, verificationCode) {
  return apiClient.post("/auth/find-id", {
    name,
    phone_number: phoneNumber,
    verification_code: verificationCode,
  });
}

/**
 * 비밀번호 찾기(인증코드 요청) (POST /auth/forgot-password, SV-F-002)
 */
export async function forgotPassword(email) {
  return apiClient.post("/auth/forgot-password", { email });
}

/**
 * 비밀번호 재설정 실행 (POST /auth/reset-password, SV-F-002, ICD 2.1.5)
 */
export async function resetPassword({ email, verificationCode, newPassword, resetToken }) {
  return apiClient.post("/auth/reset-password", {
    email,
    verification_code: verificationCode,
    reset_token: resetToken,
    new_password: newPassword,
  });
}

export const authApi = {
  login,
  signup,
  logout,
  getMe,
  checkUserId,
  sendVerificationCode,
  verifyCode,
  findEmail,
  forgotPassword,
  resetPassword,
};

export default authApi;


/* ===== 추가 예정 API — 화면 연결 시 주석 해제 ===== */

/* 2.1.6.1 로그인 기기 목록 조회
   응답: [{ session_id, client_name, ip_address, last_active_at, is_current }]

export async function getSessions() {
  const response = await apiFetch(`/auth/sessions`);

  if (!response.ok) {
    throw await toApiError(response, "로그인 기기 목록 조회에 실패했습니다.");
  }

  return response.json();
}
*/


/* 2.1.6.2 단일 기기 강제 로그아웃
   응답: { message }

export async function revokeSession(sessionId) {
  const response = await apiFetch(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE"
  });

  // 404 SESSION_NOT_FOUND: 존재하지 않거나 이미 만료된 세션
  if (response.status === 404) {
    throw await toApiError(response, "이미 로그아웃된 기기입니다.");
  }

  if (!response.ok) {
    throw await toApiError(response, "기기 로그아웃에 실패했습니다.");
  }

  return response.json();
}
*/


/* 2.1.6.3 현재 기기를 제외한 다른 모든 기기 일괄 로그아웃
   응답: { revoked_count }

export async function revokeOtherSessions() {
  const response = await apiFetch(`/auth/sessions/other`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw await toApiError(response, "다른 기기 로그아웃에 실패했습니다.");
  }

  return response.json();
}
*/


/* 2.1.7 회원 탈퇴
   응답: { message }

export async function deleteAccount(password, reason) {
  const response = await apiFetch(`/auth/account`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password, reason })
  });

  // 400 INVALID_PASSWORD: 비밀번호 불일치
  if (response.status === 400) {
    throw await toApiError(response, "비밀번호가 올바르지 않습니다.");
  }

  if (!response.ok) {
    throw await toApiError(response, "회원 탈퇴 처리에 실패했습니다.");
  }

  return response.json();
}
*/
