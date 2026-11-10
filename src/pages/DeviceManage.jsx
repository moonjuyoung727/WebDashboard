import "./DeviceManage.css";
import { useState } from "react";
import {
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiVideo,
  FiVideoOff,
  FiCpu,
  FiMapPin,
  FiActivity,
  FiSliders,
  FiWifi,
  FiWifiOff,
} from "react-icons/fi";

import EditableCameraName from "../components/EditableCameraName";
import CameraRegisterModal from "../components/CameraRegisterModal";
import CameraSourceBadge from "../components/CameraSourceBadge";
import LoadStateNotice from "../components/LoadStateNotice";
import Pagination from "../components/Pagination";
import useFitPagination from "../hooks/useFitPagination";
import useCameraList from "../hooks/useCameraList";

import { registerCamera, updateCameraName } from "../api/cameraApi";

/* 보드 목록 (ICD 2.2.1 GET /devices)
   - 목록은 5초마다 자동으로 다시 불러온다 (useCameraList). 서버에 닿지 못하면 빈 화면과 오류 안내
   - 이름 수정 · 등록은 서버에 반영한 뒤 목록을 다시 불러온다
   - 삭제는 서버 API가 아직 없어서 안내 문구만 보여 준다 */

function DeviceManage() {
  const {
    cameras,
    source,
    fetchedAt,
    errorMessage,
    isListReady,
    refresh,
  } = useCameraList();
  const [actionError, setActionError] = useState("");
  const [ editingCameraId, setEditingCameraId ] = useState(null);

  const [ isRegisterOpen, setIsRegisterOpen ] = useState(false);

  /* pagination: 화면 높이에 들어가는 만큼만 한 페이지에 표시 */
  const {
    areaRef: tableAreaRef,
    pageItems: currentCameras,
    page: safePage,
    setPage: setCurrentPage,
    totalPages,
  } = useFitPagination(cameras);

  function handlePageChange(page) {
    setCurrentPage(page);
    setEditingCameraId(null);
  }

  async function handleCameraNameChange(cameraId, newName) {
    const camera = cameras.find((item) => item.device_id === cameraId);
    if (!camera) return;
    setActionError("");
    try { await updateCameraName(camera.mac, newName); await refresh(); }
    catch (error) { setActionError(error.message); }
  }
  function handleDeleteCamera() {
    setActionError("현재 서버는 카메라 삭제 API를 제공하지 않습니다.");
  }
  async function handleRegisterCamera(newCamera) {
    setActionError("");
    try {
      await registerCamera(newCamera);
      await refresh();
      setIsRegisterOpen(false);
      setCurrentPage(1);
    } catch (error) { setActionError(error.message); }
  }
  /*
  async function handleRegiserCamera(cameraData) {
    const response = await registerCamera(cameraData);
    setCameras((prev) => [
      ...prev,
      response,
    ]);
  
    setIsRegisterOpen(false);
  }
  */

  return (
    <main className="device-manage">
      {actionError && <p role="alert">{actionError}</p>}
      <div className="device-manage-top">
        <h2 className="device-manage-title">
          <span className="device-title-icon">
            <FiVideo />
          </span>
          등록된 카메라
        </h2>
        <div className="device-manage-actions">
          <CameraSourceBadge source={source} fetchedAt={fetchedAt} />

          <button
            className="register-camera-button"
            onClick={() => setIsRegisterOpen(true)}
            disabled={!isListReady}
          >
            <FiPlus />
            카메라 등록
          </button>
        </div>
      </div>

      <div className="device-table-area" ref={tableAreaRef}>
        {!isListReady && (
          <LoadStateNotice source={source} subject="카메라 목록을" message={errorMessage} />
        )}

        {isListReady && <div className="device-table-wrapper">
          <table className="device-table">
            <thead>
              <tr>
                <th><span className="th-label"><FiVideo />카메라 이름</span></th>
                <th><span className="th-label"><FiCpu />MAC 주소</span></th>
                <th><span className="th-label"><FiMapPin />설치 위치</span></th>
                <th><span className="th-label"><FiActivity />상태</span></th>
                <th><span className="th-label"><FiSliders />작업</span></th>
              </tr>
            </thead>

            <tbody>
              {currentCameras.length === 0 && (
                <tr>
                  <td colSpan={5} className="device-empty">
                    등록된 카메라가 없습니다.
                  </td>
                </tr>
              )}

              {currentCameras.map((camera) => (
                <tr key={camera.device_id}>
                  <td>
                    <div className="device-name-cell">
                      <span className={`device-name-icon ${camera.status}`}>
                        {camera.status === "online" ? <FiVideo /> : <FiVideoOff />}
                      </span>

                      <EditableCameraName
                        initialName={camera.name}
                        isEditing={editingCameraId === camera.device_id}
                        onSave={(newName) => {
                          handleCameraNameChange(camera.device_id, newName)
                          setEditingCameraId(null);
                        }}
                        onCancel={() => setEditingCameraId(null)}
                      />
                    </div>
                  </td>

                  <td>
                    <span className="device-mac">
                      <FiCpu />
                      {camera.mac || "-"}
                    </span>
                  </td>

                  <td>
                    <span className={`device-location ${camera.location ? "" : "unset"}`.trim()}>
                      <FiMapPin />
                      {camera.location || "미설정"}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`device-status ${camera.status}`}
                    >
                      {camera.status === "online" ? <FiWifi /> : <FiWifiOff />}
                      {camera.status === "online"
                        ? "Online"
                        : "Offline"}
                    </span>
                  </td>

                  <td>
                    <div className="device-actions">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => setEditingCameraId(camera.device_id)}
                        aria-label="카메라 이름 수정"
                        title="이름 수정"
                      >
                        <FiEdit2 />
                      </button>

                      <button
                        type="button"
                        className="icon-button delete"
                        onClick={() =>
                          handleDeleteCamera(camera.device_id)
                        }
                        aria-label="카메라 삭제"
                        title="삭제"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </div>

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        totalItems={cameras.length}
        itemLabel="대"
      />

      {isRegisterOpen && (
        <CameraRegisterModal
          onClose={() => setIsRegisterOpen(false)}
          onRegister={handleRegisterCamera}
          registeredMacs={cameras.map((camera) => camera.mac).filter(Boolean)}
        />
      )}
    </main>
  );
}

export default DeviceManage;
