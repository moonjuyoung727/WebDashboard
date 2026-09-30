import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiDownload, FiPrinter, FiSearch } from "react-icons/fi";

import "./Reports.css";
import "../components/Modal.css";

import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";
import DonutChart from "../components/charts/DonutChart";
import RankBars from "../components/charts/RankBars";
import { EVENT_TYPE_META, VPN_STATUS_META } from "../components/charts/chartColors";

import { cameras } from "../data/cameras";
import {
  generateStatistics,
  generateStatusSummary,
  toDateInputValue,
} from "../data/statisticsMock";

/* 서버 연결 후 주석 해제
import { getStatistics, getStatusSummary, downloadReport } from "../api/reportApi";
*/

const QUICK_RANGES = [
  { key: 7, label: "최근 7일" },
  { key: 30, label: "최근 30일" },
  { key: 90, label: "최근 90일" },
];

function getRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
}

function Reports() {
  const navigate = useNavigate();

  // 입력 중인 조건 (조회 버튼을 눌러야 적용)
  const [draft, setDraft] = useState({ ...getRange(7), cameraId: "all", quick: 7 });
  const [applied, setApplied] = useState(draft);

  const [reportFormat, setReportFormat] = useState("csv");

  const isRangeInvalid = draft.startDate > draft.endDate;

  /* ---------- 목업 데이터 (서버 연결 후 API 응답으로 교체) ---------- */

  const stats = useMemo(() => generateStatistics(applied), [applied]);
  const statusSummary = useMemo(() => generateStatusSummary(), []);

  /*
  서버 연결 후 예시
  useEffect(() => {
    getStatistics(applied).then(setStats).catch(console.error);
  }, [applied]);

  useEffect(() => {
    getStatusSummary().then(setStatusSummary).catch(console.error);
  }, []);
  */

  const trendPoints = stats.trend.map((item) => ({
    label: item.date.slice(5).replace("-", "/"),
    value: item.count,
  }));

  const typeData = stats.byType.map((item) => ({
    key: item.type,
    label: EVENT_TYPE_META[item.type].label,
    color: EVENT_TYPE_META[item.type].color,
    value: item.count,
  }));

  const rankData = stats.byCamera.slice(0, 8).map((item) => ({
    key: item.cameraId,
    label: item.cameraName,
    sub: item.location,
    value: item.count,
  }));

  const hourData = stats.byHour.map((item) => ({
    label: `${item.hour}시`,
    value: item.count,
  }));

  const dayCount = Math.max(1, stats.trend.length);
  const topType = [...typeData].sort((a, b) => b.value - a.value)[0];
  const peakHour = [...stats.byHour].sort((a, b) => b.count - a.count)[0];

  const selectedCameraName =
    applied.cameraId === "all"
      ? "전체 카메라"
      : cameras.find((c) => String(c.id) === String(applied.cameraId))?.name;

  /* ---------- 조건 ---------- */

  function handleQuickRange(days) {
    setDraft((prev) => ({ ...prev, ...getRange(days), quick: days }));
  }

  function handleDraftChange(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value, quick: key === "cameraId" ? prev.quick : null }));
  }

  function handleApply() {
    if (isRangeInvalid) return;
    setApplied(draft);
  }

  /* ---------- 리포트 다운로드 (WEB-F-043) ---------- */

  function handleDownload() {
    if (reportFormat === "pdf") {
      // 시연용: 브라우저 인쇄 → PDF 저장
      window.print();
      return;
    }

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

    /* 서버 연결 후
    const blob = await downloadReport({ ...applied, format: reportFormat });
    saveBlob(blob, `report_${applied.startDate}_${applied.endDate}.${reportFormat}`);
    */
  }

  const onlineRatio = (statusSummary.onlineCameras / statusSummary.totalCameras) * 100;

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
          <input
            type="date"
            className="field-input"
            value={draft.startDate}
            max={draft.endDate}
            onChange={(e) => handleDraftChange("startDate", e.target.value)}
            aria-label="시작일"
          />
          <span>~</span>
          <input
            type="date"
            className="field-input"
            value={draft.endDate}
            min={draft.startDate}
            max={toDateInputValue(new Date())}
            onChange={(e) => handleDraftChange("endDate", e.target.value)}
            aria-label="종료일"
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
            <option key={camera.id} value={camera.id}>
              {camera.name}
            </option>
          ))}
        </select>

        <button type="button" className="btn primary" onClick={handleApply} disabled={isRangeInvalid}>
          <FiSearch />
          조회
        </button>

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

          <button type="button" className="btn" onClick={handleDownload}>
            {reportFormat === "pdf" ? <FiPrinter /> : <FiDownload />}
            리포트 다운로드
          </button>
        </div>
      </section>

      <p className="report-caption">
        {applied.startDate} ~ {applied.endDate} · {selectedCameraName}
        {isRangeInvalid && <span className="report-error"> · 시작일이 종료일보다 늦습니다.</span>}
      </p>


      {/* WEB-F-041 상태 요약 */}
      <section className="report-status-row">
        <article className="report-card">
          <h3>카메라 온라인 상태</h3>
          <div className="status-headline">
            <strong>{onlineRatio.toFixed(0)}%</strong>
            <span>온라인 비율 · 전체 {statusSummary.totalCameras}대</span>
          </div>
          <StackedBar
            items={[
              { key: "online", label: "온라인", value: statusSummary.onlineCameras, color: "var(--success)" },
              { key: "offline", label: "오프라인", value: statusSummary.offlineCameras, color: "var(--danger)" },
            ]}
          />
        </article>

        <article className="report-card">
          <h3>Device VPN 연결 상태</h3>
          <div className="status-headline">
            <strong>{statusSummary.vpnError}</strong>
            <span>오류 기기 · 전체 {statusSummary.totalCameras}대</span>
          </div>
          <StackedBar
            items={[
              { key: "connected", ...VPN_STATUS_META.connected, value: statusSummary.vpnConnected },
              { key: "disconnected", ...VPN_STATUS_META.disconnected, value: statusSummary.vpnDisconnected },
              { key: "error", ...VPN_STATUS_META.error, value: statusSummary.vpnError },
            ]}
          />
        </article>

        <article className="report-card report-kpis">
          <div>
            <span>전체 이벤트</span>
            <strong>{stats.total.toLocaleString()}<small>건</small></strong>
          </div>
          <div>
            <span>일 평균</span>
            <strong>{(stats.total / dayCount).toFixed(1)}<small>건</small></strong>
          </div>
          <div>
            <span>최다 유형</span>
            <strong className="kpi-text">{topType?.label ?? "-"}</strong>
          </div>
          <div>
            <span>최다 시간대</span>
            <strong className="kpi-text">{peakHour ? `${peakHour.hour}시 ~ ${peakHour.hour + 1}시` : "-"}</strong>
          </div>
        </article>
      </section>


      {/* WEB-F-040 통계 시각화 */}
      <section className="report-card">
        <h3>기간별 이벤트 발생 추이</h3>
        <LineChart points={trendPoints} />
      </section>

      <section className="report-grid">
        <article className="report-card">
          <h3>이벤트 유형별 통계</h3>
          <DonutChart data={typeData} centerLabel="전체 이벤트" />
        </article>

        <article className="report-card">
          <h3>카메라별 이벤트 순위</h3>
          <RankBars
            data={rankData}
            onSelect={(item) => navigate(`/Monitoring/${item.key}`)}
          />
        </article>
      </section>

      <section className="report-card">
        <h3>시간대별 이벤트 발생</h3>
        <BarChart data={hourData} labelEvery={3} />
      </section>

    </main>
  );
}


// 상태 요약 누적 막대 (라벨 + 수치 함께 표시)
function StackedBar({ items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <div className="stacked-bar">
      <div className="stacked-track">
        {items.map((item) =>
          item.value > 0 ? (
            <div
              key={item.key}
              className="stacked-segment"
              style={{ width: `${(item.value / total) * 100}%`, backgroundColor: item.color }}
              title={`${item.label} ${item.value}대`}
            />
          ) : null
        )}
      </div>

      <ul className="stacked-legend">
        {items.map((item) => (
          <li key={item.key}>
            <span className="legend-swatch" style={{ backgroundColor: item.color }} />
            {item.label}
            <strong>{item.value}대</strong>
          </li>
        ))}
      </ul>
    </div>
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
