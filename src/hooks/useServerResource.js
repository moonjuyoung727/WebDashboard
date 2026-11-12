// 서버 조회 공통 처리 — 목업 없이 서버 응답만 보여 준다
// - 화면에 들어오면 바로 한 번 불러오고, pollMs가 있으면 성공한 뒤 pollMs마다 다시 불러온다
// - 실패하면 15초마다 재시도하다가 연결되면 서버 데이터로 바뀐다
// - 브라우저 탭이 숨겨져 있으면 그 차례는 건너뛰고, 마지막 조회 결과로 다음 간격을 정한다 (성공 pollMs · 실패 15초)
//   탭이 다시 보이면 다음 차례를 기다리지 않고 바로 조회한다
// - key가 바뀌면(예: 조회 기간 변경) 비우고 다시 불러온다. 앞 요청의 늦은 응답은 버린다
// - Client VPN이 끊긴 동안(isVpnDown)은 자동 재조회 · 재시도를 멈추고, VPN이 다시 연결되면 바로 이어서 불러온다
//   실패 재시도를 기다리던 중에 VPN이 복구돼도 남은 시간을 기다리지 않고 바로 불러온다
//   (화면에 들어올 때의 첫 조회와 refresh()처럼 사용자가 직접 하는 조회는 그대로 한다)
// - followAutoRefresh면 일반 설정의 "자동 새로고침"을 따른다. 꺼지면 성공한 뒤의 반복 조회(pollMs)만 멈춘다
//   첫 조회 · 실패 재시도(15초) · refresh() · 탭 복귀 조회는 그대로 하고, VPN이 복구되면 한 번 다시 조회한다
//   다시 켜면 바로 조회하고 반복 조회를 이어 간다
//
// source (useCameraList와 같은 의미)
//   loading  첫 요청 응답을 기다리는 중
//   server   서버 데이터 (마지막 요청 성공)
//   stale    서버 데이터를 받은 적은 있지만 마지막 요청은 실패 (이전 서버 데이터 표시)
//   error    서버에 한 번도 닿지 못함 (errorMessage로 안내)

import { useCallback, useEffect, useRef, useState } from "react";
import { useVpn } from "../context/VpnContext";
import { useGeneralSettings } from "../context/GeneralSettingsContext";

// 조회에 실패하면 이 간격으로 다시 시도한다 (보드 목록 useCameraList도 같은 값을 쓴다)
// 요청 하나의 타임아웃(5초)과는 별개
export const RETRY_MS = 15000;

const INITIAL_STATE = { data: null, source: "loading", fetchedAt: null, errorMessage: null };

