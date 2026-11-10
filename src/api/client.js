// 모든 API 요청이 거쳐 가는 fetch 래퍼
// - 베이스 URL을 붙이고, 로그인한 상태면 Authorization: Bearer {access_token} 헤더를 넣는다
// - 401이면 토큰을 지우고 로그인 화면으로 보낸다
// - 서버 오류 응답은 ApiError로 바꿔 message를 화면에 띄운다
// - 서버에 아예 닿지 못하면(네트워크 오류) NetworkError를 던지고 "VPN 연결을 확인하세요" 안내를 띄운다

import { API_BASE_URL } from "./config";
import {
  getAccessToken,
  clearSession,
  saveLoginNotice
} from "../storage/authStorage";

// MainLayout의 오류 토스트가 이 이벤트를 듣고 message를 보여 준다
export const API_ERROR_EVENT = "api-error";

// VpnContext가 이 이벤트를 듣고 VPN 안내 배너를 띄운다
export const VPN_UNREACHABLE_EVENT = "vpn-unreachable";

const SESSION_EXPIRED_MESSAGE = "로그인이 만료되었습니다. 다시 로그인해 주세요.";
export const VPN_CHECK_MESSAGE = "서버에 접근할 수 없습니다. VPN 연결을 확인하세요.";

export class ApiError extends Error {
  // 서버 오류 본문은 { error_code, message, details } 또는 { error: { ... } } 모양으로 온다
  constructor(status, data = {}, fallbackMessage = "요청에 실패했습니다.") {
    const body = data?.error || data || {};

    super(body.message || fallbackMessage);
    this.name = "ApiError";
    this.status = status;
    this.statusCode = status;
    this.code = body.error_code ?? body.code ?? null;
    this.details = body.details ?? null;
  }
}

// 서버에 닿지 못함. VPN이 끊겼거나 서버가 꺼져 있는 경우가 대부분이다
// (CORS로 막혀도 브라우저는 똑같이 네트워크 오류로 알려 준다)
export class NetworkError extends ApiError {
  constructor(cause) {
    super(0, { error_code: "NETWORK_ERROR" }, VPN_CHECK_MESSAGE);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

export function getAuthToken() {
  return getAccessToken() || "";
}

// null을 넘기면 로그아웃 처리만 한다
export function setAuthToken(token) {
  clearSession();

  if (token) {
    localStorage.setItem("accessToken", token);
  }
}

// 오류 응답 본문을 읽는다. 본문이 없거나 JSON이 아니면 빈 객체
async function readErrorBody(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

// timeoutMs를 주면 그 시간이 지나 요청을 끊는다. path가 전체 주소면 베이스 URL을 붙이지 않는다
export async function apiFetch(path, { headers, timeoutMs, ...options } = {}) {
  const token = getAccessToken();

  if (timeoutMs) {
    const timeout = AbortSignal.timeout(timeoutMs);
    options.signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  }

  const url = /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers
      }
    });
  } catch (cause) {
    // 요청을 직접 취소한 경우는 네트워크 오류가 아니다
    if (cause?.name === "AbortError") {
      throw cause;
    }

    window.dispatchEvent(new CustomEvent(VPN_UNREACHABLE_EVENT));
    throw new NetworkError(cause);
  }

  // 로그인한 상태에서 401: 토큰이 만료되었거나 유효하지 않음
  if (response.status === 401 && token && !path.includes("/auth/login")) {
    const error = new ApiError(401, await readErrorBody(response), SESSION_EXPIRED_MESSAGE);

    clearSession();
    saveLoginNotice(error.message);
    window.location.replace("/login");

    throw error;
  }

  return response;
}

// 실패한 응답을 ApiError로 바꾼다. 서버 message가 없으면 fallbackMessage를 쓴다
// notify: false면 오류 토스트를 띄우지 않는다 (5초 주기 자동 재조회처럼 같은 오류가 반복되는 요청용)
export async function toApiError(response, fallbackMessage, { notify = true } = {}) {
  const error = new ApiError(response.status, await readErrorBody(response), fallbackMessage);

  if (notify) {
    window.dispatchEvent(new CustomEvent(API_ERROR_EVENT, { detail: error }));
  }

  return error;
}

// JSON 요청 공통 처리. 객체 body는 JSON으로 바꾸고, 실패하면 ApiError를 던진다
export async function request(path, { notify = true, ...options } = {}) {
  const config = {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers }
  };

  if (config.body && typeof config.body === "object" && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await apiFetch(path, config);

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw await toApiError(response, `요청에 실패했습니다. (HTTP ${response.status})`, { notify });
  }

  return (response.headers.get("content-type") || "").includes("application/json")
    ? response.json()
    : response.text();
}

export const apiClient = {
  get: (path, options = {}) => request(path, { ...options, method: "GET" }),
  post: (path, body, options = {}) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options = {}) => request(path, { ...options, method: "PATCH", body }),
  put: (path, body, options = {}) => request(path, { ...options, method: "PUT", body }),
  delete: (path, body, options = {}) => request(path, { ...options, method: "DELETE", body })
};

export default apiClient;
