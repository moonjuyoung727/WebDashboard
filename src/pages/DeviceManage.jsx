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
import { AiFillStar, AiOutlineStar } from "react-icons/ai";

import EditableCameraName from "../components/EditableCameraName";
import CameraRegisterModal from "../components/CameraRegisterModal";
import Pagination from "../components/Pagination";
import useFitPagination from "../hooks/useFitPagination";

import { cameras as initialCameras } from "../data/cameras";
// import { registerCamera } from "../api/cameraApi";  // 서버 연결 후 주석 해제

function DeviceManage() {
  const [ cameras, setCameras ] = useState(initialCameras);
  const [ editingCameraId, setEditingCameraId ] = useState(null);

  const [ isRegisterOpen, setIsRegisterOpen ] = useState(false);

  /* pagination: 화면 높이에 들어가는 만큼만 한 페이지에 표시 */
  const {
    areaRef: tableAreaRef,
    pageItems: currentCameras,
    page: safePage,
    setPage: setCurrentPage,
    totalPages,
    rowsPerPage: camerasPerPage,
  } = useFitPagination(cameras);

  function handlePageChange(page) {
    setCurrentPage(page);
    setEditingCameraId(null);
  }

  function handleCameraNameChange(cameraId, newName) {
    setCameras((prev) =>
    prev.map((camera) =>
      camera.id === cameraId
        ? { ...camera, name: newName}
        : camera
      )
    );
    /*
    updateCameraName(cameraId, newName);
     */
  }

  function handleDeleteCamera(cameraId) {
    setCameras((prev) =>
      prev.filter((camera) => camera.id !== cameraId)
    );
  }

  function handleRegisterCamera(newCamera) {
    setCameras((prev) => [
      ...prev,
      {
        ...newCamera,
        id: Date.now(),
        status: "offline",
      },
    ]);
    setIsRegisterOpen(false);

    // 새로 등록한 카메라가 보이도록 마지막 페이지로 이동
    setCurrentPage(Math.ceil((cameras.length + 1) / camerasPerPage));
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
      <div className="device-manage-top">
        <h2 className="device-manage-title">
          <span className="device-title-icon">
            <FiVideo />
          </span>
          등록된 카메라
        </h2>
        <button
          className="register-camera-button"
          onClick={() => setIsRegisterOpen(true)}
        >
          <FiPlus />
          카메라 등록
        </button>
      </div>

      <div className="device-table-area" ref={tableAreaRef}>
        <div className="device-table-wrapper">
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
              {currentCameras.map((camera) => (
                <tr key={camera.id}>
                  <td>
                    <div className="device-name-cell">
                      <span className={`device-name-icon ${camera.status}`}>
                        {camera.status === "online" ? <FiVideo /> : <FiVideoOff />}
                      </span>

                      <EditableCameraName
                        initialName={camera.name}
                        isEditing={editingCameraId === camera.id}
                        onSave={(newName) => {
                          handleCameraNameChange(camera.id, newName)
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
                        onClick={() => setEditingCameraId(camera.id)}
                        aria-label="카메라 이름 수정"
                        title="이름 수정"
                      >
                        <FiEdit2 />
                      </button>

                      <button
                        type="button"
                        className="icon-button delete"
                        onClick={() =>
                          handleDeleteCamera(camera.id)
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
        </div>
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