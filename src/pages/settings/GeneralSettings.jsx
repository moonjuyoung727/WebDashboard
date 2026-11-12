import { useEffect, useState } from "react";
import Toggle from "../../components/Toggle";
import LoadStateNotice from "../../components/LoadStateNotice";
import useServerResource from "../../hooks/useServerResource";
import { getGeneralSettings, updateGeneralSetting } from "../../api/settingsApi";
import { useGeneralSettings } from "../../context/GeneralSettingsContext";
import "./Settings.css";

// 일반 설정 — 바꾸면 서버에 바로 저장하고, 실패하면 이전 값으로 되돌린다
// 바꾼 값은 전역 일반 설정(GeneralSettingsContext)에도 바로 반영해서, 각 화면의 반복 조회가 곧바로 따라간다
function GeneralSettings() {
  const { data: settings, source, errorMessage, fetchedAt, setData } = useServerResource(getGeneralSettings);
  const { setGeneralSettings } = useGeneralSettings();
  const [saveError, setSaveError] = useState("");

  // 서버에서 새로 받은 값을 전역 설정에도 반영한다 (메인 화면이 뜰 때의 조회가 실패했던 경우도 여기서 맞춰진다)
  useEffect(() => {
    if (settings && fetchedAt) {
      setGeneralSettings(settings);
    }
    // 새로 받았을 때만 반영한다 (값을 바꿀 때는 handleChange가 반영한다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedAt]);

  if (!settings) {
    return (
      <div className="settings-section">
        <h2>일반 설정</h2>
        <LoadStateNotice source={source} subject="일반 설정을" message={errorMessage} />
      </div>
    );
  }

  async function handleChange(key, value) {
    const previous = settings[key];

    setSaveError("");
    setData((prev) => ({ ...prev, [key]: value }));
    setGeneralSettings({ [key]: value });

    try {
      await updateGeneralSetting(key, value);
    } catch (error) {
      setData((prev) => ({ ...prev, [key]: previous }));
      setGeneralSettings({ [key]: previous });
      setSaveError(error.message);
    }
  }

  return (
    <div className="settings-section">
      <h2>일반 설정</h2>

      {saveError && <p className="settings-error" role="alert">{saveError}</p>}

      <div className="setting-card">
        <div>
          <strong>자동 새로고침</strong>
          <p>보드 상태와 이벤트 정보를 자동으로 갱신합니다.</p>
        </div>

        <Toggle
          checked={Boolean(settings.autoRefresh)}
          onChange={() => handleChange("autoRefresh", !settings.autoRefresh)}
        />
      </div>

      <div className="setting-card">
        <div>
          <strong>오프라인 보드 표시</strong>
          <p>멀티뷰와 대시보드에서 오프라인 보드를 표시합니다.</p>
        </div>

        <Toggle
          checked={Boolean(settings.showOfflineBoards)}
          onChange={() => handleChange("showOfflineBoards", !settings.showOfflineBoards)}
        />
      </div>

      <div className="setting-card">
        <div>
          <strong>기본 멀티뷰 채널</strong>
          <p>멀티뷰 진입 시 기본으로 표시할 채널 수입니다.</p>
        </div>

        <select
          value={settings.defaultChannel ?? ""}
          onChange={(e) => handleChange("defaultChannel", Number(e.target.value))}
        >
          <option value="2">2채널</option>
          <option value="4">4채널</option>
          <option value="6">6채널</option>
        </select>
      </div>
    </div>
  );
}

export default GeneralSettings;
