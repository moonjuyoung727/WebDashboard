// 보드 목록 (ICD 2.2.1 GET /devices) — 기기 관리 · 멀티뷰 · 모니터링이 함께 쓴다
// - 화면에 들어오면 바로 한 번 불러오고, 그 뒤로 5초마다 다시 불러온다 (heartbeat로 바뀐 status / last_seen 반영)
// - 앞 요청이 끝난 뒤 5초를 기다렸다가 다음 요청을 보낸다 (요청이 겹치지 않음)
// - 브라우저 탭이 숨겨져 있으면 그 차례는 건너뛰고, 마지막 조회 결과로 다음 간격을 정한다 (성공 pollMs · 실패 15초)
//   탭이 다시 보이면 다음 차례를 기다리지 않고 바로 조회한다
// - 조회에 실패하면 15초마다 재시도한다 (RETRY_MS). 서버에 한 번도 닿지 못하면 빈 목록과 오류 안내를 보여 주고,
//   연결되면 서버 데이터로 바뀐다
// - 마지막으로 받은 목록은 모듈에 기억해 두어서, 다른 화면으로 옮겨도 빈 목록으로 되돌아가지 않는다
// - 로그아웃하거나 계정이 바뀌면 이전 계정의 목록을 지운다
// - Client VPN이 끊긴 동안(isVpnDown)은 자동 재조회 · 재시도를 멈추고, VPN이 다시 연결되면 바로 이어서 불러온다
//   실패 재시도를 기다리던 중에 VPN이 복구돼도 남은 시간을 기다리지 않고 바로 불러온다
//   (화면에 들어올 때의 첫 조회와 refresh()는 그대로 한다)
// - 일반 설정의 "자동 새로고침"을 따른다 (followAutoRefresh: false면 따르지 않음 — 영역 설정 화면)
//   꺼지면 성공한 뒤의 반복 조회만 멈춘다. 첫 조회 · 실패 재시도(15초) · refresh() · 탭 복귀 조회는 그대로 하고,
//   VPN이 복구되면 한 번 다시 조회한다. 다시 켜면 바로 조회하고 반복 조회를 이어 간다 (useServerResource와 같은 규칙)
//
// source
//   loading  첫 요청 응답을 기다리는 중 (빈 목록)
//   server   서버 데이터 (마지막 요청 성공)
//   stale    서버 데이터를 받은 적은 있지만 마지막 요청은 실패 (이전 서버 데이터 표시)
//   error    서버에 한 번도 닿지 못함 (빈 목록, errorMessage로 안내)

import { useCallback, useEffect, useRef, useState } from "react";
import { getCameras } from "../api/cameraApi";
import { getAccessToken } from "../storage/authStorage";
import { RETRY_MS } from "./useServerResource";
import { useVpn } from "../context/VpnContext";
import { useGeneralSettings } from "../context/GeneralSettingsContext";

export const CAMERA_POLL_MS = 5000;

const emptyState = () => ({ cameras: [], source: "loading", fetchedAt: null, errorMessage: null });

let shared = emptyState();
let ownerToken = null;  // 지금 목록을 받아 온 로그인 세션의 토큰
const listeners = new Set();

function setShared(updater) {
  shared = typeof updater === "function" ? updater(shared) : updater;
  listeners.forEach((listener) => listener(shared));
}

if (typeof window !== "undefined") {
  window.addEventListener("session-cleared", () => {
    ownerToken = null;
    setShared(emptyState());
  });
}

