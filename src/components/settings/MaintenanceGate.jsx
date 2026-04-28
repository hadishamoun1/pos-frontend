import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

function getToken() {
  return sessionStorage.getItem("token");
}

// decode JWT payload (no verify) just to read userId/sub
function getUserIdFromToken(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    // you used: sub: user.id
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

async function fetchAuthState() {
  const res = await fetch(`${API_BASE}/auth/state`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function MaintenanceGate() {
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    let alive = true;

    async function check() {
      const r = await fetchAuthState();
      if (!alive || !r.ok) return;

      const isLocked = !!r.data?.isLocked;
      const allowedUserId = r.data?.lockAllowedUserId ?? null;

      const token = getToken();
      const tokenUserId = getUserIdFromToken(token);

      const isOnMaintenance = loc.pathname === "/maintenance";
      const isOnLogin = loc.pathname === "/" || loc.pathname === "/login";

      const params = new URLSearchParams(loc.search || "");
      const adminBypass = params.get("admin") === "1";

      // ✅ if locked:
      // - allow if you're already logged in as the allowed admin
      // - allow login page ONLY when adminBypass=1
      // - otherwise force /maintenance
      if (isLocked) {
        const allowedAdminSession =
          tokenUserId != null && allowedUserId != null && Number(tokenUserId) === Number(allowedUserId);

        if (allowedAdminSession) return;

        if (isOnLogin && adminBypass) return;

        if (!isOnMaintenance) nav("/maintenance", { replace: true });
        return;
      }

      // ✅ if not locked:
      // - if you are stuck on maintenance, go to login
      if (!isLocked && isOnMaintenance) {
        nav("/", { replace: true });
      }
    }

    check();
    const t = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [loc.pathname, loc.search, nav]);

  return null;
}
