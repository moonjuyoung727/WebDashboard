import "./Find.css";
import { Link } from "react-router-dom";

function FindPassword() {
  return (
    <section className="find-container">
      <h1 className="find-title">비밀번호 찾기</h1>

      <form className="find-form">
        <div className="find-field">
          <label htmlFor="userId">아이디</label>

          <input
            id="userId"
            type="text"
            placeholder="아이디를 입력하세요"
          />
        </div>

        <div className="find-field">
          <label htmlFor="email">이메일</label>

          <input
            id="email"
            type="email"
            placeholder="이메일을 입력하세요"
          />
        </div>

        <button type="submit" className="find-button">
          인증 요청
        </button>
      </form>

      <div className="find-links">
        <Link to="/login">로그인으로 돌아가기</Link>
      </div>
    </section>
  );
}

export default FindPassword;
