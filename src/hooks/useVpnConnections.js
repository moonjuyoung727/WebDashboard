// VPN 연결 상태 목록 (ICD 2.5.1 GET /vpn/connections) — VPN 연결 관리 화면용
// 5초마다 다시 불러와서 복구 요청 후 결과 · 핸드셰이크 시간 · 오류 상태를 반영한다
// 실패 처리는 useServerResource와 같다 (한 번도 못 받으면 빈 화면과 오류 안내, 받은 적 있으면 이전 목록 유지)

import { useCallback } from "react";
import { getVpnDevices } from "../api/vpnApi";
import useServerResource from "./useServerResource";

export const VPN_POLL_MS = 5000;

function useVpnConnections({ pollMs = VPN_POLL_MS } = {}) {
  const { data, setData, ...rest } = useServerResource(
    ({ silent }) => getVpnDevices({ silent }),
    { pollMs }
  );

  const setDevices = useCallback(
    (updater) => setData((prev) => updater(prev ?? [])),
    [setData]
  );

  return { ...rest, devices: data ?? [], setDevices };
}

export default useVpnConnections;
