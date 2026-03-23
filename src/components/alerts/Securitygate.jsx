import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { hasPerm } from "../auth/authz";
import { axiosClient } from "../api/axiosClient";
import SecurityLockdown from "./Securitylockdown";

const POLL_INTERVAL = 5000;

// Pages where Ctrl+L bypass is allowed (unauthenticated pages only)
const LOGIN_PATHS = ["/", "/login"];

const SecurityGate = () => {
  const [locked, setLocked] = useState(false);
  const [bypassed, setBypassed] = useState(false);
  const location = useLocation();

  const isAdmin = hasPerm("users.manage");
  const isLoginPage = LOGIN_PATHS.includes(location.pathname);

  // Poll the backend every 5 seconds
  useEffect(() => {
    const check = async () => {
      try {
        const res = await axiosClient.get("/security-alert");
        const data = res.data;
        setLocked(data.isActive === true);
      } catch (e) {
        // silent
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Ctrl+L only works on login page — not for already logged-in users
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        if (isLoginPage) {
          setBypassed(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoginPage]);

  // Reset bypass whenever the page changes or lockdown is lifted
  useEffect(() => {
    setBypassed(false);
  }, [location.pathname, locked]);

  // Decision:
  // - Not locked → show nothing
  // - Admin (has users.manage) → show nothing, they can go to settings and turn it off
  // - On login page + Ctrl+L pressed → show nothing, let them log in
  // - Everyone else → show lockdown screen
  if (!locked || isAdmin || (isLoginPage && bypassed)) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999 }}>
      <SecurityLockdown />
    </div>
  );
};

export default SecurityGate;