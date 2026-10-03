//멀티뷰 카메라 한 채널
import { useState } from "react";
import "./CameraCard.css";
import {
  FiMoreHorizontal,
  FiVideo,
  FiVideoOff,
  FiMapPin,
  FiShield,
  FiMaximize2,
} from "react-icons/fi";
import { useFloating, offset, flip, shift, autoUpdate, useClick, useDismiss, useInteractions } from "@floating-ui/react";
import { useNavigate } from "react-router-dom";
import { VPN_STATUS_META } from "./charts/chartColors";

const pad = (value) => String(value).padStart(2, "0");

function formatTimestamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// VPN 상태 이름은 모든 화면 공통 (정상 / 연결 끊김 / 오류)
const vpnLabel = (status) => VPN_STATUS_META[status]?.label ?? status;

function CameraCard({
  camera,
  channel,
  now,
  recentEvent,
  highlighted = false,
}) {

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const navigate = useNavigate();

  const isOnline = camera.status === "online";

  const {refs, floatingStyles, context} = useFloating({
    open: isDetailOpen,
    onOpenChange: setIsDetailOpen,

    placement: "bottom-end",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,

    middleware: [
      offset(8),
      flip(),
      shift({padding: 10 }),
    ],
  });

  const click = useClick(context);

  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
  });

  const {
    getReferenceProps,
    getFloatingProps,
  } = useInteractions([click, dismiss]);

  function openMonitoring() {
    navigate(`/Monitoring/${camera.id}`);
  }

  const details = [
    ["카메라 ID", camera.id],
    ["기기 번호", camera.hwnum],
    ["IP", camera.ip],
    ["모델", camera.model],
    ["펌웨어", camera.firmwareVersion],
    ["가동 시간", isOnline ? camera.uptime : "-"],
    ["최근 이벤트", recentEvent ?? "-"],
    ["마지막 연결", camera.lastConnectedAt],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  return (
    <article
      className={[
        "cam-card",
        camera.status,
        highlighted ? "highlighted" : "",
      ].join(" ").trim()}
    >
      <div
        className="cam-video"
        role="button"
        tabIndex={0}
        onClick={openMonitoring}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openMonitoring();
          }
        }}
        aria-label={`${camera.name} 실시간 모니터링 열기`}
      >
        {/* WEB-F-012 멀티뷰는 저해상도 스트림 재생 — 서버 연결 후 getLowResStreams() 응답의 streamUrl 사용 */}
        {isOnline ? (
          <div className="cam-placeholder">
            <FiVideo />
          </div>
        ) : (
          <div className="cam-no-signal">
            <FiVideoOff />
            <strong>신호 없음</strong>
            {camera.lastConnectedAt && (
              <small>마지막 연결 {camera.lastConnectedAt}</small>
            )}
          </div>
        )}

        <div className="cam-overlay-top">
          <span className={`cam-live-badge ${camera.status}`}>
            <span className="cam-live-dot" />
            {isOnline ? "LIVE" : "OFFLINE"}
          </span>

          {channel !== undefined && (
            <span className="cam-channel">CH {pad(channel)}</span>
          )}

          <span className="cam-overlay-spacer" />

          {isOnline && now && (
            <span className="cam-time">{formatTimestamp(now)}</span>
          )}

          <span className="stream-quality-badge">SD</span>
        </div>

        {isOnline && (
          <div className="cam-hover">
            <FiMaximize2 />
            실시간 보기
          </div>
        )}
      </div>

      <div className="cam-info">
        <div className="cam-name-group">
          <strong>{camera.name}</strong>
          {camera.location && (
            <small>
              <FiMapPin />
              {camera.location}
            </small>
          )}
        </div>

        <div className="cam-actions">
          {camera.vpnStatus && (
            <span
              className={`cam-vpn ${camera.vpnStatus}`}
              title={`VPN ${vpnLabel(camera.vpnStatus)}`}
              aria-label={`VPN ${vpnLabel(camera.vpnStatus)}`}
            >
              <FiShield />
            </span>
          )}

          <button
            type="button"
            ref={refs.setReference}
            className={`cam-icon-button ${isDetailOpen ? "active" : ""}`}
            aria-label="카메라 정보"
            {...getReferenceProps()}
          >
            <FiMoreHorizontal />
          </button>
        </div>
      </div>

      {isDetailOpen && (
        <div
          ref={refs.setFloating}
          className="cam-popover"
          style={floatingStyles}
          {...getFloatingProps()}
        >
          <div className="cam-popover-header">
            <strong>{camera.name}</strong>
            <span className={`cam-popover-status ${camera.status}`}>
              {isOnline ? "온라인" : "오프라인"}
            </span>
          </div>

          <dl className="cam-popover-list">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            {camera.vpnStatus && (
              <div>
                <dt>VPN</dt>
                <dd className={`cam-vpn-text ${camera.vpnStatus}`}>
                  {vpnLabel(camera.vpnStatus)}
                </dd>
              </div>
            )}
          </dl>

          <button type="button" className="cam-popover-action" onClick={openMonitoring}>
            <FiMaximize2 />
            실시간 모니터링
          </button>
        </div>
      )}
    </article>
  );
}

export default CameraCard;
