import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiVideo,
  FiWifi,
  FiWifiOff,
  FiActivity,
  FiBell,
  FiChevronRight,
  FiShield,
  FiRefreshCw,
} from "react-icons/fi";

import "./Dashboard.css";
import "../components/Modal.css";

import DonutChart from "../components/charts/DonutChart";
import LoadStateNotice from "../components/LoadStateNotice";
import { EVENT_TYPES, VPN_STATUS_META, getEventTypeMeta } from "../components/charts/chartColors";
import { useVpn } from "../context/VpnContext";
import useCameraList from "../hooks/useCameraList";
import useServerResource from "../hooks/useServerResource";

import { getAllEvents, getEvents } from "../api/eventApi";
import { formatDateTime } from "../utils/formatDateTime";

const PERIODS = [
  { key: "today", label: "오늘", days: 0 },
  { key: "week", label: "7일", days: 6 },
  { key: "month", label: "30일", days: 29 },
];

// 대시보드는 다른 목록 화면(5초)보다 느슨하게 10초마다 보드 목록을 다시 불러온다
const DASHBOARD_POLL_MS = 10000;

// 이벤트는 양이 많아서 더 느슨하게 다시 불러온다
const EVENT_POLL_MS = 30000;

// 날짜 비교는 화면에 보이는 한국 시간 기준 ("YYYY-MM-DD")
const toKstDate = (value) => formatDateTime(value).slice(0, 10);

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return date;
}

// 기간 선택의 최대(30일)만큼 받아 두고 화면에서 나눈다. 대시보드 전용 API는 명세에 없다
async function loadDashboardEvents({ silent }) {
  const [events, unconfirmed] = await Promise.all([
    getAllEvents({ startDate: toKstDate(daysAgo(29)), endDate: toKstDate(new Date()), silent }),
    getEvents({ status: "unconfirmed", page: 1, size: 1, silent }),
  ]);

  return { events, unconfirmedTotal: unconfirmed.total };
}

const CLIENT_VPN_TEXT = {
  connected: { label: "연결됨", desc: "VPN 내부 서버와 정상적으로 연결되어 있습니다." },
  connecting: { label: "확인 중", desc: "VPN 내부 서버 연결을 확인하고 있습니다..." },
  disconnected: { label: "연결 안 됨", desc: "VPN 연결 상태가 확인되지 않았습니다." },
  error: { label: "연결 오류", desc: "VPN 내부 서버에 연결할 수 없습니다. VPN 클라이언트를 확인해주세요." },
};

