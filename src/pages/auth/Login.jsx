//로그인 화면
//한 카드 안에서 로그인 / 회원가입 / 아이디 찾기 / 비밀번호 찾기를 전환한다

import "./Login.css";
import { useState, useEffect, useRef } from "react";
import {
  FaEye,
  FaEyeSlash,
  FaUser,
  FaLock,
  FaEnvelope,
  FaCheck
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { signup, checkUserId } from "../../api/authApi";
import {
  saveSession,
  clearSession,
  hasSavedSession,
  isRememberMe,
  getRememberedUserId
} from "../../storage/authStorage";

// 모드마다 주소를 따로 둬서 브라우저 뒤로가기로 로그인 카드에 돌아올 수 있게 한다
const MODE_PATHS = {
  login: "/login",
  signup: "/signup",
  findId: "/find-id",
  findPw: "/find-pw"
};

const TITLES = {
  login: "로그인",
  signup: "회원가입",
  findId: "아이디 찾기",
  findPw: "비밀번호 찾기"
};

const SUBMIT_LABELS = {
  login: "LOGIN",
  signup: "SIGN UP",
  findId: "FIND ID",
  findPw: "FIND PASSWORD"
};

const FIND_GUIDES = {
  findId: "가입할 때 사용한 이메일을 입력해 주세요.",
  findPw: "가입한 아이디와 이메일을 입력해 주세요."
};

const ID_MIN_LENGTH = 4;
const ID_MAX_LENGTH = 20;

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 64;

//아이디 영문 대소문자 + 숫자만 허용
const ID_PATTERN = /^[A-Za-z0-9]*$/;

//비밀번호 영문 대소문자 + 숫자 + 특수문자
const PASSWORD_PATTERN = /^[A-Za-z0-9!@#$%^&*]*$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ID_CHECK_IDLE = { status: "idle", message: "" };

function modeOf(pathname) {
  const path = pathname.toLowerCase().replace(/\/+$/, "");

  return (
    Object.keys(MODE_PATHS).find((mode) => MODE_PATHS[mode] === path) ??
    "login"
  );
}


function Login() {

  const location = useLocation();
  const navigate = useNavigate();

  const mode = modeOf(location.pathname);

  const isSignup = mode === "signup";
  const isFind = mode === "findId" || mode === "findPw";

  const [userId, setUserId] = useState(getRememberedUserId);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [email, setEmail] = useState("");

  // 로그인 상태 유지 (remember me)
  const [rememberMe, setRememberMe] = useState(isRememberMe);

  // 안내 / 오류 메시지. 띄운 모드에서만 보이고 다른 모드로 넘어가면 사라진다
  const [feedback, setFeedback] = useState(null);

  // 아이디 중복 확인 (idle / checking / available / taken / error)
  const [idCheck, setIdCheck] = useState(ID_CHECK_IDLE);

  const [isBusy, setIsBusy] = useState(false);

  const inputRefs = {
    userId: useRef(null),
    password: useRef(null),
    passwordConfirm: useRef(null),
    email: useRef(null)
  };

  const shownFeedback = feedback?.mode === mode ? feedback : null;

  // 메시지가 접히는 동안에도 문구가 남아 있도록 마지막 메시지를 기억해 둔다
  const lastFeedbackRef = useRef(null);
  if (shownFeedback) {
    lastFeedbackRef.current = shownFeedback;
  }
  const messageToRender = shownFeedback ?? lastFeedbackRef.current;

  // 찾기 카드가 접히는 동안에도 안내 문구가 바뀌지 않도록 마지막 찾기 모드를 기억해 둔다
  const lastFindModeRef = useRef("findId");
  if (isFind) {
    lastFindModeRef.current = mode;
  }

  // 로그인 상태 유지 중이면 바로 들어가고, 아니면 남은 토큰을 정리한다
  useEffect(() => {
    if (hasSavedSession()) {
      navigate("/vpn-check", { replace: true });
      return;
    }

    clearSession();
  }, [navigate]);

  // 회원가입 카드를 벗어나면 중복 확인 / 비밀번호 확인을 초기화한다
  useEffect(() => {
    if (mode !== "signup") {
      setIdCheck(ID_CHECK_IDLE);
      setPasswordConfirm("");
    }
  }, [mode]);

  function switchMode(target) {
    navigate(MODE_PATHS[target]);
  }

  function showError(text, field) {
    setFeedback({ mode, text, isError: true, field });
    inputRefs[field]?.current?.focus();
  }

  function showNotice(text, targetMode = mode) {
    setFeedback({ mode: targetMode, text, isError: false });
  }

  function isInvalid(field) {
    return shownFeedback?.isError && shownFeedback.field === field;
  }


  /* 입력 */

  function handleUserIdChange(event) {
    const value = event.target.value;

    // 회원가입에서는 허용하지 않는 문자는 아예 입력되지 않게 막는다
    if (isSignup) {
      if (value.length > ID_MAX_LENGTH || !ID_PATTERN.test(value)) {
        return;
      }

      // 아이디가 바뀌면 중복 확인 다시 필요
      setIdCheck(ID_CHECK_IDLE);
    }

    setUserId(value);
    setFeedback(null);
  }

  function handlePasswordChange(event) {
    const value = event.target.value;

    if (
      isSignup &&
      (value.length > PASSWORD_MAX_LENGTH || !PASSWORD_PATTERN.test(value))
    ) {
      return;
    }

    setPassword(value);
    setFeedback(null);
  }

  function handlePasswordConfirmChange(event) {
    const value = event.target.value;

    if (
      value.length > PASSWORD_MAX_LENGTH ||
      !PASSWORD_PATTERN.test(value)
    ) {
      return;
    }

    setPasswordConfirm(value);
    setFeedback(null);
  }

  function handleEmailChange(event) {
    setEmail(event.target.value);
    setFeedback(null);
  }


  /* 로그인 */

  function handleLogin() {

    //아이디 미입력
    if (!userId.trim()) {
      showError("아이디를 입력해 주세요.", "userId");
      return;
    }

    //비밀번호 미입력
    if (!password) {
      showError("비밀번호를 입력해 주세요.", "password");
      return;
    }

    /*
    나중에는 여기서 백엔드 로그인 API를 호출한다. (authApi의 login import)
    try {
      setIsBusy(true);

      const data = await login(userId.trim(), password);

      saveSession(userId.trim(), data.accessToken, rememberMe);

      navigate("/vpn-check", { replace: true });
    } catch (error) {

      if (error.code === "INVALID_CREDENTIALS") {
        showError(
          "아이디 또는 비밀번호가 올바르지 않습니다. 입력한 정보를 다시 확인해 주세요.",
          "password"
        );
        return;
      }

      // 서버 오류 / 네트워크 오류 등
      setFeedback({ mode, text: "로그인 처리 중 문제가 발생했습니다.", isError: true });
    } finally {
      setIsBusy(false);
    }
    */

    // 현재는 로그인 성공을 임시로 저장
    setFeedback(null);
    saveSession(userId.trim(), "temporary-token", rememberMe);

    navigate("/vpn-check", { replace: true });
  }


  /* 회원가입 */

  async function handleCheckUserId() {
    const trimmedId = userId.trim();

    if (!trimmedId) {
      showError("아이디를 입력해 주세요.", "userId");
      return;
    }

    if (
      trimmedId.length < ID_MIN_LENGTH ||
      trimmedId.length > ID_MAX_LENGTH
    ) {
      showError(
        `아이디는 ${ID_MIN_LENGTH}~${ID_MAX_LENGTH}자로 입력해 주세요.`,
        "userId"
      );
      return;
    }

    try {
      setFeedback(null);
      setIdCheck({ status: "checking", message: "" });

      const data = await checkUserId(trimmedId);

      setIdCheck(
        data.available
          ? { status: "available", message: "사용 가능한 아이디입니다." }
          : { status: "taken", message: "이미 사용 중인 아이디입니다." }
      );
    } catch (error) {
      console.error(error);

      setIdCheck({
        status: "error",
        message: "아이디 중복 확인에 실패했습니다."
      });
    }
  }

  async function handleSignup() {

    //아이디 입력 여부
    if (!userId.trim()) {
      showError("아이디를 입력해 주세요.", "userId");
      return;
    }

    //아이디 길이
    if (
      userId.length < ID_MIN_LENGTH ||
      userId.length > ID_MAX_LENGTH
    ) {
      showError(
        `아이디는 ${ID_MIN_LENGTH}~${ID_MAX_LENGTH}자로 입력해 주세요.`,
        "userId"
      );
      return;
    }

    //아이디 문자 검사
    if (!ID_PATTERN.test(userId)) {
      showError("아이디는 영문과 숫자만 사용할 수 있습니다.", "userId");
      return;
    }

    //중복 확인 여부
    if (idCheck.status !== "available") {
      showError(
        idCheck.status === "taken"
          ? "사용할 수 없는 아이디입니다."
          : "아이디 중복 확인을 해주세요.",
        "userId"
      );
      return;
    }

    //비밀번호
    if (!password) {
      showError("비밀번호를 입력해 주세요.", "password");
      return;
    }

    //비밀번호 길이
    if (
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      showError(
        `비밀번호는 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자로 입력해 주세요.`,
        "password"
      );
      return;
    }

    //비밀번호 허용 문자
    if (!PASSWORD_PATTERN.test(password)) {
      showError(
        "비밀번호는 영문, 숫자, ! @ # $ % ^ & * 만 사용할 수 있습니다.",
        "password"
      );
      return;
    }

    //비밀번호 확인
    if (!passwordConfirm) {
      showError("비밀번호 확인을 입력해 주세요.", "passwordConfirm");
      return;
    }

    //비밀번호 일치 검사
    if (password !== passwordConfirm) {
      showError("비밀번호가 일치하지 않습니다.", "passwordConfirm");
      return;
    }

    //이메일
    if (!email.trim()) {
      showError("이메일을 입력해 주세요.", "email");
      return;
    }

    //이메일 형식
    if (!EMAIL_PATTERN.test(email.trim())) {
      showError("올바른 이메일 형식을 입력해 주세요.", "email");
      return;
    }

    try {
      setIsBusy(true);
      setFeedback(null);

      await signup(userId.trim(), email.trim(), password);

      // 회원가입이 끝나면 카드를 로그인으로 접고 아이디는 남겨 둔다
      setPassword("");
      setPasswordConfirm("");
      setEmail("");

      showNotice("회원가입이 완료되었습니다. 로그인해 주세요.", "login");
      navigate(MODE_PATHS.login, { replace: true });

    } catch (error) {

      // 중복확인 이후 다른 사람이 같은 ID를
      // 먼저 가입한 경우까지 대비
      if (error.code === "DUPLICATE_USER") {
        setIdCheck(ID_CHECK_IDLE);
        showError("이미 사용 중인 아이디입니다.", "userId");
        return;
      }

      console.error(error);
      setFeedback({
        mode,
        text: "회원가입 처리 중 문제가 발생했습니다.",
        isError: true
      });
    } finally {
      setIsBusy(false);
    }
  }


  /* 아이디 / 비밀번호 찾기 */

  function validateFindEmail() {
    if (!email.trim()) {
      showError("이메일을 입력해 주세요.", "email");
      return false;
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      showError("올바른 이메일 형식을 입력해 주세요.", "email");
      return false;
    }

    return true;
  }

  function handleFindId() {
    if (!validateFindEmail()) {
      return;
    }

    // TODO: 아이디 찾기 API 연동 (백엔드 명세 확정 후)
    showNotice("아이디 찾기는 서버 연동 후 사용할 수 있습니다.");
  }

  function handleFindPassword() {
    if (!userId.trim()) {
      showError("아이디를 입력해 주세요.", "userId");
      return;
    }

    if (!validateFindEmail()) {
      return;
    }

    // TODO: 비밀번호 찾기 API 연동 (백엔드 명세 확정 후)
    showNotice("비밀번호 찾기는 서버 연동 후 사용할 수 있습니다.");
  }


  function handleSubmit(event) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    if (mode === "login") handleLogin();
    else if (mode === "signup") handleSignup();
    else if (mode === "findId") handleFindId();
    else handleFindPassword();
  }


  const passwordMismatch =
    isSignup && passwordConfirm !== "" && password !== passwordConfirm;

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>

        {/* 카드 위에 걸친 보안 배지 */}
        <div className="auth-badge">
          <ShieldLockIcon />
        </div>

        <div className="auth-card">

          <h1 key={`title-${mode}`} className="auth-title">
            {TITLES[mode]}
          </h1>

          {/* 찾기 안내 */}
          <Collapse open={isFind} tight>
            <p key={`guide-${lastFindModeRef.current}`} className="auth-guide">
              {FIND_GUIDES[lastFindModeRef.current]}
            </p>
          </Collapse>

          {/* 아이디 */}
          <Collapse open={mode !== "findId"}>
            <AuthField
              icon={<FaUser />}
              inputRef={inputRefs.userId}
              invalid={isInvalid("userId")}
              type="text"
              placeholder="아이디"
              aria-label="아이디"
              value={userId}
              onChange={handleUserIdChange}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              trailing={
                isSignup && (
                  <button
                    type="button"
                    className="auth-field-action"
                    onClick={handleCheckUserId}
                    disabled={
                      idCheck.status === "checking" || !userId.trim()
                    }
                  >
                    {idCheck.status === "checking"
                      ? <span className="auth-spinner" />
                      : "중복 확인"}
                  </button>
                )
              }
            />

            <Collapse open={isSignup} hint>
              <p className="auth-hint">영문, 숫자 4~20자</p>

              {idCheck.message && (
                <p
                  className={`auth-hint ${
                    idCheck.status === "available" ? "is-success" : "is-error"
                  }`}
                >
                  {idCheck.message}
                </p>
              )}
            </Collapse>
          </Collapse>

          {/* 비밀번호 */}
          <Collapse open={!isFind}>
            <PasswordField
              inputRef={inputRefs.password}
              invalid={isInvalid("password")}
              placeholder="비밀번호"
              value={password}
              onChange={handlePasswordChange}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />

            <Collapse open={isSignup} hint>
              <p className="auth-hint">
                영문, 숫자, 특수문자 (! @ # $ % ^ & *) 8~64자
              </p>
            </Collapse>
          </Collapse>

          {/* 회원가입일 때만 아래로 늘어나는 영역 */}
          <Collapse open={isSignup}>
            <PasswordField
              inputRef={inputRefs.passwordConfirm}
              invalid={isInvalid("passwordConfirm") || passwordMismatch}
              placeholder="비밀번호 확인"
              value={passwordConfirm}
              onChange={handlePasswordConfirmChange}
              autoComplete="new-password"
            />

            <Collapse open={passwordMismatch} hint>
              <p className="auth-hint is-error">
                비밀번호가 일치하지 않습니다.
              </p>
            </Collapse>
          </Collapse>

          {/* 이메일 */}
          <Collapse open={isSignup || isFind}>
            <AuthField
              icon={<FaEnvelope />}
              inputRef={inputRefs.email}
              invalid={isInvalid("email")}
              type="email"
              placeholder="이메일"
              aria-label="이메일"
              value={email}
              onChange={handleEmailChange}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck="false"
            />
          </Collapse>

          {/* 경고 / 안내 메시지 */}
          <Collapse open={!!shownFeedback} message>
            <p
              className={`auth-message ${
                messageToRender?.isError ? "is-error" : ""
              }`}
              role={shownFeedback?.isError ? "alert" : "status"}
            >
              {messageToRender?.text}
            </p>
          </Collapse>

          {/* 로그인 상태 유지 + 아이디 찾기 | 비밀번호 찾기 */}
          <Collapse open={mode === "login"} options>
            <div className="auth-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span className="remember-box" aria-hidden="true">
                  <FaCheck />
                </span>
                로그인 상태 유지
              </label>

              <div className="auth-find-links">
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => switchMode("findId")}
                >
                  아이디 찾기
                </button>

                <span className="auth-divider">|</span>

                <button
                  type="button"
                  className="auth-link"
                  onClick={() => switchMode("findPw")}
                >
                  비밀번호 찾기
                </button>
              </div>
            </div>
          </Collapse>
        </div>

        {/* 카드 밑에서 빠져나온 버튼 (윗부분은 카드에 가려진다) */}
        <button
          type="submit"
          className="auth-submit"
          disabled={isBusy}
        >
          <span key={`submit-${mode}`} className="auth-submit-label">
            {isBusy && <span className="auth-spinner" />}
            {SUBMIT_LABELS[mode]}
          </span>
        </button>
      </form>

      {/* 회원가입 / 로그인으로 돌아가기 */}
      <div key={`switch-${mode}`} className="auth-switch">
        {mode === "login" && (
          <>
            <span>계정이 없으신가요?</span>
            <button
              type="button"
              className="auth-link"
              onClick={() => switchMode("signup")}
            >
              회원가입
            </button>
          </>
        )}

        {mode === "signup" && (
          <>
            <span>이미 계정이 있으신가요?</span>
            <button
              type="button"
              className="auth-link"
              onClick={() => switchMode("login")}
            >
              로그인
            </button>
          </>
        )}

        {isFind && (
          <button
            type="button"
            className="auth-link"
            onClick={() => switchMode("login")}
          >
            로그인으로 돌아가기
          </button>
        )}
      </div>
    </div>
  );
}


