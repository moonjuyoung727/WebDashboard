import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  FiVideo,
  FiWifi,
  FiWifiOff,
  FiShield,
  FiShieldOff,
  FiInfo,
  FiEdit2,
  FiTag,
  FiMapPin,
  FiCpu,
  FiHash,
  FiBox,
  FiLayers,
  FiActivity,
  FiClock,
  FiTrendingUp,
  FiEyeOff,
  FiGrid,
  FiRefreshCw,
  FiZoomIn,
  FiZoomOut,
  FiRotateCcw,
  FiChevronLeft,
} from "react-icons/fi";

import "./Monitoring.css";
import { VPN_STATUS_META } from "../components/charts/chartColors";
import useCameraList from "../hooks/useCameraList";
import EditableCameraName from "../components/EditableCameraName";
import LoadStateNotice from "../components/LoadStateNotice";
import PrivacyZoneModal from "../components/privacy/PrivacyZoneModal";
import useServerResource from "../hooks/useServerResource";
import { getPrivacyZones } from "../api/privacyZoneApi";
import useWebRtcStream from "../hooks/useWebRtcStream";
import { formatLastSeen, formatUptime } from "../utils/formatDateTime";
import { formatMac } from "../utils/mac";
import useDigitalZoom, { MIN_ZOOM, MAX_ZOOM } from "../hooks/useDigitalZoom";
import { updateCameraName } from "../api/cameraApi";

// useWebRtcStream 상태 → 화면 문구
const STREAM_STATUS_LABEL = {
  idle: "연결 안 함 (오프라인)",
  connecting: "연결 중",
  connected: "재생 중",
  reconnecting: "재연결 중",
  failed: "연결 실패",
  paused: "연결 대기 (VPN 끊김)",
  noUrl: "영상 주소 없음",
};

// 영상 위에 띄우는 안내 (재생 중 · 오프라인일 때는 띄우지 않음)
const STREAM_OVERLAY_TEXT = {
  connecting: "영상 연결 중...",
  reconnecting: "영상 연결이 끊겨 다시 연결하는 중...",
  failed: "영상 연결에 실패했습니다. 자동으로 계속 다시 시도합니다. 새로고침을 누르면 바로 다시 연결합니다.",
  paused: "Client VPN 연결이 끊겨 영상 연결을 멈췄습니다. VPN 연결을 다시 확인하면 자동으로 연결합니다.",
  noUrl: "서버가 이 보드의 영상 주소(webrtc_url)를 보내지 않아 재생할 수 없습니다.",
};

