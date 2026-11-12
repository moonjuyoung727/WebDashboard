import { useEffect, useState } from "react";
import Modal from "../Modal";
import "../Modal.css";
import PrivacyZoneEditor from "./PrivacyZoneEditor";
import LoadStateNotice from "../LoadStateNotice";
import useServerResource from "../../hooks/useServerResource";
import { getPrivacyZones, savePrivacyZones } from "../../api/privacyZoneApi";

// 실시간 모니터링 화면의 프라이버시 존 설정 (WEB-F-024, ICD 2.6)
function PrivacyZoneModal({ camera, onClose, onSaved }) {
  const { data, source, errorMessage } = useServerResource(
    (options) => getPrivacyZones(camera.mac, options),
    { key: camera.mac }
  );

  const [zones, setZones] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // 서버 목록을 처음 받으면 편집용으로 복사한다
  useEffect(() => {
    if (data && zones === null) {
      setZones(data);
    }
  }, [data, zones]);

  async function handleSave() {
    setIsSaving(true);
    setSaveError("");

    try {
      const saved = await savePrivacyZones(camera.mac, zones);

      onSaved?.(saved);
      onClose();
    } catch (error) {
      setSaveError(error.message);
      setIsSaving(false);
    }
  }

  return (
    <Modal
      title={`프라이버시 존 설정 · ${camera.name}`}
      width={980}
      onClose={onClose}
      footer={
        <>
          {saveError && (
            <span role="alert" style={{ marginRight: "auto", fontSize: 13, color: "var(--danger)" }}>
              {saveError}
            </span>
          )}
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleSave}
            disabled={zones === null || isSaving}
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </>
      }
    >
      {zones === null ? (
        <LoadStateNotice source={source} subject="프라이버시 존을" message={errorMessage} />
      ) : (
        <PrivacyZoneEditor zones={zones} onChange={setZones} cameraName={camera.name} />
      )}
    </Modal>
  );
}

export default PrivacyZoneModal;
