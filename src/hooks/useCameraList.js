// 보드 목록 (ICD 2.2.1 GET /devices) — 기기 관리 · 멀티뷰 · 모니터링이 함께 쓴다
// - 화면에 들어오면 바로 한 번 불러오고, 그 뒤로 5초마다 다시 불러온다 (heartbeat로 바뀐 status / last_seen 반영)
// - 앞 요청이 끝난 뒤 5초를 기다렸다가 다음 요청을 보낸다 (요청이 겹치지 않음)
// - 브라우저 탭이 숨겨져 있으면 건너뛴다
// - 서버에 한 번도 닿지 못하면 빈 목록과 오류 안내를 보여 주고, 계속 재시도하다가 연결되면 서버 데이터로 바뀐다
// - 마지막으로 받은 목록은 모듈에 기억해 두어서, 다른 화면으로 옮겨도 빈 목록으로 되돌아가지 않는다
// - 로그아웃하거나 계정이 바뀌면 이전 계정의 목록을 지운다
//
// source
//   loading  첫 요청 응답을 기다리는 중 (빈 목록)
//   server   서버 데이터 (마지막 요청 성공)
//   stale    서버 데이터를 받은 적은 있지만 마지막 요청은 실패 (이전 서버 데이터 표시)
//   error    서버에 한 번도 닿지 못함 (빈 목록, errorMessage로 안내)

import { useCallback, useEffect, useRef, useState } from "react";
import { getCameras } from "../api/cameraApi";
import { getAccessToken } from "../storage/authStorage";

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

function useCameraList({ pollMs = CAMERA_POLL_MS } = {}) {
  const [ state, setState ] = useState(() => (ownerToken === getAccessToken() ? shared : emptyState()));
  const [ isFetching, setIsFetching ] = useState(false);
  const requestRef = useRef(null);
  const mountedRef = useRef(false);

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
  const load = useCallback(async ({ silent = false } = {}) => {
    if (requestRef.current) {
      return;
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

    async function tick(silent) {
      if (!document.hidden) {
        await load({ silent });
      }

      if (!stopped && pollMs > 0) {
        timer = setTimeout(() => tick(true), pollMs);
      }
    }

    tick(false);

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [load, pollMs]);

  // 화면에서만 바꾸는 값. 서버 데이터일 때는 다음 재조회 때 서버 값으로 돌아간다
  const setCameras = useCallback((updater) => {
    setShared((prev) => ({
      ...prev,
      cameras: typeof updater === "function" ? updater(prev.cameras) : updater,
    }));
  }, []);

  const refresh = useCallback(() => load(), [load]);

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
