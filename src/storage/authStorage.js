// 로그인 상태 유지(remember me) 저장소.
// 체크하고 로그인하면 토큰을 localStorage에 남겨 브라우저를 다시 열어도 자동 로그인하고,
// 체크하지 않으면 sessionStorage에만 둬서 브라우저를 닫으면 로그아웃된다.

const KEY_TOKEN = "accessToken";
const KEY_REFRESH_TOKEN = "refreshToken";
const KEY_REMEMBER_ME = "rememberMe";
const KEY_USER_ID = "rememberedUserId";

export function getAccessToken() {
  return (
    localStorage.getItem(KEY_TOKEN) ||
    sessionStorage.getItem(KEY_TOKEN)
  );
}

export function isRememberMe() {
  return localStorage.getItem(KEY_REMEMBER_ME) === "true";
}

export function getRememberedUserId() {
  return localStorage.getItem(KEY_USER_ID) || "";
}

// 로그인 상태 유지가 켜져 있고 토큰이 남아 있으면 로그인 화면을 건너뛴다
export function hasSavedSession() {
  return isRememberMe() && !!localStorage.getItem(KEY_TOKEN);
}

export function saveSession(userId, token, rememberMe) {
  clearSession();

  if (rememberMe) {
    localStorage.setItem(KEY_REMEMBER_ME, "true");
    localStorage.setItem(KEY_USER_ID, userId);
    localStorage.setItem(KEY_TOKEN, token);
    return;
  }

  // 체크를 해제하고 로그인하면 저장된 아이디·체크 상태도 지운다
  localStorage.removeItem(KEY_REMEMBER_ME);
  localStorage.removeItem(KEY_USER_ID);
  sessionStorage.setItem(KEY_TOKEN, token);
}

// 로그아웃: 토큰만 지우고 아이디·체크 상태는 남겨 로그인 화면에 채워 준다
export function clearSession() {
  [localStorage, sessionStorage].forEach((storage) => {
    storage.removeItem(KEY_TOKEN);
    storage.removeItem(KEY_REFRESH_TOKEN);
  });
}
