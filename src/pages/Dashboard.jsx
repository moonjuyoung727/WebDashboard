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
import { EVENT_TYPE_META, VPN_STATUS_META } from "../components/charts/chartColors";
import { useVpn } from "../context/VpnContext";

import { eventLogs } from "../data/eventLogs";
import {
  generateDashboardSummary,
  generateStatistics,
  getDeviceVpnList,
  toDateInputValue,
} from "../data/statisticsMock";

/* 서버 연결 후 주석 해제
import {
  getDashboardSummary,
  getRecentEvents,
  getEventTypeStats,
  getDeviceVpnStatusList,
} from "../api/dashboardApi";
*/

const PERIODS = [
  { key: "today", label: "오늘", days: 0 },
  { key: "week", label: "7일", days: 6 },
  { key: "month", label: "30일", days: 29 },
];

const CLIENT_VPN_TEXT = {
  connected: { label: "연결됨", desc: "VPN 내부 서버와 정상적으로 연결되어 있습니다." },
  connecting: { label: "확인 중", desc: "VPN 내부 서버 연결을 확인하고 있습니다..." },
  disconnected: { label: "연결 안 됨", desc: "VPN 연결 상태가 확인되지 않았습니다." },
  error: { label: "연결 오류", desc: "VPN 내부 서버에 연결할 수 없습니다. VPN 클라이언트를 확인해주세요." },
};

