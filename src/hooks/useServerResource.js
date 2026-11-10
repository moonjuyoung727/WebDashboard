// 서버 조회 공통 처리 — 목업 없이 서버 응답만 보여 준다
// - 화면에 들어오면 바로 한 번 불러오고, pollMs가 있으면 성공한 뒤 pollMs마다 다시 불러온다
// - 실패하면 5초마다 재시도하다가 연결되면 서버 데이터로 바뀐다
// - key가 바뀌면(예: 조회 기간 변경) 비우고 다시 불러온다. 앞 요청의 늦은 응답은 버린다
//
// source (useCameraList와 같은 의미)
//   loading  첫 요청 응답을 기다리는 중
//   server   서버 데이터 (마지막 요청 성공)
//   stale    서버 데이터를 받은 적은 있지만 마지막 요청은 실패 (이전 서버 데이터 표시)
//   error    서버에 한 번도 닿지 못함 (errorMessage로 안내)

import { useCallback, useEffect, useRef, useState } from "react";

const RETRY_MS = 5000;

const INITIAL_STATE = { data: null, source: "loading", fetchedAt: null, errorMessage: null };

function useServerResource(fetcher, { pollMs = 0, key = "" } = {}) {
  const [ state, setState ] = useState(INITIAL_STATE);
  const [ isFetching, setIsFetching ] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const requestIdRef = useRef(0);

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

    async function tick(silent) {
      // 브라우저 탭이 숨겨져 있으면 요청을 건너뛰고 다음 차례를 기다린다
      const isHidden = document.hidden;
      const succeeded = isHidden ? false : await load({ silent });

      if (stopped) {
        return;
      }

      const delay = succeeded ? pollMs : RETRY_MS;

      if (delay > 0) {
        timer = setTimeout(() => tick(true), delay);
      }
    }

    tick(false);

    return () => {
      stopped = true;
      clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [key, load, pollMs]);

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
