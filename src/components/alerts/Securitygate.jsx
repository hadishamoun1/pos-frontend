import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { hasPerm, getPayload } from "../auth/authz";
import { axiosClient } from "../api/axiosClient";
import SecurityLockdown from "./Securitylockdown";

const POLL_INTERVAL = 5000;
const LOGIN_PATHS = ["/", "/login"];

const SecurityGate = () => {
  const [locked, setLocked] = useState(false);
  const [bypassed, setBypassed] = useState(false);
  const location = useLocation();

  const payload = getPayload();
  const isAdmin = hasPerm("users.manage") || payload?.role === "ADMIN";
  const isLoginPage = LOGIN_PATHS.includes(location.pathname);

  // Poll backend every 5 seconds
  useEffect(() => {
    const check = async () => {
      try {
        const res = await axiosClient.get("/security-alert");
        setLocked(res.data.isActive === true);
      } catch (e) {
        // silent
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Ctrl+L on login page bypasses the lockdown screen to allow admin login
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        if (isLoginPage) setBypassed(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoginPage]);

  // Reset bypass on navigation or when lockdown lifts
  useEffect(() => {
    setBypassed(false);
  }, [location.pathname, locked]);

  // Not locked → nothing to show
  if (!locked) return null;

  // On login page + Ctrl+L → let them through to log in as admin
  if (isLoginPage && bypassed) return null;

  // Admin → show a warning banner so they can still navigate to Settings and turn it off
  if (isAdmin) {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "#b91c1c",
        color: "#fff",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "14px",
        fontWeight: 500,
      }}>
        <span>⚠ Security Lockdown is ACTIVE — all non-admin users are blocked. Go to Settings to disable it.</span>
      </div>
    );
  }

  // Everyone else → full lockdown screen
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999 }}>
      <SecurityLockdown />
    </div>
  );
};

export default SecurityGate;