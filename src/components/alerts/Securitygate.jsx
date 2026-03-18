import { useEffect, useState } from "react";
import SecurityLockdown from "./Securitylockdown";

const POLL_INTERVAL = 5000; // check every 5 seconds
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

const SecurityGate = () => {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/security-alert`);
        if (!res.ok) return;
        const data = await res.json();
        setLocked(data.isActive === true);
      } catch (e) {
        // silent — don't block the app if API is unreachable
      }
    };

    check(); // run immediately on mount
    const interval = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  if (!locked) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999 }}>
      <SecurityLockdown />
    </div>
  );
};

export default SecurityGate;