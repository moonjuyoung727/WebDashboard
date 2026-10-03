import { useState } from "react";
import { initialVpnDevices } from "../data/vpnDevices";
import Pagination from "../components/Pagination";
import useFitPagination from "../hooks/useFitPagination";
import Toggle from "../components/Toggle";
import { useNavigate } from "react-router-dom";
import VpnSummary from "../components/vpn/VpnSummary";
import VpnDeviceTable from "../components/vpn/VpnDeviceTable";
import { useVpn } from "../context/VpnContext";
import { VPN_STATUS_META } from "../components/charts/chartColors";
import VpnDeviceDetailModal from "../components/vpn/VpnDeviceDetailModal";
// import { connectClientVpn, getVpnDevices } from "../api/vpnApi";  // 서버 연결 후 주석 해제
import "./VpnManage.css";

function VpnManage() {
  const navigate = useNavigate();
    const { peerVpnStatus, setPeerVpnStatus } = useVpn();
    const [ devices, setDevices ] = useState(initialVpnDevices);
    const [ searchKeyword, setSearchKeyword ] = useState("");
    const [ statusFilter, setStatusFilter ] = useState("all");
    const [refreshing, setRefreshing] = useState(false);
    const [ lastUpdated, setLastUpdated ] = useState(
        new Date().toLocaleString()
    );

    // WEB-F-054 상세 정보 모달
    const [ selectedDevice, setSelectedDevice ] = useState(null);

    /* 상태 요약 */
    const totalDevices = devices.length;

    const connectedDevices = devices.filter(
        (device) => device.vpnStatus === "connected"
    ).length;

    const disconnectedDevices = devices.filter(
        (device) => device.vpnStatus === "disconnected"
    ).length;

    const errorDevices = devices.filter(
        (device) => device.vpnStatus === "error"
    ).length;

    /* 검색, 필터 */
    const filteredDevices = devices.filter((devices) => {
        const keyword = searchKeyword.toLowerCase();
        
        const matchesSearch = 
            devices.name.toLowerCase().includes(keyword) ||
            devices.serial.toLowerCase().includes(keyword);
        
        const matchesStatus = 
            statusFilter === "all" ||
            devices.vpnStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    /* pagination: 화면 높이에 들어가는 만큼만 한 페이지에 표시 */
    const {
        areaRef: tableAreaRef,
        pageItems: currentDevices,
        page: currentPage,
        setPage: setCurrentPage,
        totalPages,
    } = useFitPagination(filteredDevices);

    /* search */
    function handleSearchChange(e) {
        setSearchKeyword(e.target.value);
        setCurrentPage(1);
    }

    /* filter */
    function handleStatusChange(e) {
        setStatusFilter(e.target.value);
        setCurrentPage(1);
    }

    function handleFilterReset() {
        setSearchKeyword("");
        setStatusFilter("all");
        setCurrentPage(1);
    }

    /* VPN connected / disconnected */
    function handleConnection(deviceId) {
        setDevices((prev) => 
            prev.map((device) => {
                if (device.id !== deviceId) {
                    return device;
                }
                const isConnected = 
                    device.vpnStatus === "connected";
                return {
                    ...device,
                    vpnStatus: isConnected
                        ? "disconnected"
                        : "connected",
                    duration: isConnected
                        ? "-"
                        : "방금 연결됨",
                    vpnIp: isConnected
                        ? "-"
                        : `10.0.0.${100 + device.id}`,
                    lastHandshake: isConnected
                        ? "-"
                        : new Date().toLocaleString(),
                    error: null
                };
            })
        );
    }

    /* auto connect toggle */
    function handleToggle(deviceId, key) {
        setDevices((prev) => 
            prev.map((device) =>
              device.id === deviceId
                ? {
                    ...device,
                    [key]: !device[key]
                  }
                : device
            ) 
        );
    }

    async function handlePeerReconnect() {
      setPeerVpnStatus("connecting");
      try {

        /*  실제 서버 연동 시 사용
        const data = await connectClientVpn();

        if (data.connected) {
          setPeerVpnStatus("connected");

          setTimeout(() => {
            navigate("/dashboard", {replace: true});
          }, 1200);
        } else {
          setPeerVpnStatus("error");
        }  */

        //현재 테스트용

        setTimeout(() => {
          const connectSuccess = true;

          if (connectSuccess) {
            setPeerVpnStatus("connected");
          } else {
            setPeerVpnStatus("error");
          }
        }, 1500);
  
      } catch (error) {
        console.error("VPN 연결 실패:", error);

        setPeerVpnStatus("error");
      }
    }


/*  나중에 서버 연결 후 api 호출 */
    function handleRefresh() {
      setRefreshing(true);

      // 서버 연결 전 임시 새로고침 효과
      setTimeout(() => {
        setLastUpdated(new Date().toLocaleString());
        setRefreshing(false);
      }, 600);
    }

    /* 서버 연결 후 서버 연결 중에만 아이콘 회전
    async function handleRefresh() {
      setRefreshing(true);

      try {
        const data = await getVpnDevices();

        setDevices(data);
        setLastUpdated(new Date().toLocaleString());
      } catch (error) {
        console.error(error);
      } finally {
        setRefreshing(false);
      }
    } */

    return (
      <main className="vpn-page">

        {/* Client VPN 연결 + 카메라 VPN 상태 요약 */}
        <VpnSummary
          peerStatus={peerVpnStatus}
          onPeerReconnect={handlePeerReconnect}
          totalDevices={totalDevices}
          connectedDevices={connectedDevices}
          disconnectedDevices={disconnectedDevices}
          errorDevices={errorDevices}
          refreshing={refreshing}
          lastUpdated={lastUpdated}
          onRefresh={handleRefresh}
        />

        <section className="vpn-table-section">
          <div className="vpn-toolbar">
            <input
              type="text"
              placeholder="카메라 이름 또는 시리얼 번호 검색"
              value={searchKeyword}
              onChange={handleSearchChange}
            />

            <select
              value={statusFilter}
              onChange={handleStatusChange}
            >
              <option value="all">
                연결 상태 전체
              </option>
              {Object.entries(VPN_STATUS_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="filter-reset-button"
              onClick={handleFilterReset}
            >
              필터 초기화
            </button>
          </div>

          <div className="vpn-table-area" ref={tableAreaRef}>
            <VpnDeviceTable
              devices={currentDevices}
              onToggle={handleToggle}
              onRecoveryRequest={handleConnection}
              onSelect={setSelectedDevice}
            />
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredDevices.length}
            itemLabel="대"
          />
        </section>

        {selectedDevice && (
          <VpnDeviceDetailModal
            device={selectedDevice}
            onClose={() => setSelectedDevice(null)}
          />
        )}
      </main>
    );
}

export default VpnManage;