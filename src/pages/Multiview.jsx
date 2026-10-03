//카메라 여러 대를 한 화면에서 보는 멀티뷰
import "./Multiview.css";

import { useEffect, useRef, useState } from "react";
import {
  FiVideo,
  FiWifi,
  FiWifiOff,
  FiSearch,
  FiMaximize,
  FiMinimize,
  FiChevronLeft,
  FiChevronRight,
  FiX,
} from "react-icons/fi";

import CameraCard from "../components/CameraCard";
import { EVENT_TYPE_META } from "../components/charts/chartColors";
import { cameras as initialCameras } from "../data/cameras";
import { eventLogs } from "../data/eventLogs";
import { getDeviceVpnList } from "../data/statisticsMock";
// import { getCameras } from "../api/cameraApi";  // 서버 연결 후 주석 해제

// 채널 수별 한 페이지 배치 (가로 x 세로)
const CHANNEL_LAYOUTS = {
  2: { cols: 2, rows: 1 },
  4: { cols: 2, rows: 2 },
  6: { cols: 3, rows: 2 },
};

const STATUS_FILTERS = [
  { key: "all", label: "전체" },
  { key: "online", label: "온라인" },
  { key: "offline", label: "오프라인" },
];

/* 대시보드와 같은 목업 소스 사용 (서버 연결 후 API 응답으로 교체) */

// Device VPN 상태 (대시보드 WEB-F-003 과 동일)
const VPN_STATUS_BY_ID = new Map(
  getDeviceVpnList().map((device) => [device.cameraId, device.vpnStatus])
);

// 카메라별 가장 최근 이벤트 (대시보드 최근 발생 이벤트와 동일한 이벤트 로그)
const LATEST_EVENT_BY_ID = eventLogs.reduce((map, event) => {
  const prev = map.get(event.cameraId);

  if (!prev || event.occurredAt > prev.occurredAt) {
    map.set(event.cameraId, event);
  }

  return map;
}, new Map());

function formatRecentEvent(event) {
  if (!event) {
    return null;
  }

  const label = EVENT_TYPE_META[event.type]?.label ?? event.type;

  return `${label} · ${event.occurredAt.replace("T", " ").slice(5, 16)}`;
}