function useCameraList({ pollMs = CAMERA_POLL_MS, followAutoRefresh = true } = {}) {
  const [ state, setState ] = useState(() => (ownerToken === getAccessToken() ? shared : emptyState()));
  const [ isFetching, setIsFetching ] = useState(false);
  const requestRef = useRef(null);
  const mountedRef = useRef(false);

  // 타이머 안에서 최신 VPN 상태를 읽기 위해 ref로 둔다
  const { isVpnDown } = useVpn();
  const vpnDownRef = useRef(isVpnDown);
  vpnDownRef.current = isVpnDown;

  // VPN이 끊겨 멈춘 자동 재조회를 VPN 복구 후 이어서 실행할 함수
  const resumeRef = useRef(null);

  // 자동 새로고침이 꺼져 반복 조회를 멈췄는지. 타이머 안에서 최신 값을 읽기 위해 ref로 둔다
  const { autoRefresh } = useGeneralSettings();
  const pollPaused = followAutoRefresh && !autoRefresh && pollMs > 0;
  const pollPausedRef = useRef(pollPaused);
  pollPausedRef.current = pollPaused;

  // 조회 루프를 밖(설정 변경 · VPN 복구)에서 움직이는 함수들 (아래 effect가 채운다)
  const loopRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    listeners.add(setState);
    setState(shared);

    return () => {
      mountedRef.current = false;
      listeners.delete(setState);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, []);

  // silent: 자동 재조회는 실패해도 오류 토스트를 띄우지 않는다 (VPN 배너는 그대로 뜬다)
  // force: 진행 중인 조회를 끊고 새로 조회한다 (등록 · 수정 직후처럼 최신 목록이 꼭 필요할 때)
  const load = useCallback(async ({ silent = false, force = false } = {}) => {
    if (requestRef.current) {
      if (!force) {
        return;
      }

      requestRef.current.abort();
      requestRef.current = null;
    }

    const token = getAccessToken();

    if (ownerToken !== token) {
      ownerToken = token;
      setShared(emptyState());
    }

    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && token === getAccessToken();

    requestRef.current = controller;
    setIsFetching(true);

    try {
      const list = await getCameras({ silent, signal: controller.signal });

      if (isCurrent()) {
        setShared({ cameras: list, source: "server", fetchedAt: new Date(), errorMessage: null });
      }
    } catch (error) {
      if (!silent && error?.name !== "AbortError") {
        console.warn("[useCameraList] 보드 목록 조회 실패", error);
      }

      if (isCurrent()) {
        setShared((prev) => ({
          ...prev,
          source: prev.fetchedAt ? "stale" : "error",
          errorMessage: error.message,
        }));
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
      }

      if (mountedRef.current) {
        setIsFetching(false);
      }
    }
  }, []);

  useEffect(() => {
    let timer = null;
    let stopped = false;
    let running = false;  // 조회 중인지 (탭이 다시 보일 때 겹쳐 보내지 않는다)

    async function tick(silent) {
      running = true;

      if (!document.hidden) {
        await load({ silent });
      }

      running = false;

      if (stopped) {
        return;
      }

      // 마지막 조회 결과로 다음 간격을 정한다 (탭이 숨겨져 건너뛴 차례도 같다 — useServerResource와 같은 규칙)
      // 성공 → pollMs, 실패 → RETRY_MS(15초)
      // 아직 결과가 없으면 pollMs (pollMs가 없으면 RETRY_MS — 다시 불러올 차례가 있어야 하므로)
      // 자동 새로고침이 꺼져 있으면 pollMs가 없는 것처럼 성공한 뒤의 반복 조회만 멈춘다
      const repeatMs = pollPausedRef.current ? 0 : pollMs;
      const isFailing = shared.source === "error" || shared.source === "stale";
      const delay =
        shared.source === "server" ? repeatMs
          : isFailing ? RETRY_MS
            : repeatMs || RETRY_MS;

      if (delay > 0) {
        timer = setTimeout(next, delay);
      }
    }

    // 자동 재조회 차례. Client VPN이 끊겨 있으면 요청하지 않고 VPN 복구를 기다린다
    function next() {
      timer = null;

      if (vpnDownRef.current) {
        resumeRef.current = () => tick(true);
        return;
      }

      tick(true);
    }

    // 브라우저 탭이 다시 보이면 다음 차례를 기다리지 않고 바로 조회한다 (useServerResource와 같은 규칙)
    // 다음 차례가 잡혀 있거나, 자동 새로고침이 꺼져 반복 조회를 멈춘 경우에만 한다
    function handleVisibilityChange() {
      if (document.hidden || running || (timer === null && !pollPausedRef.current)) {
        return;
      }

      clearTimeout(timer);
      next();
    }

    loopRef.current = {
      // 자동 새로고침을 켜거나 껐을 때. 반복 조회 차례(마지막 조회 성공)일 때만 바꾸고,
      // 실패 재시도 차례 · 아직 결과 없음 · 조회 중이면 그대로 둔다 (그 뒤 간격은 tick이 새 값으로 정한다)
      onPollPausedChange() {
        if (stopped || running || shared.source !== "server") {
          return;
        }

        clearTimeout(timer);
        timer = null;

        // 켜졌으면 바로 조회하고 반복 조회를 이어 간다. 꺼졌으면 잡혀 있던 반복 조회 차례를 지운다
        if (!pollPausedRef.current) {
          next();
        }
      },
      // VPN이 복구됐는데 이어 갈 차례(resumeRef)가 없을 때 바로 조회한다 (useServerResource와 같은 규칙)
      // - 실패 재시도를 기다리는 중: 그 실패는 VPN 끊김 때문이므로 남은 시간을 기다리지 않는다
      // - 자동 새로고침이 꺼져 반복 조회를 멈춘 상태: 한 번 다시 조회한다
      // 성공 뒤 반복 조회를 기다리는 중이면 곧 차례가 오므로 그대로 둔다
      onVpnRestored() {
        if (stopped || running) {
          return;
        }

        const isFailing = shared.source === "error" || shared.source === "stale";
        const waitingRetry = timer !== null && isFailing;
        const idlePaused = timer === null && pollPausedRef.current;

        if (!waitingRetry && !idlePaused) {
          return;
        }

        clearTimeout(timer);
        timer = null;
        tick(true);
      },
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    tick(false);

    return () => {
      stopped = true;
      clearTimeout(timer);
      resumeRef.current = null;
      loopRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [load, pollMs]);

  // 자동 새로고침 설정이 바뀌면 반복 조회를 바로 멈추거나 다시 시작한다
  useEffect(() => {
    loopRef.current?.onPollPausedChange();
  }, [pollPaused]);

  // VPN이 다시 연결되면 멈춰 둔 자동 재조회를 바로 이어서 한다
  // 이어 갈 차례가 없으면 실패 재시도 대기 · 자동 새로고침 꺼짐일 때 바로 조회한다 (onVpnRestored)
  useEffect(() => {
    if (isVpnDown) {
      return;
    }

    if (resumeRef.current) {
      const resume = resumeRef.current;
      resumeRef.current = null;
      resume();
    } else {
      loopRef.current?.onVpnRestored();
    }
  }, [isVpnDown]);

  // 화면에서만 바꾸는 값. 서버 데이터일 때는 다음 재조회 때 서버 값으로 돌아간다
  const setCameras = useCallback((updater) => {
    setShared((prev) => ({
      ...prev,
      cameras: typeof updater === "function" ? updater(prev.cameras) : updater,
    }));
  }, []);

  const refresh = useCallback(() => load({ force: true }), [load]);

  return {
    cameras: state.cameras,
    source: state.source,
    fetchedAt: state.fetchedAt,
    errorMessage: state.errorMessage,
    isListReady: state.fetchedAt !== null,  // 서버 목록을 한 번이라도 받았는지
    isFetching,
    refresh,
    setCameras,
  };
}

export default useCameraList;