function Monitoring() {
  const { cameraId } = useParams();
  const navigate = useNavigate();

  // 보드 목록 — 5초마다 자동 재조회해서 상태 / 마지막 수신 시간을 갱신한다
  const { cameras, source, errorMessage, isListReady } = useCameraList();

  // URL의 :cameraId는 문자열이라 device_id(숫자 또는 문자열)와 문자열로 비교한다
  const liveCamera = cameras.find(
    (item) => String(item.device_id) === cameraId
  );

  // 이름은 아직 화면에서만 수정 (자동 재조회가 덮어쓰지 않도록 따로 둔다)
  const [nameOverride, setNameOverride] = useState(null);

  const camera = liveCamera
    ? { ...liveCamera, ...(nameOverride !== null && { name: nameOverride }) }
    : null;

  const [currentTime, setCurrentTime] = useState(new Date());

  const [isEditingName, setIsEditingName] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [streamKey, setStreamKey] = useState(0);

  // 실시간 영상 (WebRTC / WHEP) — camera.webrtcUrl 이 WHEP 엔드포인트 주소 (2.2.1 webrtc_url, 예: http://10.0.0.100:8889/CAM-E099/whep)
  // offline 보드는 주소 대신 null 을 넘겨 연결하지 않는다 (멀티뷰 CameraCard 와 같음)
  // 끊기면 훅이 자동으로 다시 연결하고, 새로고침 버튼(streamKey)은 즉시 처음부터 다시 연결한다
  const videoRef = useRef(null);
  const isLiveOnline = liveCamera?.status === "online";
  const streamStatus = useWebRtcStream(
    videoRef,
    isLiveOnline ? liveCamera.webrtcUrl : null,
    streamKey
  );

  // 화면 표시용 상태. online인데 webrtc_url이 null이면 훅은 idle(오프라인과 같음)이라 따로 구분한다
  const streamView = isLiveOnline && !liveCamera.webrtcUrl ? "noUrl" : streamStatus;

  // 디지털 줌
  const stageRef = useRef(null);
  const zoom = useDigitalZoom(stageRef);
  const resetZoom = zoom.reset;

  // 프라이버시 존 (WEB-F-024, ICD 2.6.1) — 보드 MAC을 알게 되면 서버에서 받는다
  // 실패하면 15초마다 다시 시도한다 (useServerResource)
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const liveMac = liveCamera?.mac ?? "";
  // 응답에 보드 MAC을 붙여 두어, 카메라를 바꾼 직후 이전 보드의 영역을 그리지 않게 한다
  const {
    data: zoneResult,
    source: zoneSource,
    setData: setZoneResult,
  } = useServerResource(
    async (options) =>
      liveMac ? { mac: liveMac, zones: await getPrivacyZones(liveMac, options) } : null,
    { key: liveMac }
  );
  const isZoneReady = Boolean(liveMac) && zoneResult?.mac === liveMac;
  const privacyZones = isZoneReady ? zoneResult.zones : [];
  const setPrivacyZones = (zones) => setZoneResult({ mac: liveMac, zones });


  // URL에서 다른 카메라로 이동했을 때 정보 갱신
  useEffect(() => {
    setNameOverride(null);
    setIsEditingName(false);
    resetZoom();
  }, [cameraId, resetZoom]);


  // 현재 날짜 / 시간
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);


  if (!camera) {
    return (
      <main className="monitoring-page">
        {isListReady ? (
          <p>찾을 수 없는 카메라입니다.</p>
        ) : (
          <LoadStateNotice source={source} subject="카메라 정보를" message={errorMessage} />
        )}

        <button
          type="button"
          onClick={() => navigate("/multiview")}
        >
          Back to MultiView
        </button>
      </main>
    );
  }


  // 이름 수정
  async function handleNameSave(newName) {
    try { await updateCameraName(camera.mac, newName); }
    catch (error) { return; }
    setNameOverride(newName);

    setIsEditingName(false);

    // 나중에 API
    // await updateCameraName(camera.mac, newName);
  }


  // 스트림 새로고침
  function handleStreamRefresh() {
    if (isRefreshing) return;

    setIsRefreshing(true);

    // streamKey 가 바뀌면 useWebRtcStream 이 WebRTC 연결을 끊고 다시 연결
    setStreamKey((prev) => prev + 1);

    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  }


  const formattedTime = currentTime.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });


  const isOnline = camera.status === "online";

  const isVpnConnected =
    camera.vpn_status === "connected";

  // VPN 상태 이름은 모든 화면 공통 (정상 / 연결 끊김 / 오류)
  const vpnStatusLabel =
    VPN_STATUS_META[camera.vpn_status]?.label ??
    (isVpnConnected ? VPN_STATUS_META.connected.label : VPN_STATUS_META.disconnected.label);


  return (
    <main className="monitoring-page">

      {/* 상단 카메라 상태 */}
      <div className="monitoring-header">

        <div className="monitoring-title-area">
          <span className="monitoring-title-icon">
            <FiVideo />
          </span>

          <h2>{camera.name}</h2>

          <span className="live-badge">
            <span className="live-dot" />
            LIVE
          </span>

          <span
            className={`connection-badge ${
              isOnline ? "connected" : "disconnected"
            }`}
          >
            {isOnline ? <FiWifi /> : <FiWifiOff />}
            {isOnline ? "Online" : "Offline"}
          </span>

          <span
            className={`connection-badge ${
              isVpnConnected
                ? "connected"
                : "disconnected"
            }`}
          >
            {isVpnConnected ? <FiShield /> : <FiShieldOff />}
            VPN {vpnStatusLabel}
          </span>
        </div>

        <button
          type="button"
          className="back-to-multiview-button"
          onClick={() => navigate("/multiview")}
        >
          <FiChevronLeft />
          멀티뷰
        </button>

      </div>


      <div className="monitoring-content">

        {/* ================= 영상 영역 ================= */}

        <section className="video-section">

          <div className="real-time-video">

            {/* 줌 영역 — 프라이버시 존 마스킹은 보드가 영상에 직접 적용해서 보내므로 화면에서는 덮지 않는다 */}
            <div
              ref={stageRef}
              className={`zoom-stage${zoom.isZoomed ? " zoomed" : ""}${
                zoom.isPanning ? " panning" : ""
              }`}
              {...zoom.stageHandlers}
            >
              <div
                className="zoom-layer"
                style={zoom.layerStyle}
              >

                {streamStatus === "idle" ? (
                  <div className="video-placeholder">
                    <FiVideo />
                    Video Stream
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    className="video-player"
                    autoPlay
                    muted
                    playsInline
                    disablePictureInPicture
                  />
                )}

              </div>
            </div>


            {/* 연결 상태 안내 */}

            {STREAM_OVERLAY_TEXT[streamView] && (
              <div className={`stream-status ${streamView}`}>
                {STREAM_OVERLAY_TEXT[streamView]}
              </div>
            )}


            {/* 좌측 상단 LIVE + 현재시간 */}

            <div className="video-time">

              <span className="video-live">
                <span className="live-dot" />
                LIVE
              </span>

              <span>
                {formattedTime}
              </span>

            </div>


            {/* 왼쪽 하단 디지털 줌 */}

            <div
              className="zoom-controls"
              title="휠: 확대/축소 · 드래그: 이동 · 더블클릭: 2배/원래대로"
            >
              <button
                type="button"
                className="zoom-button"
                onClick={zoom.zoomOut}
                disabled={zoom.scale <= MIN_ZOOM}
                aria-label="축소"
              >
                <FiZoomOut />
              </button>

              <span className="zoom-level">
                {Math.round(zoom.scale * 100)}%
              </span>

              <button
                type="button"
                className="zoom-button"
                onClick={zoom.zoomIn}
                disabled={zoom.scale >= MAX_ZOOM}
                aria-label="확대"
              >
                <FiZoomIn />
              </button>

              <button
                type="button"
                className="zoom-button"
                onClick={zoom.reset}
                disabled={!zoom.isZoomed}
                aria-label="원래 크기"
              >
                <FiRotateCcw />
              </button>
            </div>


            {/* 오른쪽 하단 새로고침 */}

            <button
              type="button"
              className="stream-refresh-button"
              onClick={handleStreamRefresh}
            >
              <span
                className={
                  isRefreshing
                    ? "stream-refresh-icon rotating"
                    : "stream-refresh-icon"
                }
              >
                <FiRefreshCw />
              </span>

              {isRefreshing
                ? "재연결 중"
                : "새로고침"}
            </button>

          </div>

        </section>


        {/* ================= 정보 영역 ================= */}

        <aside className="camera-info-panel">

          <div className="info-panel-header">

            <h3>
              <FiInfo />
              카메라 정보
            </h3>

            <button
              type="button"
              className="edit-name-button"
              onClick={() => setIsEditingName(true)}
              disabled={isEditingName}
              aria-hidden={isEditingName}
              tabIndex={isEditingName ? -1 : 0}
            >
              <FiEdit2 />
              이름 수정
            </button>

          </div>


          {/* 이름 */}

          <div className="info-row">

            <span className="info-label">
              <FiTag />
              카메라 이름
            </span>

            <EditableCameraName
              className="info-name"
              initialName={camera.name}
              isEditing={isEditingName}
              onSave={handleNameSave}
              onCancel={() => setIsEditingName(false)}
            />

          </div>


          <div className="info-row">
            <span className="info-label">
              <FiMapPin />
              설치 위치
            </span>

            <span className="info-value">
              {camera.location ?? "-"}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              <FiCpu />
              보드 ID
            </span>

            <span className="info-value">
              {camera.device_id ?? "-"}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              <FiHash />
              MAC 주소
            </span>

            <span className="info-value">
              {camera.mac ? formatMac(camera.mac) : "-"}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              <FiBox />
              VPN IP
            </span>

            <span className="info-value">
              {camera.vpn_ip ?? "-"}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              <FiLayers />
              펌웨어 버전
            </span>

            <span className="info-value">
              {camera.firmware_version ?? "-"}
            </span>
          </div>


          {/* 상태 정보 */}

          <div className="info-section-title">
            <FiActivity />
            상태 정보
          </div>


          <div className="info-row">
            <span className="info-label">
              <FiWifi />
              온라인 상태
            </span>

            <span
              className={`status-value ${
                isOnline ? "online" : "offline"
              }`}
            >
              <span className="status-dot" />

              {isOnline
                ? "Online"
                : "Offline"}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              <FiShield />
              VPN 상태
            </span>

            <span
              className={`status-value ${
                isVpnConnected
                  ? "online"
                  : "offline"
              }`}
            >
              <span className="status-dot" />

              {vpnStatusLabel}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              <FiVideo />
              영상
            </span>

            <span
              className={`status-value ${
                streamStatus === "connected" ? "online" : "offline"
              }`}
            >
              <span className="status-dot" />

              {STREAM_STATUS_LABEL[streamView]}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              <FiClock />
              마지막 수신 시간
            </span>

            <span className="info-value">
              {formatLastSeen(camera.last_seen)}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              <FiTrendingUp />
              업타임
            </span>

            <span className="info-value">
              {/* 2.2.3 보드 상태 조회(uptime_seconds) 연결 전까지는 "-" */}
              {formatUptime(camera.uptime_seconds)}
            </span>
          </div>


          {/* 프라이버시 존 (WEB-F-024) */}

          <div className="info-section-title">
            <FiEyeOff />
            프라이버시 존
          </div>

          <div className="info-row">
            <span className="info-label">
              <FiGrid />
              설정된 영역
            </span>

            <span className="info-value">
              {isZoneReady
                ? `${privacyZones.length}개 (활성 ${privacyZones.filter((zone) => zone.enabled).length}개)`
                : zoneSource === "error"
                  ? "불러오지 못했습니다"
                  : "불러오는 중..."}
            </span>
          </div>

          <button
            type="button"
            className="privacy-zone-button"
            onClick={() => setIsPrivacyOpen(true)}
          >
            <FiEyeOff />
            프라이버시 존 설정
          </button>

        </aside>

      </div>

      {isPrivacyOpen && (
        <PrivacyZoneModal
          camera={camera}
          onClose={() => setIsPrivacyOpen(false)}
          onSaved={setPrivacyZones}
        />
      )}

    </main>
  );
}

export default Monitoring;
