import { useEffect, useRef, useState } from "react";
import { useVpn } from "../context/VpnContext";

/*
  WebRTC 실시간 스트림 (WHEP 시그널링) — 모니터링 · 멀티뷰 공통
  - WHEP: SDP offer 를 POST 하면 answer 를 돌려주는 표준 방식 (MediaMTX / go2rtc / Janus 등 지원)
  - whepUrl 이 null 이면(보드 offline) 연결하지 않는다
  - reloadKey 가 바뀌면 기존 연결을 끊고 처음부터 다시 연결 (새로고침 버튼)
  - 의존성이 주소 문자열이라, 목록 재조회로 같은 주소가 다시 와도 연결은 그대로 유지된다

  status
    idle          주소 없음 (보드 offline) — 연결하지 않음
    connecting    처음 연결 중
    connected     재생 중
    reconnecting  끊겨서 자동으로 다시 연결하는 중
    failed        여러 번 연속으로 실패함 (뒤에서는 최대 간격으로 계속 재시도)
    paused        Client VPN이 끊긴 상태라 연결 · 재연결을 멈춤 (VPN이 다시 연결되면 바로 연결)

  자동 재연결 (보드가 online 인 동안)
    - 재시도 조건: ① WHEP 요청 실패 (2xx 아닌 응답, 네트워크 오류, 시간 초과)
                   — 404는 보드 스트림이 아직 준비되지 않은 경우(보드 재부팅 직후 등)다
                   ② 연결 상태 failed
                   ③ disconnected 가 DISCONNECT_GRACE_MS 이상 계속됨
    - 기존 연결을 정리하고 2초 → 4초 → 8초 → 최대 10초 뒤에 새로 연결한다
    - 주소가 null 이 되거나(보드 offline) 화면을 벗어나면 멈춘다
    - Client VPN 이 끊긴 동안(isVpnDown)은 화면에 들어올 때의 첫 연결도, 재연결도 하지 않고 paused 로 기다린다.
      VPN 이 다시 연결되면 실패 횟수를 0으로 되돌리고 바로 연결한다 (새로고침 버튼은 그대로 시도)
    - 보드 재부팅 직후 heartbeat 가 mediamtx 재접속보다 먼저 오면 첫 WHEP 요청이 실패하고,
      15초 미만의 짧은 끊김(Wi-Fi, rkipc 재시작, 서버 재배포)은 offline 전환 없이 연결만 끊기므로 필요하다
*/

const ICE_GATHERING_TIMEOUT = 2000;

// 저화질 경로(_sub)는 요청 시 수신(on-demand)이라, mediamtx가 WHEP 요청을 받은 뒤에야 보드에 RTSP로 접속하고
// 스트림이 준비될 때까지 응답을 미룬다 (mediamtx 기본 대기 sourceOnDemandStartTimeout 10초).
// 같은 10초로 두면 브라우저가 먼저 포기하므로 그보다 여유 있게 둔다
const WHEP_REQUEST_TIMEOUT = 15000;

const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 10000;
const DISCONNECT_GRACE_MS = 5000;

// 이 횟수만큼 연속으로 실패하면 "연결 실패"로 표시한다 (재시도는 계속)
const FAILED_AFTER_ATTEMPTS = 5;