function Multiview() {

  const [cameras, setCameras] = useState(initialCameras);
  const [channelCount, setChannelCount] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const gridRef = useRef(null);

  const { cols, rows } = CHANNEL_LAYOUTS[channelCount];

  const camerasPerPage = cols * rows;

  // 채널 번호는 필터와 상관없이 전체 목록 순서로 고정
  const channelNo = new Map(cameras.map((camera, i) => [camera.id, i + 1]));

  const filteredCameras = cameras.filter((camera) => {
    const keyword = searchKeyword.trim().toLowerCase();

    const matchesSearch =
      camera.name.toLowerCase().includes(keyword) ||
      camera.hwnum.toLowerCase().includes(keyword) ||
      (camera.location ?? "").toLowerCase().includes(keyword);

    const matchesStatus =
      statusFilter === "all" || camera.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCameras.length / camerasPerPage)
  );

  const startIndex = (currentPage - 1) * camerasPerPage;
  const endIndex = startIndex + camerasPerPage;

  const currentCameras = filteredCameras.slice(startIndex, endIndex);

  // 마지막 페이지가 덜 찼을 때 빈 채널로 자리를 채움
  const emptySlots = camerasPerPage - currentCameras.length;

  const totalBoards = cameras.length;

  const onlineBoards = cameras.filter(
    (camera) => camera.status === "online"
  ).length;

  const offlineBoards = totalBoards - onlineBoards;

  const stats = [
    { key: "all", label: "전체 카메라", value: totalBoards, icon: <FiVideo /> },
    { key: "online", label: "온라인", value: onlineBoards, icon: <FiWifi /> },
    { key: "offline", label: "오프라인", value: offlineBoards, icon: <FiWifiOff /> },
  ];

  // 화면 시계 (영상 위 타임스탬프)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 필터로 페이지 수가 줄어들면 마지막 페이지로
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // ESC 등으로 전체 화면이 풀린 경우도 반영
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === gridRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // 목록에서 선택한 카메라 강조는 잠깐만
  useEffect(() => {
    if (highlightId === null) {
      return undefined;
    }

    const timer = setTimeout(() => setHighlightId(null), 1600);
    return () => clearTimeout(timer);
  }, [highlightId]);

  function resetPage() {
    setCurrentPage(1);
  }

  function handleChannelChange(count) {
    setChannelCount(count);
    resetPage();
  }

  function handleSearchChange(e) {
    setSearchKeyword(e.target.value);
    resetPage();
  }

  function handleStatusFilter(key) {
    setStatusFilter(key);
    resetPage();
  }

  // 목록에서 카메라를 누르면 그 카메라가 있는 페이지로 이동
  function handleSelectCamera(cameraId) {
    const index = filteredCameras.findIndex((camera) => camera.id === cameraId);

    if (index === -1) {
      return;
    }

    setCurrentPage(Math.floor(index / camerasPerPage) + 1);
    setHighlightId(cameraId);
  }

  function handleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      gridRef.current?.requestFullscreen?.();
    }
  }

  // const [cameras, setCameras] = useState([]);

  // useEffect(() => {
  //   async function getCameras() {
  //     const data = await getCameras();

  //     setCameras(data);
  //   }

  //   getCameras();
  // }, []);

  return (
    <div className="multiview">

      <div className="mv-main">
        {/* 상단: 요약 · 화면 분할 · 페이지 */}
        <div className="mv-toolbar">
          <div className="mv-stats">
            {stats.map((stat) => (
              <div key={stat.key} className={`mv-stat ${stat.key}`}>
                <span className="mv-stat-icon">{stat.icon}</span>
                <span className="mv-stat-label">{stat.label}</span>
                <strong>
                  {stat.value}
                  <small>대</small>
                </strong>
              </div>
            ))}
          </div>

          <div className="mv-controls">
            <div className="mv-pager">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                aria-label="이전 페이지"
              >
                <FiChevronLeft />
              </button>

              <span className="mv-pager-text">
                <strong>{currentPage}</strong> / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                aria-label="다음 페이지"
              >
                <FiChevronRight />
              </button>
            </div>

            <div className="mv-layouts" role="group" aria-label="화면 분할">
              {Object.entries(CHANNEL_LAYOUTS).map(([count, layout]) => (
                <button
                  type="button"
                  key={count}
                  className={channelCount === Number(count) ? "active" : ""}
                  onClick={() => handleChannelChange(Number(count))}
                  title={`${count}채널`}
                >
                  <span
                    className="mv-layout-icon"
                    style={{ "--icon-cols": layout.cols, "--icon-rows": layout.rows }}
                  >
                    {Array.from({ length: layout.cols * layout.rows }, (_, i) => (
                      <span key={i} />
                    ))}
                  </span>
                  {count}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="mv-tool-button icon-only"
              onClick={handleFullscreen}
              title={isFullscreen ? "전체 화면 종료" : "전체 화면"}
              aria-label={isFullscreen ? "전체 화면 종료" : "전체 화면"}
            >
              {isFullscreen ? <FiMinimize /> : <FiMaximize />}
            </button>
          </div>
        </div>


        {/* 영상 그리드 */}
        <section
          ref={gridRef}
          className="mv-grid"
          style={{ "--cols": cols, "--rows": rows }}
        >
          {currentCameras.map((camera) => (
            <CameraCard
              key={camera.id}
              camera={{
                ...camera,
                vpnStatus: VPN_STATUS_BY_ID.get(camera.id) ?? camera.vpnStatus,
              }}
              recentEvent={formatRecentEvent(LATEST_EVENT_BY_ID.get(camera.id))}
              channel={channelNo.get(camera.id)}
              now={now}
              highlighted={highlightId === camera.id}
            />
          ))}

          {Array.from({ length: emptySlots }, (_, i) => (
            <div key={`empty-${i}`} className="mv-empty-slot">
              <FiVideo />
              <span>
                {filteredCameras.length === 0 && i === 0
                  ? "조건에 맞는 카메라가 없습니다"
                  : "빈 채널"}
              </span>
            </div>
          ))}
        </section>
      </div>


      {/* 채널 목록 */}
      <aside className="mv-panel">
        <div className="mv-panel-header">
          <h3>채널 목록</h3>
          <span>
            {filteredCameras.length} / {totalBoards}
          </span>
        </div>

        <div className="mv-search">
          <FiSearch />
          <input
            type="text"
            placeholder="이름 · 위치 · 기기 번호 검색"
            value={searchKeyword}
            onChange={handleSearchChange}
          />
          {searchKeyword && (
            <button
              type="button"
              onClick={() => {
                setSearchKeyword("");
                resetPage();
              }}
              aria-label="검색어 지우기"
            >
              <FiX />
            </button>
          )}
        </div>

        <div className="mv-filters">
          <div className="mv-segment">
            {STATUS_FILTERS.map((filter) => (
              <button
                type="button"
                key={filter.key}
                className={statusFilter === filter.key ? "active" : ""}
                onClick={() => handleStatusFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="mv-channel-list">
          {filteredCameras.map((camera, index) => {
            const onScreen = index >= startIndex && index < endIndex;

            return (
              <li key={camera.id}>
                <button
                  type="button"
                  className={onScreen ? "on-screen" : ""}
                  onClick={() => handleSelectCamera(camera.id)}
                >
                  <span className={`mv-channel-dot ${camera.status}`} />

                  <span className="mv-channel-main">
                    <strong>{camera.name}</strong>
                    <small>
                      {camera.hwnum}
                      {camera.location ? ` · ${camera.location}` : ""}
                    </small>
                  </span>

                  <span className="mv-channel-no">
                    CH {String(channelNo.get(camera.id)).padStart(2, "0")}
                  </span>
                </button>
              </li>
            );
          })}

          {filteredCameras.length === 0 && (
            <li className="mv-channel-empty">검색 결과가 없습니다.</li>
          )}
        </ul>
      </aside>
    </div>
  );
}

export default Multiview;
