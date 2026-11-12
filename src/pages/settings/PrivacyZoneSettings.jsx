import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PrivacyZoneEditor from "../../components/privacy/PrivacyZoneEditor";
import LoadStateNotice from "../../components/LoadStateNotice";
import useCameraList from "../../hooks/useCameraList";
import useServerResource from "../../hooks/useServerResource";
import { getPrivacyZones, savePrivacyZones } from "../../api/privacyZoneApi";
import "./Settings.css";
import "../../components/Modal.css";
import "../../components/settings/SettingsExtra.css";

// 프라이버시 존 관리 (WEB-F-064, ICD 2.6)
// - 카메라 목록(2.2.1)과 선택한 보드의 프라이버시 존(2.6.1)을 서버에서 받는다
// - 받지 못하면 안내를 보여 주고 15초마다 다시 시도한다
function PrivacyZoneSettings() {
  const navigate = useNavigate();

  // 영역 설정 화면의 보드 목록은 자동 새로고침 설정과 상관없이 계속 다시 불러온다 (Android와 같음)
  const { cameras, source, errorMessage, isListReady } = useCameraList({ followAutoRefresh: false });

  const [selectedMac, setSelectedMac] = useState(null);
  const [zones, setZones] = useState(null);       // 편집 중인 목록 (서버 목록을 받기 전에는 null)
  const [savedJson, setSavedJson] = useState("[]");
  const [keyword, setKeyword] = useState("");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | done | failed
  const [saveError, setSaveError] = useState("");

  // 보드 목록이 처음 도착하면 첫 카메라를 선택한다
  useEffect(() => {
    if (selectedMac === null && cameras.length > 0) {
      setSelectedMac(cameras[0].mac);
    }
  }, [selectedMac, cameras]);

  // 선택한 보드의 프라이버시 존 (보드를 바꾸면 비우고 다시 받는다)
  // 응답에 보드 MAC을 붙여 두어, 보드를 바꾼 직후 이전 보드의 목록을 쓰지 않게 한다
  const {
    data: zoneResult,
    source: zoneSource,
    errorMessage: zoneErrorMessage,
  } = useServerResource(
    async (options) =>
      selectedMac ? { mac: selectedMac, zones: await getPrivacyZones(selectedMac, options) } : null,
    { key: selectedMac ?? "" }
  );

  // 선택한 보드의 서버 목록을 받으면 편집용으로 복사한다
  useEffect(() => {
    if (zoneResult && zoneResult.mac === selectedMac && zones === null) {
      setZones(zoneResult.zones);
      setSavedJson(JSON.stringify(zoneResult.zones));
    }
  }, [zoneResult, selectedMac, zones]);

  const isDirty = zones !== null && JSON.stringify(zones) !== savedJson;

  const camera = cameras.find((c) => c.mac === selectedMac);

  const filteredCameras = cameras.filter((c) =>
    (c.name || c.mac).toLowerCase().includes(keyword.toLowerCase())
  );

  function handleSelectCamera(mac) {
    if (mac === selectedMac) return;

    if (isDirty && !window.confirm("저장하지 않은 변경 사항이 있습니다. 이동하시겠습니까?")) {
      return;
    }

    setSelectedMac(mac);
    setZones(null);
    setSavedJson("[]");
    setSaveState("idle");
    setSaveError("");
  }

  async function handleSave() {
    setSaveState("saving");
    setSaveError("");

    try {
      const saved = await savePrivacyZones(selectedMac, zones);

      setZones(saved);
      setSavedJson(JSON.stringify(saved));
      setSaveState("done");
    } catch (error) {
      setSaveError(error.message);
      setSaveState("failed");
    }
  }

  return (
    <div className="settings-section pz-settings-page">
      <h2>프라이버시 존 관리</h2>

      {!isListReady && (
        <LoadStateNotice source={source} subject="카메라 목록을" message={errorMessage} />
      )}

      {isListReady && cameras.length === 0 && (
        <p className="payment-empty">등록된 카메라가 없습니다.</p>
      )}

      {isListReady && cameras.length > 0 && <div className="pz-settings">
        <aside className="pz-camera-list">
          <input
            className="field-input"
            placeholder="카메라 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          <ul>
            {filteredCameras.map((c) => (
              <li key={c.mac}>
                <button
                  type="button"
                  className={c.mac === selectedMac ? "active" : ""}
                  onClick={() => handleSelectCamera(c.mac)}
                >
                  <span className={`pz-camera-dot ${c.status}`} />
                  <span className="pz-camera-name">{c.name || c.mac}</span>
                  {c.mac === selectedMac && zones !== null && zones.length > 0 && (
                    <span className="pz-camera-count">{zones.length}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="pz-settings-main">
          {camera && (
            <>
              <div className="pz-settings-head">
                <div>
                  <strong>{camera.name || camera.mac}</strong>
                  <span>
                    {camera.location || "위치 미설정"} · {camera.status === "online" ? "온라인" : "오프라인"}
                  </span>
                </div>

                <button
                  type="button"
                  className="btn small"
                  onClick={() => navigate(`/Monitoring/${camera.device_id}`)}
                >
                  실시간 화면 보기
                </button>
              </div>

              {zones === null ? (
                <LoadStateNotice source={zoneSource} subject="프라이버시 존을" message={zoneErrorMessage} />
              ) : (
                <>
                  <PrivacyZoneEditor
                    key={camera.mac}
                    zones={zones}
                    onChange={(next) => {
                      setZones(next);
                      setSaveState("idle");
                      setSaveError("");
                    }}
                    cameraName={camera.name}
                  />

                  <div className="pz-settings-footer">
                    <span className={`pz-save-message ${saveState}`}>
                      {saveState === "done" && "프라이버시 존을 저장했습니다."}
                      {saveState === "failed" && saveError}
                      {saveState === "idle" && isDirty && "저장하지 않은 변경 사항이 있습니다."}
                    </span>

                    <button
                      type="button"
                      className="btn"
                      disabled={!isDirty || saveState === "saving"}
                      onClick={() => {
                        setZones(JSON.parse(savedJson));
                        setSaveState("idle");
                        setSaveError("");
                      }}
                    >
                      되돌리기
                    </button>

                    <button
                      type="button"
                      className="btn primary"
                      disabled={!isDirty || saveState === "saving"}
                      onClick={handleSave}
                    >
                      {saveState === "saving" ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>}
    </div>
  );
}

export default PrivacyZoneSettings;
