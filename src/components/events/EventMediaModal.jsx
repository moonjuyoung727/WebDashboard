import { useState } from "react";
import { FiDownload, FiImage, FiFilm } from "react-icons/fi";
import Modal from "../Modal";
import "../Modal.css";
import "./EventMediaModal.css";
import { formatDateTime } from "../../utils/formatDateTime";

// 이벤트 스냅샷 / 영상 상세 보기 및 다운로드 (WEB-F-032)
function EventMediaModal({ event, initialTab = "snapshot", onClose }) {
  const [tab, setTab] = useState(initialTab);
  const [imageFailed, setImageFailed] = useState(false);

  const occurredAt = formatDateTime(event.occurredAt);
  const cameraLabel = event.location ? `${event.cameraName} (${event.location})` : event.cameraName;

  const hasVideo = Boolean(event.videoUrl);

  // 2.3.1 목록 응답의 snapshot_url / clip_url로 받는다 (전용 다운로드 API는 명세에 없다)
  const downloadUrl = tab === "snapshot" ? event.snapshotUrl : event.videoUrl;

  function handleDownload() {
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = `event_${event.id}_${tab}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
  }

  return (
    <Modal
      title="이벤트 미디어"
      width={820}
      onClose={onClose}
      footer={
        <>
          <span className="media-footer-info">
            {cameraLabel} · {occurredAt}
          </span>
          <button
            type="button"
            className="btn primary"
            onClick={handleDownload}
            disabled={!downloadUrl}
          >
            <FiDownload />
            {tab === "snapshot" ? "스냅샷 다운로드" : "영상 다운로드"}
          </button>
        </>
      }
    >
      <div className="media-tabs">
        <button
          type="button"
          className={tab === "snapshot" ? "active" : ""}
          onClick={() => setTab("snapshot")}
        >
          <FiImage /> 스냅샷
        </button>
        <button
          type="button"
          className={tab === "video" ? "active" : ""}
          onClick={() => setTab("video")}
        >
          <FiFilm /> 이벤트 영상
        </button>
      </div>

      <div className="media-viewer">
        {tab === "snapshot" && (
          event.snapshotUrl && !imageFailed ? (
            <img
              src={event.snapshotUrl}
              alt="이벤트 스냅샷"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="media-placeholder">
              <FiImage />
              <span>스냅샷을 불러올 수 없습니다.</span>
              <small>{occurredAt}</small>
            </div>
          )
        )}

        {tab === "video" && (
          hasVideo ? (
            <video src={event.videoUrl} controls autoPlay />
          ) : (
            <div className="media-placeholder">
              <FiFilm />
              <span>이 이벤트에는 저장된 영상이 없습니다.</span>
              <small>{occurredAt}</small>
            </div>
          )
        )}

        <span className="media-stamp">
          {event.cameraName} · {occurredAt}
        </span>
      </div>
    </Modal>
  );
}


export default EventMediaModal;
