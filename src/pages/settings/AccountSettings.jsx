import LoadStateNotice from "../../components/LoadStateNotice";
import useServerResource from "../../hooks/useServerResource";
import { getMe } from "../../api/authApi";
import "./Settings.css";

// 계정 설정 — 로그인 사용자 프로필 (GET /auth/me)
function AccountSettings() {
  const { data: profile, source, errorMessage } = useServerResource(getMe);

  if (!profile) {
    return (
      <div className="settings-section">
        <h2>계정 설정</h2>
        <LoadStateNotice source={source} subject="계정 정보를" message={errorMessage} />
      </div>
    );
  }

  return (
    <div className="settings-section">
      <h2>계정 설정</h2>

      <div className="account-field">
        <label htmlFor="account-name">사용자 이름</label>
        <input id="account-name" type="text" value={profile.name ?? profile.user_name ?? ""} readOnly />
      </div>

      <div className="account-field">
        <label htmlFor="account-id">아이디</label>
        <input id="account-id" type="text" value={profile.user_id ?? profile.userId ?? ""} readOnly />
      </div>

      <div className="account-field">
        <label htmlFor="account-email">이메일</label>
        <input id="account-email" type="email" value={profile.email ?? ""} readOnly />
      </div>

      <button type="button" className="settings-button">
        비밀번호 변경
      </button>

      <button type="button" className="danger-button">
        회원 탈퇴
      </button>
    </div>
  );
}

export default AccountSettings;
