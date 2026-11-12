//로그인 화면
//한 카드 안에서 로그인 / 회원가입 / 이메일 찾기 / 비밀번호 찾기를 전환한다
//이메일로 가입하고 로그인한다

import "./Login.css";
import { useState, useEffect, useRef } from "react";
import {
  FaEye,
  FaEyeSlash,
  FaLock,
  FaEnvelope,
  FaUser,
  FaCheck,
  FaMobileAlt,
  FaKey
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import {
  login,
  signup,
  forgotPassword,
  sendVerificationCode,
  findEmail
} from "../../api/authApi";
import { ApiError } from "../../api/client";
import {
  saveSession,
  clearSession,
  hasSavedSession,
  isRememberMe,
  getRememberedUserId,
  takeLoginNotice
} from "../../storage/authStorage";

// 모드마다 주소를 따로 둬서 브라우저 뒤로가기로 로그인 카드에 돌아올 수 있게 한다
const MODE_PATHS = {
  login: "/login",
  signup: "/signup",
  findEmail: "/find-email",
  findPw: "/find-pw"
};

const TITLES = {
  login: "로그인",
  signup: "회원가입",
  findEmail: "이메일 찾기",
  findPw: "비밀번호 찾기"
};

const SUBMIT_LABELS = {
  login: "LOGIN",
  signup: "SIGN UP",
  findEmail: "FIND EMAIL",
  findPw: "FIND PASSWORD"
};

const GUIDES = {
  findEmail: "이름과 휴대폰 번호로 본인 인증을 해 주세요.",
  findPw: "가입한 이메일을 입력해 주세요."
};

// 휴대폰 번호 (하이픈 제외 숫자 10~11자리)
const PHONE_PATTERN = /^01\d{8,9}$/;
const PHONE_MAX_LENGTH = 13;

const CODE_MAX_LENGTH = 10;

// 이메일 주소 최대 길이 (RFC 5321)
const EMAIL_MAX_LENGTH = 254;

const NAME_MAX_LENGTH = 50;

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 64;

//비밀번호 영문 대소문자 + 숫자 + 특수문자
const PASSWORD_PATTERN = /^[A-Za-z0-9!@#$%^&*]*$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const isFindEmail = mode === "findEmail";
  const isFindPw = mode === "findPw";
  const isFind = isFindEmail || isFindPw;

  const [name, setName] = useState("");
  const [email, setEmail] = useState(getRememberedUserId);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  // 이메일 찾기 본인 인증
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  // 로그인 상태 유지 (remember me)
  const [rememberMe, setRememberMe] = useState(isRememberMe);

  // 안내 / 오류 메시지. 띄운 모드에서만 보이고 다른 모드로 넘어가면 사라진다
  const [feedback, setFeedback] = useState(null);

  const [isBusy, setIsBusy] = useState(false);

  const inputRefs = {
    name: useRef(null),
    email: useRef(null),
    password: useRef(null),
    passwordConfirm: useRef(null),
    phone: useRef(null),
    code: useRef(null)
  };

  // 안내 문구도 접히는 동안 남아 있도록 마지막 문구를 기억해 둔다
  const lastGuideRef = useRef(GUIDES.findPw);
  if (GUIDES[mode]) {
    lastGuideRef.current = GUIDES[mode];
  }

  const shownFeedback = feedback?.mode === mode ? feedback : null;

  // 메시지가 접히는 동안에도 문구가 남아 있도록 마지막 메시지를 기억해 둔다
  const lastFeedbackRef = useRef(null);
  if (shownFeedback) {
    lastFeedbackRef.current = shownFeedback;
  }
  const messageToRender = shownFeedback ?? lastFeedbackRef.current;

  // 로그인 상태 유지 중이면 바로 들어가고, 아니면 남은 토큰을 정리한다
  useEffect(() => {
    if (hasSavedSession()) {
      navigate("/vpn-check", { replace: true });
      return;
    }

    clearSession();

    // 401로 쫓겨 온 경우 서버가 보낸 사유를 보여 준다
    const notice = takeLoginNotice();
    if (notice) {
      setFeedback({ mode: "login", text: notice, isError: true });
    }
  }, [navigate]);

  // 회원가입 카드를 벗어나면 비밀번호 확인을 초기화한다
  useEffect(() => {
    if (mode !== "signup") {
      setPasswordConfirm("");
    }
  }, [mode]);

  // 이메일 찾기 카드를 벗어나면 인증 입력을 초기화한다
  useEffect(() => {
    if (mode !== "findEmail") {
      setPhone("");
      setCode("");
      setIsCodeSent(false);
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

  function handleNameChange(event) {
    const value = event.target.value;

    if (value.length > NAME_MAX_LENGTH) {
      return;
    }

    setName(value);
    setFeedback(null);
  }

  function handleEmailChange(event) {
    const value = event.target.value;

    // 회원가입에서는 최대 길이를 넘는 입력은 아예 받지 않는다
    if (isSignup && value.length > EMAIL_MAX_LENGTH) {
      return;
    }

    setEmail(value);
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

  // 숫자와 하이픈만 받는다
  function handlePhoneChange(event) {
    const value = event.target.value;

    if (value.length > PHONE_MAX_LENGTH || !/^[\d-]*$/.test(value)) {
      return;
    }

    setPhone(value);
    setFeedback(null);
  }

  function handleCodeChange(event) {
    const value = event.target.value.trim();

    if (value.length > CODE_MAX_LENGTH) {
      return;
    }

    setCode(value);
    setFeedback(null);
  }

  // 휴대폰 번호 미입력 / 형식 검사. 통과하면 숫자만 남긴 번호를 돌려준다
  function validatePhone() {
    const digits = phone.replace(/-/g, "");

    if (!digits) {
      showError("휴대폰 번호를 입력해 주세요.", "phone");
      return null;
    }

    if (!PHONE_PATTERN.test(digits)) {
      showError("올바른 휴대폰 번호를 입력해 주세요.", "phone");
      return null;
    }

    return digits;
  }

  // 이메일 미입력 / 형식 검사 (모든 모드 공통)
  function validateEmail() {
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


  /* 로그인 */

  async function handleLogin() {

    if (!validateEmail()) {
      return;
    }

    //비밀번호 미입력
    if (!password) {
      showError("비밀번호를 입력해 주세요.", "password");
      return;
    }

    /*
    서버 없이 화면을 확인할 때만 임시 토큰으로 로그인을 우회한다. (지금은 비활성화)
    setFeedback(null);
    saveSession(email.trim(), "temporary-token", rememberMe);
    navigate("/vpn-check", { replace: true });
    return;
    */

    try {
      setIsBusy(true);
      setFeedback(null);

      const data = await login(email.trim(), password, rememberMe);

      // 응답에 토큰이 없으면 로그인 실패로 본다
      if (!data?.access_token) {
        throw new Error("MISSING_ACCESS_TOKEN");
      }

      saveSession(email.trim(), data.access_token, rememberMe);

      navigate("/vpn-check", { replace: true });
    } catch (error) {

      // 400 INVALID_CREDENTIALS: 서버 message를 비밀번호 칸 아래에 보여 준다
      if (error instanceof ApiError && error.status === 400) {
        showError(error.message, "password");
        return;
      }

      // 서버 오류는 서버 message를, 네트워크 오류 등은 기본 문구를 보여 준다
      console.error(error);
      setFeedback({
        mode,
        text: error instanceof ApiError
          ? error.message
          : "로그인 처리 중 문제가 발생했습니다.",
        isError: true
      });
    } finally {
      setIsBusy(false);
    }
  }


  /* 회원가입 */

  async function handleSignup() {

    //이름
    if (!name.trim()) {
      showError("이름을 입력해 주세요.", "name");
      return;
    }

    if (!validateEmail()) {
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

    try {
      setIsBusy(true);
      setFeedback(null);

      await signup({ email: email.trim(), password, name: name.trim() });

      // 회원가입이 끝나면 카드를 로그인으로 접고 이메일은 남겨 둔다
      setName("");
      setPassword("");
      setPasswordConfirm("");

      showNotice("회원가입이 완료되었습니다. 로그인해 주세요.", "login");
      navigate(MODE_PATHS.login, { replace: true });

    } catch (error) {

      // 409: 이미 같은 이메일로 가입된 계정이 있는 경우
      if (error instanceof ApiError && error.status === 409) {
        showError(error.message, "email");
        return;
      }

      console.error(error);
      setFeedback({
        mode,
        text: error instanceof ApiError
          ? error.message
          : "회원가입 처리 중 문제가 발생했습니다.",
        isError: true
      });
    } finally {
      setIsBusy(false);
    }
  }


  /* 이메일 찾기 */

  async function handleSendCode() {
    if (isSendingCode || isBusy) {
      return;
    }

    const digits = validatePhone();
    if (!digits) {
      return;
    }

    try {
      setIsSendingCode(true);
      setFeedback(null);

      await sendVerificationCode(digits, "find_id");

      setIsCodeSent(true);
      showNotice("인증번호를 보냈습니다. 문자 메시지를 확인해 주세요.");
      inputRefs.code.current?.focus();
    } catch (error) {
      console.error(error);
      showError(
        error instanceof ApiError
          ? error.message
          : "인증번호 발송 중 문제가 발생했습니다.",
        "phone"
      );
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleFindEmail() {
    if (!name.trim()) {
      showError("이름을 입력해 주세요.", "name");
      return;
    }

    const digits = validatePhone();
    if (!digits) {
      return;
    }

    if (!isCodeSent) {
      showError("인증번호 받기를 먼저 눌러 주세요.", "phone");
      return;
    }

    if (!code) {
      showError("인증번호를 입력해 주세요.", "code");
      return;
    }

    try {
      setIsBusy(true);
      setFeedback(null);

      const data = await findEmail(name.trim(), digits, code);

      if (!data?.email) {
        throw new Error("MISSING_EMAIL");
      }

      showNotice(`가입된 이메일은 ${data.email} 입니다.`);
    } catch (error) {

      // 400: 인증번호 불일치 / 만료
      if (error instanceof ApiError && error.status === 400) {
        showError(error.message, "code");
        return;
      }

      console.error(error);
      setFeedback({
        mode,
        text: error instanceof ApiError
          ? error.message
          : "이메일 찾기 처리 중 문제가 발생했습니다.",
        isError: true
      });
    } finally {
      setIsBusy(false);
    }
  }


  /* 비밀번호 찾기 */

  async function handleFindPassword() {
    if (!validateEmail()) {
      return;
    }

    setIsBusy(true);
    try {
      await forgotPassword(email.trim());
      showNotice("비밀번호 재설정 안내를 요청했습니다. 이메일을 확인해 주세요.");
    } catch (error) {
      showError(error.message || "비밀번호 재설정 안내 요청에 실패했습니다.", "email");
    } finally { setIsBusy(false); }
  }


  function handleSubmit(event) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    if (mode === "login") handleLogin();
    else if (mode === "signup") handleSignup();
    else if (mode === "findEmail") handleFindEmail();
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
            <p key={`guide-${mode}`} className="auth-guide">
              {lastGuideRef.current}
            </p>
          </Collapse>

          {/* 이름 (회원가입 / 이메일 찾기) */}
          <Collapse open={isSignup || isFindEmail}>
            <AuthField
              icon={<FaUser />}
              inputRef={inputRefs.name}
              invalid={isInvalid("name")}
              type="text"
              placeholder="이름"
              aria-label="이름"
              value={name}
              onChange={handleNameChange}
              autoComplete="name"
            />
          </Collapse>

          {/* 이메일 (이메일 찾기만 빼고 공통) */}
          <Collapse open={!isFindEmail} flush>
            <AuthField
              icon={<FaEnvelope />}
              inputRef={inputRefs.email}
              invalid={isInvalid("email")}
              type="email"
              placeholder="이메일"
              aria-label="이메일"
              value={email}
              onChange={handleEmailChange}
              autoComplete={isSignup ? "email" : "username"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
          </Collapse>

          {/* 휴대폰 번호 + 인증번호 (이메일 찾기일 때만) */}
          <Collapse open={isFindEmail}>
            <AuthField
              icon={<FaMobileAlt />}
              inputRef={inputRefs.phone}
              invalid={isInvalid("phone")}
              type="tel"
              inputMode="numeric"
              placeholder="휴대폰 번호"
              aria-label="휴대폰 번호"
              value={phone}
              onChange={handlePhoneChange}
              autoComplete="tel"
              trailing={
                <button
                  type="button"
                  className="auth-inline-button"
                  onClick={handleSendCode}
                  disabled={isSendingCode || isBusy}
                >
                  {isSendingCode && <span className="auth-spinner" />}
                  {isCodeSent ? "재전송" : "인증번호 받기"}
                </button>
              }
            />
          </Collapse>

          <Collapse open={isFindEmail}>
            <AuthField
              icon={<FaKey />}
              inputRef={inputRefs.code}
              invalid={isInvalid("code")}
              type="text"
              inputMode="numeric"
              placeholder="인증번호"
              aria-label="인증번호"
              value={code}
              onChange={handleCodeChange}
              autoComplete="one-time-code"
            />
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

          {/* 로그인 상태 유지 + 이메일 / 비밀번호 찾기 */}
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
                  onClick={() => switchMode("findEmail")}
                >
                  이메일 찾기
                </button>

                <span className="auth-find-sep" aria-hidden="true">|</span>

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
function Collapse({ open, tight, flush, hint, message, options, children }) {
  const bodyClass = [
    "auth-collapse-body",
    tight && "is-tight",
    flush && "is-flush",
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