function useServerResource(fetcher, { pollMs = 0, key = "", followAutoRefresh = false } = {}) {
  const [ state, setState ] = useState(INITIAL_STATE);
  const [ isFetching, setIsFetching ] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const requestIdRef = useRef(0);

  // 타이머 안에서 최신 VPN 상태를 읽기 위해 ref로 둔다
  const { isVpnDown } = useVpn();
  const vpnDownRef = useRef(isVpnDown);
  vpnDownRef.current = isVpnDown;

  // VPN이 끊겨 멈춘 자동 조회를 VPN 복구 후 이어서 실행할 함수
  const resumeRef = useRef(null);

  // 자동 새로고침이 꺼져 반복 조회를 멈췄는지. 타이머 안에서 최신 값을 읽기 위해 ref로 둔다
  const { autoRefresh } = useGeneralSettings();
  const pollPaused = followAutoRefresh && !autoRefresh && pollMs > 0;
  const pollPausedRef = useRef(pollPaused);
  pollPausedRef.current = pollPaused;

  // 조회 루프를 밖(설정 변경 · VPN 복구)에서 움직이는 함수들 (아래 effect가 채운다)
  const loopRef = useRef(null);

  // 성공 여부를 돌려준다 (다음 재조회 간격을 정하는 데 쓴다)
  const load = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++requestIdRef.current;
    const isLatest = () => requestId === requestIdRef.current;

    setIsFetching(true);

    try {
      const data = await fetcherRef.current({ silent });

      if (isLatest()) {
        setState({ data, source: "server", fetchedAt: new Date(), errorMessage: null });
        setIsFetching(false);
      }

      return true;
    } catch (error) {
      if (!silent) {
        console.warn("[useServerResource] 조회 실패", error);
      }

      if (isLatest()) {
        setState((prev) => ({
          ...prev,
          source: prev.fetchedAt ? "stale" : "error",
          errorMessage: error.message,
        }));
        setIsFetching(false);
      }

      return false;
    }
  }, []);

  useEffect(() => {
    let timer = null;
    let stopped = false;

    setState(INITIAL_STATE);

    // 마지막 조회 결과: null(아직 없음) | true(성공) | false(실패)
    let lastSucceeded = null;
    let running = false;  // 조회 중인지 (탭이 다시 보일 때 겹쳐 보내지 않는다)

    async function tick(silent) {
      running = true;

      // 브라우저 탭이 숨겨져 있으면 요청을 건너뛰고, 마지막 조회 결과로 다음 간격을 정한다 (useCameraList와 같은 규칙)
      if (!document.hidden) {
        lastSucceeded = await load({ silent });
      }

      running = false;

      if (stopped) {
        return;
      }

      // 성공 → pollMs, 실패 → RETRY_MS
      // 아직 결과가 없으면 pollMs (pollMs가 없으면 RETRY_MS — 다시 불러올 차례가 있어야 하므로)
      // 자동 새로고침이 꺼져 있으면 pollMs가 없는 것처럼 성공한 뒤의 반복 조회만 멈춘다
      const repeatMs = pollPausedRef.current ? 0 : pollMs;
      const delay =
        lastSucceeded === true ? repeatMs
          : lastSucceeded === false ? RETRY_MS
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

    // 브라우저 탭이 다시 보이면 다음 차례를 기다리지 않고 바로 조회한다
    // 다음 차례가 잡혀 있거나, 자동 새로고침이 꺼져 반복 조회를 멈춘 경우에만 한다
    // (원래 반복 조회가 없는 화면은 그대로, VPN이 끊겼으면 next()가 복구를 기다린다)
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
        if (stopped || running || lastSucceeded !== true) {
          return;
        }

        clearTimeout(timer);
        timer = null;

        // 켜졌으면 바로 조회하고 반복 조회를 이어 간다. 꺼졌으면 잡혀 있던 반복 조회 차례를 지운다
        if (!pollPausedRef.current) {
          next();
        }
      },
      // VPN이 복구됐는데 이어 갈 차례(resumeRef)가 없을 때 바로 조회한다
      // - 실패 재시도를 기다리는 중: 그 실패는 VPN 끊김 때문이므로 남은 시간을 기다리지 않는다
      // - 자동 새로고침이 꺼져 반복 조회를 멈춘 상태: 한 번 다시 조회한다
      // 성공 뒤 반복 조회를 기다리는 중이면 곧 차례가 오므로 그대로 둔다
      onVpnRestored() {
        if (stopped || running) {
          return;
        }

        const waitingRetry = timer !== null && lastSucceeded === false;
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
      requestIdRef.current += 1;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [key, load, pollMs]);

  // 자동 새로고침 설정이 바뀌면 반복 조회를 바로 멈추거나 다시 시작한다
  useEffect(() => {
    loopRef.current?.onPollPausedChange();
  }, [pollPaused]);

  // VPN이 다시 연결되면 멈춰 둔 자동 조회를 바로 이어서 한다
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

  // 서버 반영이 끝난 값을 다음 재조회 전까지 화면에 바로 보여 줄 때 쓴다
  const setData = useCallback((updater) => {
    setState((prev) => ({
      ...prev,
      data: typeof updater === "function" ? updater(prev.data) : updater,
    }));
  }, []);

  const refresh = useCallback(() => load(), [load]);

  return {
    data: state.data,
    source: state.source,
    fetchedAt: state.fetchedAt,
    errorMessage: state.errorMessage,
    isReady: state.fetchedAt !== null,  // 서버 응답을 한 번이라도 받았는지
    isFetching,
    refresh,
    setData,
  };
}

export default useServerResource;
