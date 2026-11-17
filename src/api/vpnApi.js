import { apiClient, apiFetch, toApiError } from "./client.js";
import { isInSubnet, VPN_CLIENT_SUBNET } from "./config.js";

// A separate VPN deployment may override the shared controller /v1 base.
const VPN_BASE_URL = (process.env.REACT_APP_VPN_API_BASE_URL || "").replace(
  /\/$/,
  "",
);
const endpoint = (path) =>
  VPN_BASE_URL ? `${VPN_BASE_URL}/vpn${path}` : `/vpn${path}`;
const optionsWithTimeout = (options = {}) => ({ timeoutMs: 10000, ...options });

export function normalizeConnections(connections) {
  if (!Array.isArray(connections))
    throw new Error("VPN 연결 목록 응답 형식이 올바르지 않습니다.");
  return connections.map((connection) => {
    // Current C4 uses device_id; canonical MAC responses are also supported.
    const id = connection.device_id || connection.peer_id || connection.mac;
    if (
      !id ||
      !["connected", "disconnected", "error"].includes(connection.vpn_status)
    ) {
      throw new Error("VPN 기기 식별자 또는 연결 상태가 올바르지 않습니다.");
    }
    const handshake = connection.last_handshake
      ? new Date(connection.last_handshake)
      : null;
    return {
      id,
      name: connection.device_name || connection.name || id,
      mac:
        connection.mac ||
        connection.mac_no?.replaceAll(":", "").toUpperCase() ||
        "-",
      vpnStatus: connection.vpn_status,
      vpnIp: connection.vpn_ip || "-",
      lastHandshake:
        handshake && !Number.isNaN(handshake.getTime())
          ? handshake.toLocaleString()
          : "-",
      duration: Number.isFinite(connection.connected_duration_sec)
        ? `${connection.connected_duration_sec}초`
        : "-",
      error: connection.error_type || null,
      server: connection.vpn_server || "-",
    };
  });
}

export const vpnApi = {
  getVpnStatus: (options) =>
    apiClient.get(endpoint("/status"), optionsWithTimeout(options)),
  getVpnConnections: (options) =>
    apiClient.get(endpoint("/connections"), optionsWithTimeout(options)),
  getVpnConnection: (id, options) =>
    apiClient.get(
      endpoint(`/connections/${encodeURIComponent(id)}`),
      optionsWithTimeout(options),
    ),
  executeVpnAction: (id, action, options) =>
    apiClient.post(
      endpoint(`/connections/${encodeURIComponent(id)}/action`),
      { action },
      optionsWithTimeout(options),
    ),
  recoverVpnConnection: (id, options) =>
    apiClient.post(
      endpoint(`/connections/${encodeURIComponent(id)}/recover`),
      {},
      optionsWithTimeout(options),
    ),
  registerVpnPeer: (peerData, options) =>
    apiClient.post(
      endpoint("/peers/register"),
      peerData,
      optionsWithTimeout(options),
    ),
  unregisterVpnPeer: (id, options) =>
    apiClient.delete(
      endpoint(`/peers/${encodeURIComponent(id)}`),
      {},
      optionsWithTimeout(options),
    ),
  // The management UI never sends private keys to the server.
  getVpnPeerConfig: (id, options) =>
    apiClient.get(
      endpoint(`/peers/${encodeURIComponent(id)}/config`),
      optionsWithTimeout(options),
    ),
};

export async function loadVpnData(options) {
  const [connections, server] = await Promise.all([
    vpnApi.getVpnConnections(options),
    vpnApi.getVpnStatus(options),
  ]);
  if (server?.status !== "healthy")
    throw new Error("VPN 서버가 정상 상태가 아닙니다.");
  return { devices: normalizeConnections(connections), server };
}
export default vpnApi;

// 클라이언트 VPN 연결 여부 확인: GET /v1/status (인증 없음, 항상 200)
// 서버는 요청의 출발지 IP가 클라이언트 대역(10.0.2.0/24)인지 보고 { connected, client_ip }로 응답한다
// VPN이 꺼져 있으면 요청이 서버에 닿지 않는다. timeoutMs가 지나면 apiFetch가 NetworkError를 던지고,
// VpnContext가 이를 연결 실패로 처리한다
const CLIENT_VPN_CHECK_TIMEOUT_MS = 5000;

// TODO(임시): 서버에 GET /v1/status가 아직 준비되지 않아서 확인을 건너뛰고 항상 연결됨으로 처리한다
// 서버가 준비되면 false로 바꾸거나 이 상수를 지운다
const SKIP_CLIENT_VPN_CHECK = false;

export async function fetchClientVpnStatus(options = {}) {
  if (SKIP_CLIENT_VPN_CHECK) {
    return true;
  }

  const response = await apiFetch(`/status`, {
    timeoutMs: CLIENT_VPN_CHECK_TIMEOUT_MS,
    reportReachable: false,  // 확인 요청 자신의 응답으로 확인을 다시 부르지 않게
    ...options,
  });

  if (!response.ok) {
    throw await toApiError(response, "VPN 상태 확인 실패");
  }

  const data = await response.json();

  // 서버가 알려 준 주소가 클라이언트 대역이 아니면 VPN을 거치지 않은 요청이다
  if (data.client_ip && !isInSubnet(data.client_ip, VPN_CLIENT_SUBNET)) {
    return false;
  }

  return data.connected === true;
}
export async function getVpnDevices({ silent = false, ...options } = {}) { return (await loadVpnData({ ...options, notify: !silent })).devices; }
export const changeVpnConnection = (id, action, options) => vpnApi.executeVpnAction(id, action, options);
export const requestVpnRecovery = (id, options) => vpnApi.recoverVpnConnection(id, options);
