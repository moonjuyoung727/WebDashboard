import { useMemo, useState } from "react";
import {
  FiDownload,
  FiPrinter,
  FiSearch,
  FiActivity,
  FiBarChart2,
  FiTag,
  FiClock,
  FiWifi,
  FiShield,
  FiTrendingUp,
  FiPieChart,
  FiAward,
  FiMaximize2,
} from "react-icons/fi";

import "./Reports.css";
import "../components/Modal.css";

import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";
import DonutChart from "../components/charts/DonutChart";
import RankBars from "../components/charts/RankBars";
import useElementSize from "../components/charts/useElementSize";
import { EVENT_TYPES, VPN_STATUS_META, getEventTypeMeta } from "../components/charts/chartColors";
import DatePicker from "../components/DatePicker";
import LoadStateNotice from "../components/LoadStateNotice";
import StackedBar from "../components/reports/StackedBar";
import ReportDetailModal from "../components/reports/ReportDetailModal";
import useCameraList from "../hooks/useCameraList";
import useServerResource from "../hooks/useServerResource";

import { getAllEvents } from "../api/eventApi";
import { formatDateTime } from "../utils/formatDateTime";
import { normalizeMac } from "../utils/mac";

/* 통계 (WEB-F-040 ~ 043)
   ICD에 통계 API가 없어서 보드 목록(2.2.1)과 이벤트 목록(2.3.1)을 받아 화면에서 집계한다
   - 서버에 닿지 못하면 안내를 보여 주고 15초마다 다시 시도한다 (useServerResource)
   - 날짜 · 시간대는 화면에 보이는 한국 시간 기준 */

const QUICK_RANGES = [
  { key: 7, label: "최근 7일" },
  { key: 30, label: "최근 30일" },
  { key: 90, label: "최근 90일" },
];

// 조회 기간이 길면 이벤트를 너무 많이 받아 오므로 막는다
const MAX_RANGE_DAYS = 90;

// "YYYY-MM-DD HH:mm:ss" (KST)
const toKst = (value) => formatDateTime(value);
const todayKst = () => toKst(new Date()).slice(0, 10);

// "YYYY-MM-DD"에 days만큼 더한 날짜 (시간대 영향 없이 날짜만 계산)
function addDays(date, days) {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);

  return cursor.toISOString().slice(0, 10);
}

function eachDay(startDate, endDate) {
  const days = [];

  if (!startDate || !endDate) {
    return days;
  }

  for (let day = startDate; day <= endDate && days.length <= MAX_RANGE_DAYS; day = addDays(day, 1)) {
    days.push(day);
  }

  return days;
}

function getRange(days) {
  const endDate = todayKst();

  return { startDate: addDays(endDate, -(days - 1)), endDate };
}

// 조회 조건(mac이 있으면 해당 보드만)에 맞는 이벤트 전체
function loadReportEvents({ startDate, endDate, cameraId }) {
  return ({ silent }) =>
    getAllEvents({
      startDate,
      endDate,
      mac: cameraId === "all" ? undefined : cameraId,
      silent,
    });
}

// 이벤트 목록 → 통계 { total, trend, byType, byCamera, byHour }
function buildStatistics(events, { startDate, endDate, cameraId }, cameras) {
  const days = eachDay(startDate, endDate);
  const trendCounts = new Map(days.map((day) => [day, 0]));
  const typeCounts = new Map(EVENT_TYPES.map((type) => [type, 0]));
  const hourCounts = Array(24).fill(0);
  const cameraCounts = new Map();

  // 보드 목록에 있는 카메라는 이벤트가 0건이어도 순위에 넣는다
  cameras
    .filter((camera) => cameraId === "all" || camera.mac === cameraId)
    .forEach((camera) =>
      cameraCounts.set(camera.mac, {
        cameraId: camera.mac,
        cameraName: camera.name || camera.mac,
        location: camera.location,
        count: 0,
      })
    );

  let total = 0;

  events.forEach((event) => {
    const kst = toKst(event.occurredAt);
    const day = kst.slice(0, 10);

    // 시각을 읽을 수 없거나 기간 밖이면 집계하지 않는다
    if (!trendCounts.has(day)) {
      return;
    }

    total += 1;
    trendCounts.set(day, trendCounts.get(day) + 1);
    typeCounts.set(event.type, (typeCounts.get(event.type) ?? 0) + 1);

    const hour = Number(kst.slice(11, 13));
    if (hour >= 0 && hour < 24) {
      hourCounts[hour] += 1;
    }

    const mac = normalizeMac(event.cameraId);
    const entry = cameraCounts.get(mac) ?? {
      cameraId: mac,
      cameraName: event.cameraName || mac || "알 수 없음",
      location: event.location,
      count: 0,
    };
    entry.count += 1;
    cameraCounts.set(mac, entry);
  });

  return {
    total,
    trend: [...trendCounts].map(([date, count]) => ({ date, count })),
    byType: [...typeCounts].map(([type, count]) => ({ type, count })),
    byCamera: [...cameraCounts.values()].sort((a, b) => b.count - a.count),
    byHour: hourCounts.map((count, hour) => ({ hour, count })),
  };
}