function Dashboard() {
  const navigate = useNavigate();
  const { peerVpnStatus, setPeerVpnStatus, checkClientVpn } = useVpn();

  const [period, setPeriod] = useState("today");
  const [vpnFilter, setVpnFilter] = useState("all");

  /* ---------- 목업 데이터 (서버 연결 후 API 응답으로 교체) ---------- */

  const unreadAlerts = eventLogs.filter((e) => e.status === "unconfirmed").length;

  const summary = useMemo(() => generateDashboardSummary(unreadAlerts), [unreadAlerts]);

  const recentEvents = useMemo(
    () =>
      [...eventLogs]
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, 6),
    []
  );

  const typeStats = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period).days;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    const { byType } = generateStatistics({
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(end),
    });

    return byType.map((item) => ({
      key: item.type,
      label: EVENT_TYPE_META[item.type].label,
      color: EVENT_TYPE_META[item.type].color,
      value: item.count,
    }));
  }, [period]);

  const vpnList = useMemo(() => getDeviceVpnList(), []);

  const vpnChartData = Object.entries(VPN_STATUS_META).map(([key, meta]) => ({
    key,
    label: meta.label,
    color: meta.color,
    value: vpnList.filter((d) => d.vpnStatus === key).length,
  }));

  // 문제 있는 기기를 먼저 보여줌
  const statusOrder = { error: 0, disconnected: 1, connected: 2 };

  const filteredVpnList = vpnList
    .filter((d) => vpnFilter === "all" || d.vpnStatus === vpnFilter)
    .sort((a, b) => statusOrder[a.vpnStatus] - statusOrder[b.vpnStatus]);

  /*
  서버 연결 후 예시
  useEffect(() => {
    async function loadDashboard() {
      try {
        const [summaryData, recent, vpn] = await Promise.all([
          getDashboardSummary(),
          getRecentEvents(6),
          getDeviceVpnStatusList(),
        ]);
        setSummary(summaryData);
        setRecentEvents(recent);
        setVpnList(vpn);
      } catch (error) {
        console.error(error);
      }
    }
    loadDashboard();
  }, []);

  useEffect(() => {
    getEventTypeStats(period).then(setTypeStats).catch(console.error);
  }, [period]);
  */

  const clientVpn = CLIENT_VPN_TEXT[peerVpnStatus] ?? CLIENT_VPN_TEXT.disconnected;

  const summaryCards = [
    { key: "total", label: "전체 카메라", value: summary.totalCameras, unit: "대", icon: <FiVideo />, to: "/devices" },
    { key: "online", label: "온라인", value: summary.onlineCameras, unit: "대", icon: <FiWifi />, to: "/multiview", tone: "online" },
    { key: "offline", label: "오프라인", value: summary.offlineCameras, unit: "대", icon: <FiWifiOff />, to: "/multiview", tone: "offline" },
    { key: "today", label: "오늘 이벤트", value: summary.todayEvents, unit: "건", icon: <FiActivity />, to: "/event-logs" },
    { key: "unread", label: "미확인 알림", value: summary.unreadAlerts, unit: "건", icon: <FiBell />, to: "/event-logs", tone: "warning" },
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
              {card.value}
              <small>{card.unit}</small>
            </strong>
          </button>
        ))}
      </section>


      <section className="dash-grid">

        {/* WEB-F-002 최근 이벤트 */}
        <article className="dash-card">
          <div className="dash-card-header">
            <h3>최근 발생 이벤트</h3>
            <button type="button" className="dash-link" onClick={() => navigate("/event-logs")}>
              전체 보기 <FiChevronRight />
            </button>
          </div>

          <ul className="recent-event-list">
            {recentEvents.map((event) => (
              <li key={event.id}>
                <button type="button" onClick={() => navigate("/event-logs")}>
                  <span
                    className="recent-event-swatch"
                    style={{ backgroundColor: EVENT_TYPE_META[event.type]?.color }}
                  />
                  <div className="recent-event-main">
                    <strong>{EVENT_TYPE_META[event.type]?.label ?? event.type}</strong>
                    <span>
                      {event.cameraName} · {event.location}
                    </span>
                  </div>
                  <div className="recent-event-meta">
                    <small>{event.occurredAt.replace("T", " ").slice(5, 16)}</small>
                    <span className={`recent-event-status ${event.status}`}>
                      {event.status === "confirmed" ? "확인 완료" : "미확인"}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </article>


        {/* WEB-F-002 유형별 현황 */}
        <article className="dash-card">
          <div className="dash-card-header">
            <h3>이벤트 유형별 발생 현황</h3>

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

          <DonutChart data={typeStats} centerLabel="전체 이벤트" />
        </article>


        {/* WEB-F-003 Device VPN */}
        <article className="dash-card">
          <div className="dash-card-header">
            <h3>Device VPN 연결 상태</h3>
            <button type="button" className="dash-link" onClick={() => navigate("/vpn-manage")}>
              VPN 관리 <FiChevronRight />
            </button>
          </div>

          <div className="dash-vpn-body">
            <DonutChart
              data={vpnChartData}
              size={150}
              thickness={18}
              centerLabel="전체 기기"
              unit="대"
            />
          </div>

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

          <ul className="dash-vpn-list">
            {filteredVpnList.map((device) => (
              <li key={device.cameraId}>
                <span className="dash-vpn-name">
                  {device.cameraName}
                  <small>CAM-{String(device.cameraId).padStart(4, "0")}</small>
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
          </ul>
        </article>


        {/* WEB-F-004 Client VPN */}
        <article className={`dash-card client-vpn-card ${peerVpnStatus}`}>
          <div className="dash-card-header">
            <h3>Client VPN 연결 상태</h3>
          </div>

          <div className="client-vpn-body">
            <div className="client-vpn-icon">
              <FiShield />
            </div>

            <strong className="client-vpn-label">{clientVpn.label}</strong>
            <p>{clientVpn.desc}</p>

            <div className="client-vpn-actions">
              <button
                type="button"
                className="btn"
                onClick={checkClientVpn}
                disabled={peerVpnStatus === "connecting"}
              >
                <FiRefreshCw className={peerVpnStatus === "connecting" ? "spin" : ""} />
                연결 확인
              </button>

              {peerVpnStatus === "error" && (
                <button type="button" className="btn primary" onClick={() => navigate("/vpn-manage")}>
                  재연결 안내
                </button>
              )}
            </div>

            {/* 시연용: 서버 연결 후 삭제 */}
            <button
              type="button"
              className="client-vpn-demo"
              onClick={() => setPeerVpnStatus("error")}
            >
              <span className="demo-tag">DEMO</span> 연결 끊김 시뮬레이션
            </button>
          </div>
        </article>

      </section>
    </main>
  );
}

export default Dashboard;
