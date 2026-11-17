import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "../components/Pagination";
import VpnSummary from "../components/vpn/VpnSummary";
import VpnDeviceTable from "../components/vpn/VpnDeviceTable";
import VpnDeviceDetailModal from "../components/vpn/VpnDeviceDetailModal";
import useFitPagination from "../hooks/useFitPagination";
import { RETRY_MS } from "../hooks/useServerResource";
import { useVpn } from "../context/VpnContext";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { vpnApi, loadVpnData } from "../api/vpnApi";
import { setAuthToken } from "../api/client";
import "./VpnManage.css";

function errorMessage(error) {
  if (error.name === "TimeoutError")
    return "VPN 서버 응답 시간이 초과되었습니다. 연결 상태를 확인하고 다시 시도해주세요.";
  if (error instanceof TypeError)
    return "VPN 서버에 접근할 수 없습니다. WireGuard 앱과 네트워크 연결을 확인해주세요.";
  return error.message || "VPN 요청을 처리하지 못했습니다.";
}

// 조회에 성공하면 이 간격으로 다시 불러온다 (실패하면 RETRY_MS — 다른 화면과 같은 15초)
const VPN_POLL_MS = 10000;

function VpnManage() {
  const navigate = useNavigate();
  const { isVpnDown } = useVpn();

  // 자동 재조회는 useServerResource · useCameraList와 같은 규칙을 따른다
  // - 앞 조회가 끝난 뒤 다음 차례를 잡는다 (성공 VPN_POLL_MS · 실패 RETRY_MS)
  // - 브라우저 탭이 숨겨져 있으면 그 차례는 건너뛰고, 다시 보이면 바로 조회한다
  // - Client VPN이 끊긴 동안은 자동 재조회를 멈추고, VPN이 다시 연결되면 바로 이어서 불러온다 (새로고침 버튼은 그대로)
  //   실패 재시도를 기다리던 중에 VPN이 복구돼도 남은 시간을 기다리지 않고 바로 불러온다
  // - 일반 설정의 "자동 새로고침"이 꺼지면 성공한 뒤의 반복 조회만 멈춘다
  //   (첫 조회 · 실패 재시도 · 새로고침 · 탭 복귀 조회는 그대로, VPN이 복구되면 한 번 다시 조회, 다시 켜면 바로 조회)
  const vpnDownRef = useRef(isVpnDown);
  vpnDownRef.current = isVpnDown;
  const { autoRefresh } = useGeneralSettings();
  const pollPausedRef = useRef(!autoRefresh);
  pollPausedRef.current = !autoRefresh;
  const resumeRef = useRef(null);       // VPN이 끊겨 멈춘 자동 재조회를 VPN 복구 후 이어서 실행할 함수
  const loopRef = useRef(null);         // 조회 루프를 밖(설정 변경 · VPN 복구)에서 움직이는 함수들
  const lastLoadOk = useRef(null);      // 마지막 조회 결과: null(아직 없음) | true(성공) | false(실패)
  const [selectedId, setSelectedId] = useState(null);
  const [devices, setDevices] = useState([]);
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const mounted = useRef(false);
  const fetchController = useRef(null);
  const actionController = useRef(null);
  const mutationBusy = useRef(false);

  const handleUnauthorized = useCallback(
    (error) => {
      if (error.status !== 401) return false;
      setAuthToken(null);
      navigate("/login", { replace: true });
      return true;
    },
    [navigate],
  );

  const fetchVpnData = useCallback(async () => {
    fetchController.current?.abort();
    const controller = new AbortController();
    fetchController.current = controller;
    setRefreshing(true);
    try {
      const data = await loadVpnData({ signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      setDevices(data.devices);
      setServer(data.server);
      // 조회에 성공해도 Client VPN 연결됨으로 바꾸지 않는다. 연결 여부는 VpnContext가 /status로만 정한다
      // (VPN이 끊긴 상태였다면 이 응답을 받은 apiFetch가 /status 확인을 바로 앞당긴다)
      lastLoadOk.current = true;
      setLoadError("");
      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      lastLoadOk.current = false;
      // 실패해도 여기서 Client VPN 오류로 바꾸지 않는다 (다른 조회 화면과 같은 규칙)
      // 서버에 닿지 못한 경우(네트워크 오류 · 타임아웃)는 apiFetch가 이미 VPN 끊김으로 알린다.
      // 서버가 오류로 응답한 경우(VPN 서버 비정상 등)는 Client VPN 문제가 아니므로 화면에 오류만 보여 준다
      if (!handleUnauthorized(error)) setLoadError(errorMessage(error));
    } finally {
      if (fetchController.current === controller) fetchController.current = null;
      if (mounted.current && !controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    mounted.current = true;
    let timer = null;
    let stopped = false;
    let running = false;  // 자동 조회 중인지 (탭이 다시 보일 때 겹쳐 보내지 않는다)

    async function tick() {
      running = true;
      // 탭이 숨겨져 있거나, 기기 조작 · 새로고침 조회가 진행 중이면 이 차례는 건너뛴다
      if (!document.hidden && !mutationBusy.current && !fetchController.current) await fetchVpnData();
      running = false;
      if (stopped) return;
      // 마지막 조회 결과로 다음 간격을 정한다 (건너뛴 차례도 같다). 아직 결과가 없으면 VPN_POLL_MS
      // 자동 새로고침이 꺼져 있으면 성공한 뒤의 반복 조회만 멈춘다
      if (lastLoadOk.current === false) timer = setTimeout(next, RETRY_MS);
      else if (lastLoadOk.current === null || !pollPausedRef.current) timer = setTimeout(next, VPN_POLL_MS);
    }

    // 자동 재조회 차례. Client VPN이 끊겨 있으면 요청하지 않고 VPN 복구를 기다린다
    function next() {
      timer = null;
      if (vpnDownRef.current) {
        resumeRef.current = tick;
        return;
      }
      tick();
    }

    // 브라우저 탭이 다시 보이면 다음 차례를 기다리지 않고 바로 조회한다
    // 다음 차례가 잡혀 있거나, 자동 새로고침이 꺼져 반복 조회를 멈춘 경우에만 한다
    function handleVisibilityChange() {
      if (document.hidden || running || (timer === null && !pollPausedRef.current)) return;
      clearTimeout(timer);
      next();
    }

    loopRef.current = {
      // 자동 새로고침을 켜거나 껐을 때. 반복 조회 차례(마지막 조회 성공)일 때만 바꾼다
      onPollPausedChange() {
        if (stopped || running || lastLoadOk.current !== true) return;
        clearTimeout(timer);
        timer = null;
        // 켜졌으면 바로 조회하고 반복 조회를 이어 간다. 꺼졌으면 잡혀 있던 반복 조회 차례를 지운다
        if (!pollPausedRef.current) next();
      },
      // VPN이 복구됐는데 이어 갈 차례(resumeRef)가 없을 때 바로 조회한다 (useServerResource와 같은 규칙)
      // - 실패 재시도를 기다리는 중: 그 실패는 VPN 끊김 때문이므로 남은 시간을 기다리지 않는다
      // - 자동 새로고침이 꺼져 반복 조회를 멈춘 상태: 한 번 다시 조회한다
      onVpnRestored() {
        if (stopped || running) return;
        const waitingRetry = timer !== null && lastLoadOk.current === false;
        const idlePaused = timer === null && pollPausedRef.current;
        if (!waitingRetry && !idlePaused) return;
        clearTimeout(timer);
        timer = null;
        tick();
      },
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 화면에 들어올 때의 첫 조회는 VPN 상태와 관계없이 한다 (다른 화면과 같은 규칙)
    tick();

    return () => {
      mounted.current = false;
      stopped = true;
      clearTimeout(timer);
      resumeRef.current = null;
      loopRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      fetchController.current?.abort();
      actionController.current?.abort();
    };
  }, [fetchVpnData]);

  // 자동 새로고침 설정이 바뀌면 반복 조회를 바로 멈추거나 다시 시작한다
  useEffect(() => {
    loopRef.current?.onPollPausedChange();
  }, [autoRefresh]);

  // VPN이 다시 연결되면 멈춰 둔 자동 재조회를 바로 이어서 한다
  // 이어 갈 차례가 없으면 실패 재시도 대기 · 자동 새로고침 꺼짐일 때 바로 조회한다 (onVpnRestored)
  useEffect(() => {
    if (isVpnDown) return;
    if (resumeRef.current) {
      const resume = resumeRef.current;
      resumeRef.current = null;
      resume();
    } else {
      loopRef.current?.onVpnRestored();
    }
  }, [isVpnDown]);

  async function performAction(device, action) {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    fetchController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    setPending({ id: device.id, action });
    setActionError("");
    setNotice("");
    try {
      const result =
        action === "recover"
          ? await vpnApi.recoverVpnConnection(device.id, {
              signal: controller.signal,
            })
          : await vpnApi.executeVpnAction(device.id, action, {
              signal: controller.signal,
            });
      if (!mounted.current || controller.signal.aborted) return;
      if (result?.success !== true)
        throw new Error("서버에서 VPN 요청을 완료하지 못했습니다.");
      setNotice(
        `${device.name}: ${action === "recover" ? "복구" : action === "connect" ? "연결" : "연결 해제"} 요청을 처리했습니다.`,
      );
      await fetchVpnData();
    } catch (error) {
      if (
        mounted.current &&
        !controller.signal.aborted &&
        !handleUnauthorized(error)
      )
        setActionError(errorMessage(error));
    } finally {
      mutationBusy.current = false;
      if (mounted.current) {
        setPending(null);
        setRefreshing(false);
      }
    }
  }

  const filteredDevices = devices.filter((device) => {
    const keyword = searchKeyword.trim().toLowerCase();
    return (
      [device.name, device.mac, device.id].some((value) =>
        value.toLowerCase().includes(keyword),
      ) &&
      (statusFilter === "all" || device.vpnStatus === statusFilter)
    );
  });
  const { areaRef: tableAreaRef, pageItems: currentDevices, page, setPage: setCurrentPage, totalPages } = useFitPagination(filteredDevices);
  const selectedDevice = devices.find((device) => device.id === selectedId);
  const unavailable =
    loading || refreshing || Boolean(pending) || Boolean(loadError);

  return (
    <main
      className="vpn-page"
      aria-busy={loading || refreshing || Boolean(pending)}
    >
      {loadError && (
        <p className="vpn-feedback error" role="alert">
          {loadError}
          {lastUpdated ? " 아래 목록은 마지막으로 조회한 상태입니다." : ""}
        </p>
      )}
      {actionError && (
        <p className="vpn-feedback error" role="alert">
          {actionError}
        </p>
      )}
      {notice && (
        <p className="vpn-feedback" role="status">
          {notice}
        </p>
      )}
      {loading && <p role="status">VPN 연결 정보를 불러오고 있습니다...</p>}
      <VpnSummary
        simulated={server?.driver_mode === "virtual"}
        peerStatus={loading ? "connecting" : loadError ? "error" : server ? "connected" : "disconnected"}
        totalDevices={devices.length}
        connectedDevices={
          devices.filter((d) => d.vpnStatus === "connected").length
        }
        disconnectedDevices={
          devices.filter((d) => d.vpnStatus === "disconnected").length
        }
        errorDevices={devices.filter((d) => d.vpnStatus === "error").length}
        refreshing={refreshing}
        disabled={refreshing || Boolean(pending)}
        lastUpdated={lastUpdated || "아직 조회되지 않음"}
        onRefresh={fetchVpnData}
      />
      <section className="vpn-table-section">
        <div className="vpn-toolbar">
          <input
            aria-label="VPN 카메라 검색"
            type="search"
            placeholder="카메라 이름, MAC 또는 기기 ID 검색"
            value={searchKeyword}
            onChange={(event) => {
              setSearchKeyword(event.target.value);
              setCurrentPage(1);
            }}
          />
          <select
            aria-label="VPN 연결 상태 필터"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">연결 상태 전체</option>
            <option value="connected">연결됨</option>
            <option value="disconnected">연결 안 됨</option>
            <option value="error">연결 오류</option>
          </select>
          <button
            type="button"
            className="filter-reset-button"
            onClick={() => {
              setSearchKeyword("");
              setStatusFilter("all");
              setCurrentPage(1);
            }}
          >
            필터 초기화
          </button>
        </div>
        <div className="vpn-table-area" ref={tableAreaRef}>
        <VpnDeviceTable
          onSelect={(device) => setSelectedId(device.id)}
          devices={currentDevices}
          pending={pending}
          disabled={unavailable}
          emptyMessage={
            loading
              ? "조회 중입니다."
              : loadError && !lastUpdated
                ? "연결 정보를 조회하지 못했습니다."
                : devices.length
                  ? "검색 조건에 맞는 카메라가 없습니다."
                  : "등록된 카메라 VPN 기기가 없습니다."
          }
          onConnection={(id) => {
            const device = devices.find((d) => d.id === id);
            if (device)
              performAction(
                device,
                device.vpnStatus === "connected" ? "disconnect" : "connect",
              );
          }}
          onRecoveryRequest={(id) => {
            const device = devices.find((d) => d.id === id);
            if (device) performAction(device, "recover");
          }}
        />
        </div>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredDevices.length}
          itemLabel="대"
        />
      </section>
      {selectedDevice && <VpnDeviceDetailModal device={selectedDevice} onClose={() => setSelectedId(null)}
        onRecoveryRequest={unavailable ? undefined : (id) => { const device = devices.find((item) => item.id === id); if (device) performAction(device, "recover"); }} />}
    </main>
  );
}
export default VpnManage;