const EMPTY_STATS = buildStatistics([], { startDate: "", endDate: "", cameraId: "all" }, []);

function Reports() {
  // 입력 중인 조건 (조회 버튼을 눌러야 적용)
  const [draft, setDraft] = useState({ ...getRange(7), cameraId: "all", quick: 7 });
  const [applied, setApplied] = useState(draft);

  const [reportFormat, setReportFormat] = useState("csv");
  const [downloadError, setDownloadError] = useState("");

  // 상세 보기 모달 (trend | type | hour | camera | online | vpn)
  const [detailKind, setDetailKind] = useState(null);

  const draftDays = eachDay(draft.startDate, draft.endDate).length;
  const rangeError =
    draft.startDate > draft.endDate
      ? "시작일이 종료일보다 늦습니다."
      : draftDays > MAX_RANGE_DAYS
        ? `조회 기간은 최대 ${MAX_RANGE_DAYS}일입니다.`
        : "";

  /* ---------- 서버 데이터 ---------- */

  // 보드 목록 (ICD 2.2.1) — 카메라 선택 · 온라인 · VPN 요약에 쓴다
  const {
    cameras,
    source: cameraSource,
    errorMessage: cameraErrorMessage,
    isListReady,
  } = useCameraList();

  // 이벤트 (ICD 2.3.1) — 조회 조건이 바뀌면 다시 받는다. 실패하면 15초마다 재시도
  const {
    data: events,
    source: eventSource,
    errorMessage: eventErrorMessage,
    isReady: isEventReady,
  } = useServerResource(loadReportEvents(applied), {
    key: `${applied.startDate}|${applied.endDate}|${applied.cameraId}`,
  });

  const stats = useMemo(
    () => (isEventReady ? buildStatistics(events ?? [], applied, cameras) : EMPTY_STATS),
    [isEventReady, events, applied, cameras]
  );

  const statusSummary = useMemo(() => {
    const onlineCameras = cameras.filter((camera) => camera.status === "online").length;
    const countVpn = (status) =>
      cameras.filter((camera) => (camera.vpn_status ?? "disconnected") === status).length;

    return {
      totalCameras: cameras.length,
      onlineCameras,
      offlineCameras: cameras.length - onlineCameras,
      vpnConnected: countVpn("connected"),
      vpnDisconnected: countVpn("disconnected"),
      vpnError: countVpn("error"),
    };
  }, [cameras]);

  // Device VPN 상태: 보드 목록의 vpn_status (대시보드와 같은 기준)
  const vpnList = useMemo(
    () =>
      cameras.map((camera) => ({
        cameraId: camera.mac,
        cameraName: camera.name,
        location: camera.location,
        vpnStatus: camera.vpn_status ?? "disconnected",
        error: null,
      })),
    [cameras]
  );

  const trendPoints = stats.trend.map((item) => ({
    label: item.date.slice(5).replace("-", "/"),
    value: item.count,
  }));

  const typeData = stats.byType.map((item) => ({
    key: item.type,
    ...getEventTypeMeta(item.type),
    value: item.count,
  }));

  const hourData = stats.byHour.map((item) => ({
    label: `${item.hour}시`,
    value: item.count,
  }));

  const dayCount = Math.max(1, stats.trend.length);

  // 이벤트가 0건이면 "최다"를 정할 수 없다
  const topType = [...typeData].sort((a, b) => b.value - a.value).find((item) => item.value > 0);
  const peakHour = [...stats.byHour].sort((a, b) => b.count - a.count).find((item) => item.count > 0);

  const selectedCameraName =
    applied.cameraId === "all"
      ? "전체 카메라"
      : cameras.find((c) => c.mac === applied.cameraId)?.name || applied.cameraId;

  const rangeText = `${applied.startDate} ~ ${applied.endDate} · ${selectedCameraName}`;

  /* ---------- 조건 ---------- */

  function handleQuickRange(days) {
    setDraft((prev) => ({ ...prev, ...getRange(days), quick: days }));
  }

  function handleDraftChange(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value, quick: key === "cameraId" ? prev.quick : null }));
  }

  function handleApply() {
    if (rangeError) return;
    setApplied(draft);
  }

  /* ---------- 리포트 다운로드 (WEB-F-043) ----------
     리포트 다운로드 API가 명세에 없어서, 화면에 집계된 서버 데이터로 파일을 만든다 */

  function handleDownload() {
    setDownloadError("");

    if (!isEventReady) {
      setDownloadError("통계 데이터를 불러온 뒤에 다운로드할 수 있습니다.");
      return;
    }

    try {
      if (reportFormat === "pdf") {
        // 브라우저 인쇄 → PDF로 저장
        window.print();
        return;
      }

      downloadCsv();
    } catch (error) {
      console.warn("[Reports] 리포트 다운로드 실패", error);
      setDownloadError("리포트 파일을 만들지 못했습니다. 다시 시도해 주세요.");
    }
  }

  function downloadCsv() {

    const rows = [
      ["SECURE CAM 이벤트 통계 리포트"],
      ["조회 기간", `${applied.startDate} ~ ${applied.endDate}`],
      ["카메라", selectedCameraName],
      ["전체 이벤트", stats.total],
      [],
      ["[기간별 발생 추이]"],
      ["날짜", "건수"],
      ...stats.trend.map((t) => [t.date, t.count]),
      [],
      ["[유형별 통계]"],
      ["유형", "건수"],
      ...typeData.map((t) => [t.label, t.value]),
      [],
      ["[카메라별 순위]"],
      ["순위", "카메라", "위치", "건수"],
      ...stats.byCamera.map((c, i) => [i + 1, c.cameraName, c.location, c.count]),
      [],
      ["[시간대별 통계]"],
      ["시간", "건수"],
      ...stats.byHour.map((h) => [`${h.hour}시`, h.count]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    // 엑셀 한글 깨짐 방지용 BOM
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    saveBlob(blob, `report_${applied.startDate}_${applied.endDate}.csv`);
  }

  const onlineRatio =
    statusSummary.totalCameras === 0
      ? 0
      : (statusSummary.onlineCameras / statusSummary.totalCameras) * 100;

  // 아직 받지 못한 값은 "-"로 보여 준다 (서버 연결 실패 시 0으로 오해하지 않게)
  const eventValue = (value) => (isEventReady ? value : "-");
  const cameraValue = (value) => (isListReady ? value : "-");

  /* ---------- 요약 타일 ---------- */

  const kpis = [
    {
      key: "total",
      detail: "trend",
      ready: isEventReady,
      icon: <FiActivity />,
      label: "전체 이벤트",
      value: eventValue(stats.total.toLocaleString()),
      unit: "건",
    },
    {
      key: "avg",
      detail: "trend",
      ready: isEventReady,
      icon: <FiBarChart2 />,
      label: "일 평균",
      value: eventValue((stats.total / dayCount).toFixed(1)),
      unit: "건",
    },
    {
      key: "topType",
      detail: "type",
      ready: isEventReady,
      icon: <FiTag />,
      label: "최다 유형",
      value: eventValue(topType?.label ?? "-"),
      text: true,
    },
    {
      key: "peakHour",
      detail: "hour",
      ready: isEventReady,
      icon: <FiClock />,
      label: "최다 시간대",
      value: eventValue(peakHour ? `${peakHour.hour}시 ~ ${peakHour.hour + 1}시` : "-"),
      text: true,
    },
    {
      key: "online",
      detail: "online",
      ready: isListReady,
      icon: <FiWifi />,
      label: `카메라 온라인 · 전체 ${cameraValue(statusSummary.totalCameras)}대`,
      value: cameraValue(`${onlineRatio.toFixed(0)}%`),
      bar: [
        { key: "online", label: "온라인", value: statusSummary.onlineCameras, color: "var(--success)" },
        { key: "offline", label: "오프라인", value: statusSummary.offlineCameras, color: "var(--danger)" },
      ],
    },
    {
      key: "vpn",
      detail: "vpn",
      ready: isListReady,
      icon: <FiShield />,
      label: `VPN 오류 기기 · 전체 ${cameraValue(statusSummary.totalCameras)}대`,
      value: cameraValue(statusSummary.vpnError),
      unit: "대",
      bar: [
        { key: "connected", ...VPN_STATUS_META.connected, value: statusSummary.vpnConnected },
        { key: "disconnected", ...VPN_STATUS_META.disconnected, value: statusSummary.vpnDisconnected },
        { key: "error", ...VPN_STATUS_META.error, value: statusSummary.vpnError },
      ],
    },
  ];

  return (
    <main className="reports-page">

      {/* WEB-F-042 조회 조건 */}
      <section className="report-filter">
        <div className="report-quick">
          {QUICK_RANGES.map((range) => (
            <button
              type="button"
              key={range.key}
              className={draft.quick === range.key ? "active" : ""}
              onClick={() => handleQuickRange(range.key)}
            >
              {range.label}
            </button>
          ))}
        </div>

        <div className="report-dates">
          <DatePicker
            value={draft.startDate}
            max={draft.endDate}
            placeholder="시작일"
            onChange={(value) => value && handleDraftChange("startDate", value)}
          />
          <span>~</span>
          <DatePicker
            value={draft.endDate}
            min={draft.startDate}
            max={todayKst()}
            placeholder="종료일"
            onChange={(value) => value && handleDraftChange("endDate", value)}
          />
        </div>

        <select
          className="field-select"
          value={draft.cameraId}
          onChange={(e) => handleDraftChange("cameraId", e.target.value)}
          aria-label="카메라 선택"
        >
          <option value="all">전체 카메라</option>
          {cameras.map((camera) => (
            <option key={camera.mac} value={camera.mac}>
              {camera.name || camera.mac}
            </option>
          ))}
        </select>

        <button type="button" className="btn primary" onClick={handleApply} disabled={Boolean(rangeError)}>
          <FiSearch />
          조회
        </button>

        <span className="report-caption">
          {rangeText}
          {rangeError && <span className="report-error"> · {rangeError}</span>}
          {downloadError && <span className="report-error"> · {downloadError}</span>}
        </span>

        <div className="report-download">
          <select
            className="field-select"
            value={reportFormat}
            onChange={(e) => setReportFormat(e.target.value)}
            aria-label="리포트 형식"
          >
            <option value="csv">CSV</option>
            <option value="pdf">PDF (인쇄)</option>
          </select>

          <button type="button" className="btn" onClick={handleDownload} disabled={!isEventReady}>
            {reportFormat === "pdf" ? <FiPrinter /> : <FiDownload />}
            리포트 다운로드
          </button>
        </div>
      </section>


      {/* WEB-F-041 상태 요약 + 핵심 수치 (누르면 상세 보기) */}
      <section className="report-kpi-row">
        {kpis.map((kpi) => (
          <button
            type="button"
            key={kpi.key}
            className={`report-kpi ${kpi.key}`}
            onClick={() => setDetailKind(kpi.detail)}
            disabled={!kpi.ready}
          >
            <span className="report-kpi-icon">{kpi.icon}</span>

            <span className="report-kpi-text">
              <span className="report-kpi-label">{kpi.label}</span>
              <strong className={kpi.text ? "text" : ""}>
                {kpi.value}
                {kpi.unit && <small>{kpi.unit}</small>}
              </strong>
              {kpi.bar && kpi.ready && <StackedBar items={kpi.bar} showLegend={false} compact />}
            </span>
          </button>
        ))}
      </section>


      {/* 카메라 목록 조회 실패 안내 (온라인 · VPN 요약과 카메라 선택에 영향) */}
      {(cameraSource === "error" || cameraSource === "stale") && (
        <p className="report-alert" role="alert">
          {cameraSource === "error"
            ? "카메라 목록을 불러오지 못했습니다."
            : "카메라 목록을 갱신하지 못해 마지막으로 받은 정보를 표시합니다."}{" "}
          {cameraErrorMessage}
        </p>
      )}

      {/* WEB-F-040 통계 시각화 (카드를 누르면 상세 보기)
          이벤트를 아직 받지 못했으면(불러오는 중 · 서버 연결 실패) 차트 대신 안내 */}
      {!isEventReady ? (
        <section className="report-card report-main-notice">
          <LoadStateNotice source={eventSource} subject="통계 데이터를" message={eventErrorMessage} />
        </section>
      ) : (
        <ReportCharts
          stats={stats}
          trendPoints={trendPoints}
          typeData={typeData}
          hourData={hourData}
          onOpen={setDetailKind}
        />
      )}


      {detailKind && (
        <ReportDetailModal
          kind={detailKind}
          onClose={() => setDetailKind(null)}
          data={{
            stats,
            trendPoints,
            typeData,
            hourData,
            dayCount,
            statusSummary,
            cameraList: cameras,
            vpnList,
            rangeText,
          }}
        />
      )}

    </main>
  );
}


// 통계 차트 4개. 이벤트를 받은 뒤에 화면에 붙으므로 카드 크기 측정(useElementSize)도 여기서 한다
function ReportCharts({ stats, trendPoints, typeData, hourData, onOpen }) {
  const [trendRef, trendSize] = useElementSize();
  const [hourRef, hourSize] = useElementSize();
  const [typeRef, typeSize] = useElementSize();
  const [rankRef, rankSize] = useElementSize();

  // 순위는 카드 높이에 들어가는 만큼만 (전체는 상세 보기에서)
  const RANK_ROW_HEIGHT = 40;
  const rankCount = Math.max(3, Math.floor(rankSize.height / RANK_ROW_HEIGHT));

  const rankData = stats.byCamera.slice(0, rankCount).map((item) => ({
    key: item.cameraId,
    label: item.cameraName,
    sub: item.location,
    value: item.count,
  }));

  // 도넛은 카드 높이에 맞춰 (범례는 옆에)
  const donutSize = Math.max(110, Math.min(190, typeSize.height - 8));

  return (
    <section className="report-main">
      <ReportCard
        className="trend"
        icon={<FiTrendingUp />}
        title="기간별 이벤트 발생 추이"
        onOpen={() => onOpen("trend")}
      >
        <div className="report-chart-body" ref={trendRef}>
          <LineChart points={trendPoints} height={Math.max(120, trendSize.height - 4)} />
        </div>
      </ReportCard>

      <ReportCard
        className="type"
        icon={<FiPieChart />}
        title="이벤트 유형별 통계"
        onOpen={() => onOpen("type")}
      >
        <div className="report-chart-body" ref={typeRef}>
          <DonutChart
            data={typeData}
            size={donutSize}
            thickness={Math.round(donutSize / 8)}
            centerLabel="전체 이벤트"
          />
        </div>
      </ReportCard>

      <ReportCard
        className="hour"
        icon={<FiClock />}
        title="시간대별 이벤트 발생"
        onOpen={() => onOpen("hour")}
      >
        <div className="report-chart-body" ref={hourRef}>
          <BarChart data={hourData} labelEvery={3} height={Math.max(120, hourSize.height - 4)} />
        </div>
      </ReportCard>

      <ReportCard
        className="camera"
        icon={<FiAward />}
        title="카메라별 이벤트 순위"
        meta={`상위 ${rankData.length}대`}
        onOpen={() => onOpen("camera")}
      >
        <div className="report-chart-body" ref={rankRef}>
          <RankBars data={rankData} />
        </div>
      </ReportCard>
    </section>
  );
}


// 통계 카드 (어디를 눌러도 상세 보기)
function ReportCard({ className = "", icon, title, meta, onOpen, children }) {
  return (
    <article
      className={`report-card clickable ${className}`.trim()}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`${title} 자세히 보기`}
    >
      <div className="report-card-header">
        <h3>
          {icon}
          {title}
        </h3>

        {meta && <span className="report-card-meta">{meta}</span>}

        <span className="report-card-open">
          <FiMaximize2 />
          자세히
        </span>
      </div>

      {children}
    </article>
  );
}


function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}

export default Reports;
