import { useEffect, useState } from "react";
import Toggle from "../../components/Toggle";
import LoadStateNotice from "../../components/LoadStateNotice";
import { CATEGORY_COLORS } from "../../components/charts/chartColors";
import useServerResource from "../../hooks/useServerResource";
import { getStorageSettings, updateStorageSettings } from "../../api/settingsApi";
import "./Settings.css";
import "../../components/Modal.css";
import "../../components/settings/SettingsExtra.css";

const QUALITY_OPTIONS = [
  { value: "low", label: "저화질 (480p)", gbPerDay: 0.6 },
  { value: "medium", label: "중화질 (720p)", gbPerDay: 1.4 },
  { value: "high", label: "고화질 (1080p)", gbPerDay: 3.1 },
];

const RETENTION_OPTIONS = [7, 14, 30, 60, 90];

// 저장소 설정 (WEB-F-063)
function StorageSettings() {
  const { data, source, errorMessage } = useServerResource(() => getStorageSettings());

  const [saved, setSaved] = useState(null);
  const [settings, setSettings] = useState(null);
  const [saveState, setSaveState] = useState("idle");

  useEffect(() => {
    if (data) {
      setSaved(data);
      setSettings(data);
    }
  }, [data]);

  if (!settings) {
    return (
      <div className="settings-section">
        <h2>저장소 설정</h2>
        <LoadStateNotice source={source} subject="저장소 설정을" message={errorMessage} />
      </div>
    );
  }

  const { usage } = settings;
  const usedRatio = usage.totalGb > 0 ? (usage.usedGb / usage.totalGb) * 100 : 0;
  const remainGb = usage.totalGb - usage.usedGb;

  const isDirty = JSON.stringify({ ...settings, usage: null }) !== JSON.stringify({ ...saved, usage: null });

  // 선택한 화질 / 보관 기간 기준 카메라 1대 예상 사용량
  const quality = QUALITY_OPTIONS.find((q) => q.value === settings.quality);
  const estimatePerCamera = quality.gbPerDay * settings.retentionDays;

  function update(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaveState("idle");
  }

  async function handleSave() {
    setSaveState("saving");

    try {
      const updated = await updateStorageSettings({
        autoSave: settings.autoSave,
        quality: settings.quality,
        retentionDays: settings.retentionDays,
      });

      setSaved(updated);
      setSettings(updated);
      setSaveState("done");
    } catch (error) {
      console.error(error);
      setSaveState("idle");
    }
  }

  return (
    <div className="settings-section">
      <h2>저장소 설정</h2>

      {/* 사용량 */}
      <div className="storage-usage">
        <div className="storage-usage-head">
          <div>
            <strong>{usage.usedGb.toFixed(1)} GB</strong>
            <span> / {usage.totalGb} GB 사용 중</span>
          </div>
          <span className={usedRatio >= 90 ? "storage-warn" : ""}>
            남은 용량 {remainGb.toFixed(1)} GB ({(100 - usedRatio).toFixed(0)}%)
          </span>
        </div>

        <div className="storage-track">
          <div
            className="storage-segment"
            style={{ width: `${usedRatio}%`, backgroundColor: CATEGORY_COLORS[0] }}
            title={`사용 중 ${usage.usedGb.toFixed(1)} GB`}
          />
        </div>

        <ul className="storage-legend">
          <li>
            <span className="legend-dot" style={{ backgroundColor: CATEGORY_COLORS[0] }} />
            사용 중
            <strong>{usage.usedGb.toFixed(1)} GB</strong>
          </li>
          <li>
            <span className="legend-dot empty" />
            남은 용량
            <strong>{remainGb.toFixed(1)} GB</strong>
          </li>
        </ul>
      </div>


      <div className="setting-card">
        <div>
          <strong>영상 자동 저장</strong>
          <p>카메라 영상을 클라우드 저장소에 자동으로 저장합니다.</p>
        </div>
        <Toggle checked={settings.autoSave} onChange={() => update("autoSave", !settings.autoSave)} />
      </div>

      <div className={`setting-card ${settings.autoSave ? "" : "setting-disabled"}`}>
        <div>
          <strong>저장 화질</strong>
          <p>화질이 높을수록 저장 공간을 많이 사용합니다.</p>
        </div>
        <select
          value={settings.quality}
          disabled={!settings.autoSave}
          onChange={(e) => update("quality", e.target.value)}
        >
          {QUALITY_OPTIONS.map((q) => (
            <option key={q.value} value={q.value}>
              {q.label}
            </option>
          ))}
        </select>
      </div>

      <div className={`setting-card ${settings.autoSave ? "" : "setting-disabled"}`}>
        <div>
          <strong>보관 기간</strong>
          <p>보관 기간이 지난 영상은 자동으로 삭제됩니다.</p>
        </div>
        <select
          value={settings.retentionDays}
          disabled={!settings.autoSave}
          onChange={(e) => update("retentionDays", Number(e.target.value))}
        >
          {RETENTION_OPTIONS.map((days) => (
            <option key={days} value={days}>
              {days}일
            </option>
          ))}
        </select>
      </div>

      <div className="storage-footer">
        <span>
          예상 사용량: 카메라 1대당 약 <strong>{estimatePerCamera.toFixed(1)} GB</strong>
          {" "}({quality.label}, {settings.retentionDays}일)
        </span>

        <button
          type="button"
          className="btn primary"
          onClick={handleSave}
          disabled={!isDirty || saveState === "saving"}
        >
          {saveState === "saving" ? "저장 중..." : saveState === "done" && !isDirty ? "저장됨" : "변경 사항 저장"}
        </button>
      </div>
    </div>
  );
}

export default StorageSettings;
