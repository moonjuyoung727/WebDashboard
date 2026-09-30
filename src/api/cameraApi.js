export async function registerCamera(cameraData) {
  const response = await fetch("/api/cameras", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cameraData),
  });

  if (!response.ok) {
    throw new Error("카메라 등록에 실패했습니다.");
  }

  return response.json();
}


export async function getCameras() {
  const response = await fetch("/api/cameras");

  if (!response.ok) {
    throw new Error("카메라 목록 조회에 실패했습니다.");
  }

  return response.json();
}

/* ===== 추가 예정 API — 서버 연결 후 주석 해제 ===== */

/* WEB-F-023 카메라 이름 수정
   (Monitoring.jsx / DeviceManage.jsx 주석에서 호출하는 함수)

export async function updateCameraName(cameraId, name) {
  const response = await fetch(`/api/cameras/${cameraId}/name`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error("카메라 이름 수정에 실패했습니다.");
  }

  return response.json();
}
*/


/* WEB-F-012 멀티뷰 저해상도 스트림 요청
   요청: 선택 카메라 ID 목록
   응답: [{ cameraId, streamUrl, sessionId }]

export async function getLowResStreams(cameraIds) {
  const response = await fetch("/api/streams/low-res", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cameraIds }),
  });

  if (!response.ok) {
    throw new Error("저해상도 스트림 요청에 실패했습니다.");
  }

  return response.json();
}
*/
