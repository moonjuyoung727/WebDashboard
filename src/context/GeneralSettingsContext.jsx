import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getGeneralSettings } from "../api/settingsApi";

// 일반 설정 (GET /general-settings) — 모든 화면이 함께 읽는다 (Android SettingsRepository.general과 같은 역할)
// - 로그인 후 메인 화면이 뜰 때 한 번 불러온다. 실패하면 기본값(자동 새로고침 켜짐)을 쓰고 다시 시도하지 않는다
// - 일반 설정 화면이 서버에서 다시 받거나 값을 바꾸면 setGeneralSettings로 바로 반영한다
//   (값을 먼저 바꾸고, 저장에 실패하면 이전 값으로 되돌리는 것은 일반 설정 화면이 한다)
//
// autoRefresh가 꺼지면 보드 목록 · 대시보드 이벤트 · 이벤트 로그 · VPN 관리의 반복 조회를 멈춘다
// (화면 첫 조회 · 실패 재시도 · 새로고침 · 탭 복귀 조회는 그대로. 상단 알림 · 영상 · VPN /status 확인은 설정과 상관없음)

const DEFAULT_SETTINGS = { autoRefresh: true };

const GeneralSettingsContext = createContext(null);

export function GeneralSettingsProvider({ children }) {
  const [ settings, setSettings ] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    getGeneralSettings({ silent: true })
      .then((data) => {
        if (!cancelled && data) {
          setSettings((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((error) => {
        console.warn("[GeneralSettings] 일반 설정을 불러오지 못해 기본값(자동 새로고침 켜짐)을 씁니다", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setGeneralSettings = useCallback((updater) => {
    setSettings((prev) => ({
      ...prev,
      ...(typeof updater === "function" ? updater(prev) : updater),
    }));
  }, []);

  return (
    <GeneralSettingsContext.Provider value={{ settings, setGeneralSettings }}>
      {children}
    </GeneralSettingsContext.Provider>
  );
}

// Provider 밖(로그인 화면 등)에서는 기본값을 돌려준다
export function useGeneralSettings() {
  const context = useContext(GeneralSettingsContext);

  return {
    autoRefresh: context ? context.settings.autoRefresh !== false : DEFAULT_SETTINGS.autoRefresh,
    setGeneralSettings: context?.setGeneralSettings ?? (() => {}),
  };
}
