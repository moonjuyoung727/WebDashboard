// API 서버 베이스 URL. .env의 REACT_APP_API_BASE_URL에서 읽는다 (예: http://10.0.0.100:3000/v1)
// 값이 없으면 사이트와 같은 주소의 /v1을 쓴다 (배포 환경: CloudFront가 /v1을 서버로 넘겨 준다)
// 끝에 / 가 붙어 있어도 경로가 // 로 겹치지 않게 잘라 낸다
export const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "/v1").replace(/\/+$/, "");


/* VPN 설정값 (ICD 5.1, I2 인터페이스 요약)
   - 서버 10.0.0.100, WireGuard 포트 51820
   - 보드 대역 10.0.1.0/24, 클라이언트(웹) 대역 10.0.2.0/24
   - 클라이언트 대역 → 보드 대역 포워딩은 차단되어 있어서,
     웹은 보드(10.0.1.x)에 직접 요청하지 않고 항상 서버(10.0.0.100)를 거친다
     (REST는 :3000, 영상 WHEP는 mediamtx :8889) */
export const VPN_SERVER_IP = "10.0.0.100";
export const VPN_PORT = 51820;
export const VPN_BOARD_SUBNET = "10.0.1.0/24";
export const VPN_CLIENT_SUBNET = "10.0.2.0/24";

// ip가 /24 대역 안에 있는지 확인 (예: isInSubnet("10.0.2.5", "10.0.2.0/24") → true)
export function isInSubnet(ip, subnet) {
  const prefix = subnet.split("/")[0].split(".").slice(0, 3).join(".");
  return typeof ip === "string" && ip.startsWith(`${prefix}.`);
}

// 대역 안의 n번째 주소 (예: subnetHost("10.0.1.0/24", 101) → "10.0.1.101")
export function subnetHost(subnet, host) {
  const prefix = subnet.split("/")[0].split(".").slice(0, 3).join(".");
  return `${prefix}.${host}`;
}