// ICE 후보 수집이 끝날 때까지 기다림 (WHEP 는 trickle ICE 없이 한 번에 offer 를 보냄)
function waitIceGathering(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(done, ICE_GATHERING_TIMEOUT);

    function done() {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }

    function onChange() {
      if (pc.iceGatheringState === "complete") done();
    }

    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

// 서버 쪽 세션 정리 (WHEP 리소스 삭제)
function releaseResource(url) {
  fetch(url, { method: "DELETE" }).catch(() => {});
}

function useWebRtcStream(videoRef, whepUrl, reloadKey) {
  // 타이머 안에서 최신 VPN 상태를 읽기 위해 ref로 둔다
  const { isVpnDown } = useVpn();
  const vpnDownRef = useRef(isVpnDown);
  vpnDownRef.current = isVpnDown;

  const [status, setStatus] = useState(!whepUrl ? "idle" : isVpnDown ? "paused" : "connecting");

  // VPN이 끊겨 멈춘 연결을 VPN 복구 후 이어서 실행할 함수
  const resumeRef = useRef(null);

  // 새로고침 버튼(reloadKey 변경)인지 구분하기 위해 마지막 reloadKey를 기억한다
  const lastReloadKeyRef = useRef(reloadKey);

  useEffect(() => {
    // 이번 실행이 새로고침 버튼(reloadKey 변경) 때문인지
    const isUserReload = lastReloadKeyRef.current !== reloadKey;
    lastReloadKeyRef.current = reloadKey;

    if (!whepUrl) {
      setStatus("idle");
      return undefined;
    }

    let stopped = false;
    let attemptId = 0;
    let failures = 0;        // 연속 실패 횟수 (재생에 성공하면 0)
    let pc = null;
    let resourceUrl = null;
    let retryTimer = null;
    let disconnectTimer = null;

    // 지금 연결(RTCPeerConnection · WHEP 세션 · video 출력)을 정리한다
    function closeConnection() {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;

      if (pc) {
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
        pc = null;
      }

      if (resourceUrl) {
        releaseResource(resourceUrl);
        resourceUrl = null;
      }

      const video = videoRef.current;
      if (video) video.srcObject = null;
    }

    function scheduleRetry(reason) {
      if (stopped) return;

      closeConnection();
      failures += 1;

      if (vpnDownRef.current) {
        pauseForVpn(reason);
        return;
      }

      const delay = Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS);

      console.warn(`[WebRTC] ${reason} — ${delay / 1000}초 뒤 재연결 (${failures}번째)`);
      setStatus(failures >= FAILED_AFTER_ATTEMPTS ? "failed" : "reconnecting");

      clearTimeout(retryTimer);
      retryTimer = setTimeout(retry, delay);
    }

    // 재연결 차례. 기다리는 사이 Client VPN이 끊겼으면 연결하지 않고 VPN 복구를 기다린다
    function retry() {
      if (vpnDownRef.current) {
        pauseForVpn("Client VPN 끊김");
        return;
      }

      connect();
    }

    function pauseForVpn(reason) {
      console.warn(`[WebRTC] ${reason} — Client VPN이 끊겨 있어 재연결하지 않음`);
      setStatus("paused");

      // VPN이 끊긴 동안의 실패는 영상 문제가 아니므로, 복구 후에는 실패 횟수를 0부터 다시 센다 (2초 간격부터 재시도)
      resumeRef.current = () => {
        failures = 0;
        connect();
      };
    }

    async function connect() {
      if (stopped) return;

      const id = ++attemptId;
      const isCurrent = () => !stopped && id === attemptId;

      // 재시도 중에는 "재연결 중" / "연결 실패" 표시를 유지한다
      if (failures === 0) setStatus("connecting");

      const connection = new RTCPeerConnection();
      pc = connection;

      connection.addTransceiver("video", { direction: "recvonly" });
      connection.addTransceiver("audio", { direction: "recvonly" });

      connection.ontrack = (event) => {
        const video = videoRef.current;

        if (video && event.streams[0] && video.srcObject !== event.streams[0]) {
          video.srcObject = event.streams[0];
        }
      };

      connection.onconnectionstatechange = () => {
        if (!isCurrent()) return;

        const state = connection.connectionState;

        if (state === "connected") {
          failures = 0;
          clearTimeout(disconnectTimer);
          disconnectTimer = null;
          setStatus("connected");
        } else if (state === "failed") {
          scheduleRetry("연결 상태 failed");
        } else if (state === "disconnected") {
          // 잠깐 끊겼다 스스로 복구되는 경우가 많아서 조금 기다린다
          setStatus("reconnecting");

          if (!disconnectTimer) {
            disconnectTimer = setTimeout(() => {
              disconnectTimer = null;

              if (isCurrent() && connection.connectionState !== "connected") {
                scheduleRetry(`disconnected ${DISCONNECT_GRACE_MS / 1000}초 이상 지속`);
              }
            }, DISCONNECT_GRACE_MS);
          }
        }
      };

      try {
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        await waitIceGathering(connection);

        if (!isCurrent()) return;

        const response = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: connection.localDescription.sdp,
          signal: AbortSignal.timeout(WHEP_REQUEST_TIMEOUT),
        });

        if (!response.ok) {
          throw new Error(`WHEP 요청 실패 (${response.status})`);
        }

        const location = response.headers.get("Location");
        const base = new URL(whepUrl, window.location.href);
        const sessionUrl = location ? new URL(location, base).href : null;

        const answer = await response.text();

        // 응답을 기다리는 동안 화면을 벗어났거나 다른 시도로 바뀌었으면 방금 만든 세션을 바로 정리
        if (!isCurrent()) {
          if (sessionUrl) releaseResource(sessionUrl);
          return;
        }

        resourceUrl = sessionUrl;

        await connection.setRemoteDescription({ type: "answer", sdp: answer });
      } catch (error) {
        if (!isCurrent()) return;

        scheduleRetry(error?.message || "WHEP 요청 실패");
      }
    }

    // 첫 연결도 Client VPN이 끊겨 있으면 하지 않고 paused로 기다린다 (어차피 실패하고 실패 횟수만 늘어난다)
    // 새로고침 버튼은 사용자가 직접 하는 요청이라 그대로 시도한다
    if (vpnDownRef.current && !isUserReload) {
      pauseForVpn("Client VPN 끊김");
    } else {
      connect();
    }

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      resumeRef.current = null;
      closeConnection();
    };
  }, [videoRef, whepUrl, reloadKey]);

  // VPN이 다시 연결되면 멈춰 둔 재연결을 바로 시도한다
  useEffect(() => {
    if (isVpnDown || !resumeRef.current) return;

    const resume = resumeRef.current;
    resumeRef.current = null;
    resume();
  }, [isVpnDown]);

  return status;
}

export default useWebRtcStream;
