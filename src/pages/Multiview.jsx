//카메라 32대 보여주는 화면
import "./Multiview.css";

import { useState } from "react";
import CameraCard from "../components/CameraCard";
import Pagination from "../components/Pagination";
import { cameras as initialCameras } from "../data/cameras";
// import { getCameras } from "../api/cameraApi";  // 서버 연결 후 주석 해제

// 채널 수별 한 페이지 배치 (가로 x 세로)
const CHANNEL_LAYOUTS = {
  2: { cols: 2, rows: 1 },
  4: { cols: 2, rows: 2 },
  6: { cols: 3, rows: 2 },
};

function Multiview() {

  const [cameras, setCameras] = useState(initialCameras);
  const [channelCount, setChannelCount] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);

  const { cols, rows } = CHANNEL_LAYOUTS[channelCount];

  const camerasPerPage = cols * rows;

  const filteredCameras = cameras.filter((camera) => {
    const keyword = searchKeyword.toLowerCase();

    const matchesSearch = 
      camera.name.toLowerCase().includes(keyword) ||
      camera.hwnum.toLowerCase().includes(keyword);

    const matchesOnline = 
    !onlineOnly || camera.status === "online";

    return matchesSearch && matchesOnline;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCameras.length / camerasPerPage)
  );

  const startIndex = (currentPage - 1) * camerasPerPage;
  const endIndex = startIndex + camerasPerPage;

  const currentCameras = filteredCameras.slice (
    startIndex,
    endIndex
  );
  
  const totalBoards = cameras.length;

  const onlineBoards = cameras.filter(
    (camera) => camera.status === "online"
  ).length;

  const offlineBoards = cameras.filter(
    (camera) => camera.status === "offline"
  ).length;

  function handleChannelChange(count) {
    setChannelCount(count);
    setCurrentPage(1);
  }

  function handleSearchChange(e) {
    setSearchKeyword(e.target.value);
    setCurrentPage(1);
  }

  function handleOnlineFilter() {
    setOnlineOnly((prev) => !prev);
    setCurrentPage(1);
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
      <section className="board-summary">
        <div className="summary-card">
          <span className="summary-title">전체 보드</span>
          <strong className="summary-value">{totalBoards}</strong>
          <span className="summary-unit">대</span>
        </div>

        <div className="summary-card online">
          <span className="summary-title">온라인</span>
          <strong className="summary-value">{onlineBoards}</strong>
          <span className="summary-unit">대</span>
        </div>

        <div className="summary-card offline">
          <span className="summary-title">오프라인</span>
          <strong className="summary-value">{offlineBoards}</strong>
          <span className="summary-unit">대</span>
        </div>
      </section>

    <div className="multiview-toolbar">
      <div className="channel-selector">
        {Object.keys(CHANNEL_LAYOUTS).map((count) => (
          <button
            key={count}
            className={channelCount === Number(count) ? "active" : ""}
            onClick={() => handleChannelChange(Number(count))}
          >
            {count}채널
          </button>
        ))}
      </div>

      <div className="camera-search">
        <input
          type="text"
          placeholder="카메라 검색"
          value={searchKeyword}
          onChange={handleSearchChange}
        />
      </div>

      <button
        className={`filter-button ${onlineOnly ? "active" : ""}`}
        onClick={handleOnlineFilter}
      >
        ● 온라인 기기만 보기
      </button>
    </div>

    
    <div className="camera-container">
      <main 
        className="camera-list"
        style={{ "--cols": cols, "--rows": rows }}
      >
        {currentCameras.map((camera) => (
          <CameraCard key={camera.id} camera={camera} />
        ))}
      </main>
    </div>

    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
    </div>
  );
}

export default Multiview;