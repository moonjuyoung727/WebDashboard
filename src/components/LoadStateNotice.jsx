// 데이터를 보여 줄 수 없을 때(불러오는 중 · 서버 연결 실패) 목록 자리에 표시하는 안내
// subject는 조사까지 포함해서 넘긴다 (예: "카메라 목록을")
import { FiAlertCircle } from "react-icons/fi";
import "./LoadStateNotice.css";

function LoadStateNotice({ source, subject, message, className = "" }) {
  if (source === "error") {
    return (
      <div className={`load-state-notice error ${className}`.trim()} role="alert">
        <FiAlertCircle aria-hidden="true" />
        <strong>{subject} 불러오지 못했습니다.</strong>
        <p>{message} 연결되면 자동으로 다시 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className={`load-state-notice ${className}`.trim()}>
      <p>{subject} 불러오는 중...</p>
    </div>
  );
}

export default LoadStateNotice;
