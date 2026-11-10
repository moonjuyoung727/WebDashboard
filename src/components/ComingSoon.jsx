// 서버 API 명세가 아직 없는 화면 자리에 표시하는 안내
import { FiClock } from "react-icons/fi";
import "./LoadStateNotice.css";

function ComingSoon({ title, description }) {
  return (
    <div className="load-state-notice coming-soon">
      <FiClock aria-hidden="true" />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export default ComingSoon;
