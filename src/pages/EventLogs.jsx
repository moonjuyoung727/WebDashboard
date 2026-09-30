import "./EventLogs.css";
import Pagination from "../components/Pagination";

import { useEffect, useMemo, useState } from "react";

import {
  FiSearch,
  FiRefreshCw,
  FiVolume2,
  FiActivity,
  FiShield,
  FiVideo,
  FiX,
  FiPlayCircle,
} from "react-icons/fi";

import { eventLogs as initialEventLogs } from "../data/eventLogs";
// import { getEvents } from "../api/eventApi";  // 서버 연결 후 주석 해제
// import { bulkUpdateEventStatus } from "../api/eventApi";  // 서버 연결 후 주석 해제 (WEB-F-033)
import EventMediaModal from "../components/events/EventMediaModal";
import "../components/Modal.css";


function EventLogs() {
  const [events, setEvents] = useState(initialEventLogs);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [selectedEvent, setSelectedEvent] = useState(null);

  const [cameraFilter, setCameraFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [memo, setMemo] = useState("");

  // WEB-F-033 일괄 상태 변경용 선택 목록
  const [checkedIds, setCheckedIds] = useState([]);

  // WEB-F-032 미디어 상세 보기 (snapshot | video)
  const [mediaTab, setMediaTab] = useState(null);

  /*
  const [events, setEvents] = useState([]);

  useEffect(() => {
    async function getEvents() {
      try {
        const data = await getEvents();

        setEvents(data);
      } catch (error) {
        console.error(error);
      }
    }
    getEvents();
  }, []);
  */

  useEffect(() => {
    setCurrentPage(1);
  }, [
    cameraFilter,
    typeFilter,
    statusFilter,
    searchTerm,
    itemsPerPage,
  ]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchCamera =
        cameraFilter === "all" ||
        String(event.cameraId) === cameraFilter;

      const matchType =
        typeFilter === "all" ||
        event.type === typeFilter;

      const matchStatus =
        statusFilter === "all" ||
        event.status === statusFilter;

      const keyword = searchTerm.toLowerCase();

      const matchSearch =
        event.cameraName.toLowerCase().includes(keyword) ||
        event.location.toLowerCase().includes(keyword) ||
        event.description.toLowerCase().includes(keyword);

      return (
        matchCamera &&
        matchType &&
        matchStatus &&
        matchSearch
      );
    });
  }, [
    events,
    cameraFilter,
    typeFilter,
    statusFilter,
    searchTerm,
  ]);

  const totalPages = Math.max(
    1, Math.ceil(filteredEvents.length / itemsPerPage)
  );

  const currentEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    return filteredEvents.slice(startIndex, endIndex);
  }, [filteredEvents, currentPage, itemsPerPage]);

  function handleSelectEvent(event) {
    setSelectedEvent(event);
    setMemo(event.memo ?? "");
  }


  function handleStatusChange(status) {
    if (!selectedEvent) return;

    setEvents((prev) =>
      prev.map((event) =>
        event.id === selectedEvent.id
          ? { ...event, status }
          : event
      )
    );

    setSelectedEvent((prev) => ({
      ...prev,
      status,
    }));
  }


  function handleSaveMemo() {
    if (!selectedEvent) return;

    setEvents((prev) =>
      prev.map((event) =>
        event.id === selectedEvent.id
          ? { ...event, memo }
          : event
      )
    );

    setSelectedEvent((prev) => ({
      ...prev,
      memo,
    }));
  }


  /* ---------- WEB-F-033 일괄 상태 변경 ---------- */

  const currentPageIds = currentEvents.map((event) => event.id);

  const isAllChecked =
    currentPageIds.length > 0 &&
    currentPageIds.every((id) => checkedIds.includes(id));

  function handleToggleCheck(eventId) {
    setCheckedIds((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  }

  function handleToggleAll() {
    setCheckedIds((prev) =>
      isAllChecked
        ? prev.filter((id) => !currentPageIds.includes(id))
        : [...new Set([...prev, ...currentPageIds])]
    );
  }

  function handleBulkStatusChange(status) {
    setEvents((prev) =>
      prev.map((event) =>
        checkedIds.includes(event.id)
          ? { ...event, status }
          : event
      )
    );

    if (selectedEvent && checkedIds.includes(selectedEvent.id)) {
      setSelectedEvent((prev) => ({ ...prev, status }));
    }

    setCheckedIds([]);

    /* 서버 연결 후
    try {
      const result = await bulkUpdateEventStatus(checkedIds, status);
      // result.updatedIds 기준으로 상태 반영
    } catch (error) {
      console.error(error);
    }
    */
  }


  function handleResetFilter() {
    setCameraFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setSearchTerm("");
  }


  return (
    <section className="event-page">

      {/* 상단 검색 / 기간 */}
      <div className="event-toolbar">

        <div className="period-filter">
          <span className="filter-label">기간 선택</span>

          <button className="period-button active">
            오늘
          </button>

          <button className="period-button">
            최근 7일
          </button>

          <button className="period-button">
            최근 30일
          </button>

          <button className="period-button">
            최근 60일
          </button>

          <input
            className="date-input"
            type="date"
          />
        </div>


        <div className="event-search">
          <input
            type="text"
            placeholder="검색어를 입력하세요."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <FiSearch />
        </div>

      </div>


      {/* 필터 */}
      <div className="event-filter-row">

        <div className="filter-item">
          <label>카메라 선택</label>

          <select
            value={cameraFilter}
            onChange={(e) => setCameraFilter(e.target.value)}
          >
            <option value="all">전체 카메라</option>
            <option value="1">CAM-01</option>
            <option value="2">CAM-02</option>
            <option value="3">CAM-03</option>
            <option value="4">CAM-04</option>
            <option value="5">CAM-05</option>
          </select>
        </div>


        <div className="filter-item">
          <label>이벤트 종류</label>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">전체</option>
            <option value="motion">움직임 감지</option>
            <option value="sound">소리 감지</option>
            <option value="vpn_connect">VPN 연결</option>
            <option value="vpn_disconnect">
              VPN 연결 끊김
            </option>
            <option value="camera_connect">
              카메라 연결
            </option>
            <option value="camera_disconnect">
              카메라 연결 끊김
            </option>
          </select>
        </div>


        <div className="filter-item">
          <label>처리 여부</label>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">전체</option>
            <option value="unconfirmed">미확인</option>
            <option value="confirmed">확인 완료</option>
          </select>
        </div>


        <button
          className="reset-filter-button"
          onClick={handleResetFilter}
        >
          <FiRefreshCw />
          필터 초기화
        </button>

      </div>


      {/* WEB-F-033 일괄 처리 바 */}
      {checkedIds.length > 0 && (
        <div className="event-bulk-bar">
          <strong>{checkedIds.length}건 선택됨</strong>

          <button
            type="button"
            className="btn small"
            onClick={() => handleBulkStatusChange("confirmed")}
          >
            확인 완료로 변경
          </button>

          <button
            type="button"
            className="btn small"
            onClick={() => handleBulkStatusChange("unconfirmed")}
          >
            미확인으로 변경
          </button>

          <button
            type="button"
            className="event-bulk-clear"
            onClick={() => setCheckedIds([])}
          >
            선택 해제
          </button>
        </div>
      )}


      {/* 테이블 */}
      <div className="event-table-wrapper">

        <table className="event-table">

          <thead>
            <tr>
              <th className="event-check-cell">
                <input
                  type="checkbox"
                  checked={isAllChecked}
                  onChange={handleToggleAll}
                  aria-label="현재 페이지 전체 선택"
                />
              </th>
              <th>시간</th>
              <th>카메라</th>
              <th>이벤트</th>
              <th>상태</th>
            </tr>
          </thead>

          <tbody>
            {currentEvents.map((event) => (
              <tr
                key={event.id}
                className={
                  selectedEvent?.id === event.id
                    ? "selected"
                    : ""
                }
                onClick={() => handleSelectEvent(event)}
              >
                <td
                  className="event-check-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={checkedIds.includes(event.id)}
                    onChange={() => handleToggleCheck(event.id)}
                    aria-label={`${event.id}번 이벤트 선택`}
                  />
                </td>
                <td>{formatDateTime(event.occurredAt)}</td>

                <td>
                  {event.cameraName} ({event.location})
                </td>

                <td>
                  <div className="event-type">
                    {getEventIcon(event.type)}
                    {getEventLabel(event.type)}
                  </div>
                </td>

                <td>
                  <span
                    className={`event-status ${event.status}`}
                  >
                    {event.status === "confirmed"
                      ? "확인 완료"
                      : "미확인"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>

        </table>

      </div>


      {/* 나중에 기존 Pagination 컴포넌트 사용 */}
      <div className="event-pagination-wrapper">
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredEvents.length}
        />
      </div>


      {/* 이벤트 상세 */}
      {selectedEvent && (
        <aside className="event-detail-panel">

          <div className="event-detail-header">
            <h2>이벤트 상세</h2>

            <button
              className="detail-close-button"
              onClick={() => setSelectedEvent(null)}
            >
              <FiX />
            </button>
          </div>


          <div className="detail-info-row">
            <span>이벤트 발생 시간</span>
            <strong>
              {formatDateTime(selectedEvent.occurredAt)}
            </strong>
          </div>

          <div className="detail-info-row">
            <span>카메라 이름</span>
            <strong>
              {selectedEvent.cameraName}
              {" "}
              ({selectedEvent.location})
            </strong>
          </div>

          <div className="detail-info-row">
            <span>이벤트 종류</span>

            <strong className="event-type">
              {getEventIcon(selectedEvent.type)}
              {getEventLabel(selectedEvent.type)}
            </strong>
          </div>


          <div className="detail-description">
            <span>상세 설명</span>

            <p>
              {selectedEvent.description}
            </p>
          </div>


          {selectedEvent.snapshotUrl && (
            <div className="snapshot-section">

              <h3>스냅샷 이미지</h3>

              <img
                src={selectedEvent.snapshotUrl}
                alt="이벤트 스냅샷"
                onClick={() => setMediaTab("snapshot")}
              />

              <button
                className="video-button"
                onClick={() => setMediaTab("video")}
              >
                <FiPlayCircle />
                영상 보기
              </button>

            </div>
          )}


          <div className="detail-status-section">

            <h3>상태 처리</h3>

            <div className="detail-status-buttons">

              <button
                className={
                  selectedEvent.status === "unconfirmed"
                    ? "status-button unconfirmed active"
                    : "status-button"
                }
                onClick={() =>
                  handleStatusChange("unconfirmed")
                }
              >
                미확인
              </button>

              <button
                className={
                  selectedEvent.status === "confirmed"
                    ? "status-button confirmed active"
                    : "status-button"
                }
                onClick={() =>
                  handleStatusChange("confirmed")
                }
              >
                확인 완료
              </button>

            </div>

          </div>


          <div className="memo-section">

            <h3>메모</h3>

            <textarea
              value={memo}
              maxLength={500}
              placeholder="메모 입력"
              onChange={(e) => setMemo(e.target.value)}
            />

            <span className="memo-count">
              {memo.length} / 500
            </span>

            <button
              className="memo-save-button"
              onClick={handleSaveMemo}
            >
              저장
            </button>

          </div>

        </aside>
      )}


      {/* WEB-F-032 스냅샷 / 영상 상세 보기 */}
      {selectedEvent && mediaTab && (
        <EventMediaModal
          event={selectedEvent}
          initialTab={mediaTab}
          onClose={() => setMediaTab(null)}
        />
      )}

    </section>
  );
}


function getEventLabel(type) {
  const labels = {
    motion: "움직임 감지",
    sound: "소리 감지",
    vpn_connect: "VPN 연결",
    vpn_disconnect: "VPN 연결 끊김",
    camera_connect: "카메라 연결",
    camera_disconnect: "카메라 연결 끊김",
  };

  return labels[type] ?? type;
}


function getEventIcon(type) {
  switch (type) {
    case "motion":
      return <FiActivity />;

    case "sound":
      return <FiVolume2 />;

    case "vpn_connect":
    case "vpn_disconnect":
      return <FiShield />;

    case "camera_connect":
    case "camera_disconnect":
      return <FiVideo />;

    default:
      return null;
  }
}


function formatDateTime(dateString) {
  return dateString
    .replace("T", " ")
    .slice(0, 19);
}


export default EventLogs;