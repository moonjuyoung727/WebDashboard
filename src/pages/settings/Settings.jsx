
import { NavLink, Outlet } from "react-router-dom";
import "./Settings.css";

function Settings() {
  return (
    <main className="settings-page">

      <aside className="settings-menu">
        <NavLink
          to="/settings/general"
          className={({ isActive }) =>
            isActive ? "settings-menu-item active" : "settings-menu-item"
          }
        >
          일반 설정
        </NavLink>

        <NavLink
          to="/settings/notifications"
          className={({ isActive }) =>
            isActive ? "settings-menu-item active" : "settings-menu-item"
          }
        >
          알림 설정
        </NavLink>

        <NavLink
          to="/settings/subscription"
          className={({ isActive }) =>
            isActive
              ? "settings-menu-item active"
              : "settings-menu-item"
          }
        >
          구독 설정
        </NavLink>

        <NavLink
          to="/settings/storage"
          className={({ isActive }) =>
            isActive ? "settings-menu-item active" : "settings-menu-item"
          }
        >
          저장소 설정
        </NavLink>

        <NavLink
          to="/settings/privacy-zones"
          className={({ isActive }) =>
            isActive ? "settings-menu-item active" : "settings-menu-item"
          }
        >
          프라이버시 존
        </NavLink>

        <NavLink
          to="/settings/account"
          className={({ isActive }) =>
            isActive ? "settings-menu-item active" : "settings-menu-item"
          }
        >
          계정 설정
        </NavLink>
      </aside>

      <section className="settings-content">
        <Outlet />
      </section>

    </main>
  );
}

export default Settings;