function Dashboard() {
  const navigate = useNavigate();
  const { peerVpnStatus, checkClientVpn } = useVpn();

  const [period, setPeriod] = useState("today");
  const [vpnFilter, setVpnFilter] = useState("all");

  // 보드 목록 (ICD 2.2.1) — 10초마다 재조회. 서버에 닿지 못하면 비우고 오류 안내
  const { cameras, source, errorMessage, isListReady } = useCameraList({ pollMs: DASHBOARD_POLL_MS });

  // 이벤트 (ICD 2.3.1) — 보드 목록과 따로 실패할 수 있어서 안내도 따로 보여 준다
  const {
    data: eventData,
    source: eventSource,
    errorMessage: eventErrorMessage,
    isReady: isEventReady,
  } = useServerResource(loadDashboardEvents, { pollMs: EVENT_POLL_MS, followAutoRefresh: true });

  const events = useMemo(() => eventData?.events ?? [], [eventData]);

  const summary = useMemo(() => {
    const today = toKstDate(new Date());
    const onlineCameras = cameras.filter((camera) => camera.status === "online").length;

    return {
      totalCameras: cameras.length,
      onlineCameras,
      offlineCameras: cameras.length - onlineCameras,
      todayEvents: events.filter((event) => toKstDate(event.occurredAt) === today).length,
      unreadAlerts: eventData?.unconfirmedTotal ?? 0,
    };
  }, [cameras, events, eventData]);

  // 카드 높이만큼 채워서 보여주고, 화면이 작으면 목록 안에서만 스크롤
  const recentEvents = useMemo(
    () =>
      [...events]
        .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
        .slice(0, 12),
    [events]
  );

  const typeStats = useMemo(() => {
    const from = toKstDate(daysAgo(PERIODS.find((p) => p.key === period).days));
    const counts = new Map(EVENT_TYPES.map((type) => [type, 0]));

    events
      .filter((event) => toKstDate(event.occurredAt) >= from)
      .forEach((event) => counts.set(event.type, (counts.get(event.type) ?? 0) + 1));

    return [...counts].map(([type, value]) => ({
      key: type,
      ...getEventTypeMeta(type),
      value,
    }));
  }, [events, period]);

  // Device VPN 상태: 보드 목록의 vpn_status
  // (오류 유형까지 보려면 2.5.1 GET /vpn/connections 연결 필요)
  const vpnList = useMemo(
    () =>
      cameras.map((camera) => ({
        cameraId: camera.device_id,
        cameraName: camera.name,
        location: camera.location,
        vpnStatus: camera.vpn_status ?? "disconnected",
        error: null,
      })),
    [cameras]
  );

  const vpnStats = Object.entries(VPN_STATUS_META).map(([key, meta]) => {
    const value = vpnList.filter((d) => d.vpnStatus === key).length;

    return {
      key,
      label: meta.label,
      color: meta.color,
      value,
      percent: vpnList.length === 0 ? 0 : (value / vpnList.length) * 100,
    };
  });

  // 문제 있는 기기를 먼저 보여줌
  const statusOrder = { error: 0, disconnected: 1, connected: 2 };

  const filteredVpnList = vpnList
    .filter((d) => vpnFilter === "all" || d.vpnStatus === vpnFilter)
    .sort((a, b) => statusOrder[a.vpnStatus] - statusOrder[b.vpnStatus]);

  const clientVpn = CLIENT_VPN_TEXT[peerVpnStatus] ?? CLIENT_VPN_TEXT.disconnected;

  const summaryCards = [
    { key: "total", label: "전체 카메라", ready: isListReady, value: summary.totalCameras, unit: "대", icon: <FiVideo />, to: "/devices" },
    { key: "online", label: "온라인", ready: isListReady, value: summary.onlineCameras, unit: "대", icon: <FiWifi />, to: "/multiview", tone: "online" },
    { key: "offline", label: "오프라인", ready: isListReady, value: summary.offlineCameras, unit: "대", icon: <FiWifiOff />, to: "/multiview", tone: "offline" },
    { key: "today", label: "오늘 이벤트", ready: isEventReady, value: summary.todayEvents, unit: "건", icon: <FiActivity />, to: "/event-logs" },
    { key: "unread", label: "미확인 알림", ready: isEventReady, value: summary.unreadAlerts, unit: "건", icon: <FiBell />, to: "/event-logs", tone: "warning" },
  ];

  return (
    <main className="dashboard-page">

      {/* WEB-F-001 요약 */}
      <section className="dash-summary">
        {summaryCards.map((card) => (
          <button
            type="button"
            key={card.key}
            className={`dash-stat ${card.tone ?? ""}`}
            onClick={() => navigate(card.to)}
          >
            <span className="dash-stat-icon">{card.icon}</span>
            <span className="dash-stat-label">{card.label}</span>
            <strong className="dash-stat-value">
              {card.ready ? card.value : "-"}
              {card.ready && <small>{card.unit}</small>}
            </strong>
          </button>
        ))}
      </section>


      <section className="dash-grid">

        {/* WEB-F-002 이벤트 현황 (유형별 현황 + 최근 이벤트) */}
        <article className="dash-card dash-events">
          <div className="dash-card-header">
            <h3>이벤트 현황</h3>
            <button type="button" className="dash-link" onClick={() => navigate("/event-logs")}>
              전체 보기 <FiChevronRight />
            </button>
          </div>

          {!isEventReady && (
            <LoadStateNotice source={eventSource} subject="이벤트 현황을" message={eventErrorMessage} />
          )}

          {isEventReady && <div className="dash-events-body">
            <section className="dash-pane dash-type-pane">
              <div className="dash-pane-header">
                <h4>유형별 발생</h4>

                <div className="dash-segment">
                  {PERIODS.map((p) => (
                    <button
                      type="button"
                      key={p.key}
                      className={period === p.key ? "active" : ""}
                      onClick={() => setPeriod(p.key)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <DonutChart data={typeStats} size={230} thickness={28} centerLabel="전체 이벤트" />
            </section>

            <section className="dash-pane dash-recent-pane">
              <div className="dash-pane-header">
                <h4>최근 발생</h4>
              </div>

              <ul className="recent-event-list">
                {recentEvents.length === 0 && (
                  <li className="dash-empty">최근 이벤트가 없습니다.</li>
                )}

                {recentEvents.map((event) => (
                  <li key={event.id}>
                    <button type="button" onClick={() => navigate("/event-logs")}>
                      <span
                        className="recent-event-swatch"
                        style={{ backgroundColor: getEventTypeMeta(event.type).color }}
                      />
                      <div className="recent-event-main">
                        <strong>{getEventTypeMeta(event.type).label}</strong>
                        <span>
                          {event.cameraName}{event.location ? ` · ${event.location}` : ""}
                        </span>
                      </div>
                      <div className="recent-event-meta">
                        <small>{formatDateTime(event.occurredAt).slice(5, 16)}</small>
                        <span className={`recent-event-status ${event.status}`}>
                          {event.status === "confirmed" ? "확인 완료" : "미확인"}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>}
        </article>


        {/* WEB-F-003 / WEB-F-004 VPN 연결 상태 (Client + Device) */}
        <article className="dash-card dash-vpn">
          <div className="dash-card-header">
            <h3>VPN 연결 상태</h3>
            <button type="button" className="dash-link" onClick={() => navigate("/vpn-manage")}>
              VPN 관리 <FiChevronRight />
            </button>
          </div>

          {/* Client VPN (이 PC) */}
          <div className={`client-vpn-strip ${peerVpnStatus}`}>
            <div className="client-vpn-icon">
              <FiShield />
            </div>

            <div className="client-vpn-text">
              <span className="client-vpn-caption">Client VPN · 이 PC</span>
              <strong className="client-vpn-label">{clientVpn.label}</strong>
              <p>{clientVpn.desc}</p>
            </div>

            <div className="client-vpn-actions">
              {peerVpnStatus === "error" && (
                <button type="button" className="btn small primary" onClick={() => navigate("/vpn-manage")}>
                  재연결 안내
                </button>
              )}

              <button
                type="button"
                className="btn small"
                onClick={checkClientVpn}
                disabled={peerVpnStatus === "connecting"}
              >
                <FiRefreshCw className={peerVpnStatus === "connecting" ? "spin" : ""} />
                연결 확인
              </button>
            </div>
          </div>

          {/* Device VPN (카메라) */}
          <section className="dash-pane dash-device-pane">
            <div className="dash-pane-header">
              <h4>Device VPN · 카메라</h4>

              <div className="dash-vpn-filter">
                {[["all", "전체"], ...Object.entries(VPN_STATUS_META).map(([k, m]) => [k, m.label])].map(
                  ([key, label]) => (
                    <button
                      type="button"
                      key={key}
                      className={vpnFilter === key ? "active" : ""}
                      onClick={() => setVpnFilter(key)}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            </div>

            {!isListReady && (
              <LoadStateNotice source={source} subject="카메라 VPN 상태를" message={errorMessage} />
            )}

            {isListReady && <ul className="dash-vpn-stats">
              {vpnStats.map((item) => (
                <li key={item.key}>
                  <span className="dash-vpn-stats-label">
                    <span className="legend-swatch" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                  <strong>
                    {item.value}
                    <small>대</small>
                  </strong>
                  <span className="dash-vpn-stats-percent">{item.percent.toFixed(1)}%</span>
                </li>
              ))}
            </ul>}

            {isListReady && <ul className="dash-vpn-list">
              {filteredVpnList.map((device) => (
                <li key={device.cameraId}>
                  <span className="dash-vpn-name">
                    {device.cameraName}
                    <small>{device.cameraId}</small>
                  </span>
                  <span className={`dash-vpn-status ${device.vpnStatus}`}>
                    <span className="status-dot" />
                    {VPN_STATUS_META[device.vpnStatus].label}
                  </span>
                </li>
              ))}
              {filteredVpnList.length === 0 && (
                <li className="dash-empty">해당 상태의 기기가 없습니다.</li>
              )}
            </ul>}
          </section>
        </article>

      </section>
    </main>
  );
}

export default Dashboard;
