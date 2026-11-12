import { useState } from "react";
import "./Settings.css";
import Toggle from "../../components/Toggle";
import LoadStateNotice from "../../components/LoadStateNotice";
import useServerResource from "../../hooks/useServerResource";
import { getNotificationSettings, updateNotificationSettings } from "../../api/settingsApi";

// ICD 2.7 알림 설정 항목
const ITEMS = [
  { key: "motion", title: "움직임 감지 알림", desc: "움직임 이벤트가 발생하면 알림을 받습니다." },
  { key: "sound", title: "소리 감지 알림", desc: "소리 이벤트가 발생하면 알림을 받습니다." },
  { key: "offline", title: "보드 오프라인 알림", desc: "보드 연결이 끊어지면 알림을 받습니다." },
  { key: "reconnect", title: "보드 재연결 알림", desc: "오프라인 상태의 보드가 다시 연결되면 알림을 받습니다." },
  { key: "importantOnly", title: "중요 이벤트만 알림", desc: "중요도가 높은 이벤트만 알림으로 표시합니다." },
];

// 알림 설정 — 바꾸면 서버에 바로 저장하고(2.7.2는 전체 저장), 실패하면 이전 값으로 되돌린다
function NotificationSettings() {
  const { data: settings, source, errorMessage, setData } = useServerResource(getNotificationSettings);
  const [saveError, setSaveError] = useState("");

  if (!settings) {
    return (
      <div className="settings-section">
        <h2>알림 설정</h2>
        <LoadStateNotice source={source} subject="알림 설정을" message={errorMessage} />
      </div>
    );
  }

  async function handleToggle(key) {
    const previous = settings;
    const next = { ...settings, [key]: !settings[key] };

    setSaveError("");
    setData(next);

    try {
      await updateNotificationSettings(next);
    } catch (error) {
      setData(previous);
      setSaveError(error.message);
    }
  }

  return (
    <div className="settings-section">
      <h2>알림 설정</h2>

      {saveError && <p className="settings-error" role="alert">{saveError}</p>}

      {ITEMS.map((item) => (
        <div className="setting-card" key={item.key}>
          <div>
            <strong>{item.title}</strong>
            <p>{item.desc}</p>
          </div>

          <Toggle checked={settings[item.key]} onChange={() => handleToggle(item.key)} />
        </div>
      ))}
    </div>
  );
}

export default NotificationSettings;