/* 높이를 0 ↔ 내용 높이로 부드럽게 접고 펼친다. 접힌 동안은 탭 이동도 막는다 */
function Collapse({ open, tight, hint, message, options, children }) {
  const bodyClass = [
    "auth-collapse-body",
    tight && "is-tight",
    hint && "is-hint",
    message && "is-message",
    options && "is-options"
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`auth-collapse ${open ? "is-open" : ""}`}
      inert={!open}
    >
      <div className="auth-collapse-inner">
        <div className={bodyClass}>{children}</div>
      </div>
    </div>
  );
}


/* 기존 입력 칸 디자인 (눌린 면 + 포인트 색 아이콘) */
function AuthField({ icon, inputRef, invalid, trailing, ...inputProps }) {
  return (
    <div className={`auth-field ${invalid ? "is-invalid" : ""}`}>
      <span className="auth-field-icon" aria-hidden="true">
        {icon}
      </span>

      <input
        ref={inputRef}
        className="auth-input"
        aria-invalid={invalid || undefined}
        {...inputProps}
      />

      {trailing}
    </div>
  );
}


/* 눈 버튼을 누르고 있는 동안만 비밀번호를 보여 준다 */
function PasswordField({ placeholder, ...fieldProps }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthField
      icon={<FaLock />}
      type={showPassword ? "text" : "password"}
      placeholder={placeholder}
      aria-label={placeholder}
      {...fieldProps}
      trailing={
        <button
          type="button"
          className="eye-button"
          aria-label="비밀번호 보기"
          onPointerDown={(event) => {
            event.preventDefault();
            setShowPassword(true);
          }}
          onPointerUp={() => setShowPassword(false)}
          onPointerLeave={() => setShowPassword(false)}
          onPointerCancel={() => setShowPassword(false)}
        >
          {showPassword ? <FaEyeSlash /> : <FaEye />}
        </button>
      }
    />
  );
}


/* 방패 안에 자물쇠가 들어간 보안 아이콘 (선으로만 그린다)
   viewBox는 방패를 가운데에 두고 배지를 꽉 채우는 영역이라, 배지 크기를 바꾸면 아이콘도 같이 커지고 작아진다 */
function ShieldLockIcon() {
  return (
    <svg
      className="auth-badge-icon"
      viewBox="27 24.2 89 89"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 방패 (옆면에서 아래 꼭짓점으로 꺾이지 않고 곡선으로 이어진다) */}
      <path d="M71.5 47.4 L52.5 52.8 V64 C52.5 76 60 84 71.5 90 C83 84 90.5 76 90.5 64 V52.8 Z" />

      {/* 자물쇠 고리 + 몸통 */}
      <path d="M65.9 64.8 V61.8 A5.6 5.6 0 0 1 77.1 61.8 V64.8" />
      <rect x="62.6" y="64.8" width="17.8" height="13.9" rx="2.5" />
    </svg>
  );
}

export default Login;
