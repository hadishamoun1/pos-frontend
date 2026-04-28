import { useEffect } from "react";
import { axiosClient } from "../api/axiosClient";

export function useHeartbeat() {
  useEffect(() => {
    const ping = () => {
      if (!sessionStorage.getItem("token")) return;
      axiosClient.post("/activity-log/heartbeat").catch(() => {});
    };
    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, []);
}
