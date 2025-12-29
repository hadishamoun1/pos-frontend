import { io } from "socket.io-client";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "/api").replace(/\/+$/, "");

/**
 * If API_BASE is relative ("/api") => production behind nginx
 *   socket connects to window.location.origin with path "/api/socket.io"
 *
 * If API_BASE is absolute ("http://localhost:3000/api") => local dev
 *   socket connects to "http://localhost:3000" with path "/socket.io"
 */
export function createSocket() {
  const isAbsolute = API_BASE.startsWith("http");

  const socketOrigin = isAbsolute ? API_BASE.replace(/\/api$/, "") : window.location.origin;
  const socketPath = isAbsolute ? "/socket.io" : "/api/socket.io";

  return io(socketOrigin, {
    path: socketPath,
    transports: ["websocket", "polling"],
  });
}
