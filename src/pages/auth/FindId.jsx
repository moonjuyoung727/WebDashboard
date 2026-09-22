import "./Find.css";
import { Link } from "react-router-dom";

function FindId() {
  return (
    <section className="find-container">
      <h1 className="find-title">아이디 찾기</h1>

      <form className="find-form">
        <div className="find-field">
          <label htmlFor="name">이름</label>

          <input
            id="name"
            type="text"
            placeholder="이름을 입력하세요"
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
          아이디 찾기
        </button>
      </form>

      <div className="find-links">
        <Link to="/login">로그인으로 돌아가기</Link>
      </div>
    </section>
  );
}

export default FindId;
