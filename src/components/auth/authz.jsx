import { jwtDecode } from "jwt-decode";

export function getToken() {
  return sessionStorage.getItem("token");
}

export function getPayload() {
  const token = getToken();
  if (!token) return null;
  try {
    return jwtDecode(token); // { sub, username, role, permissions, iat, exp }
  } catch {
    return null;
  }
}

export function hasPerm(perm) {
  const p = getPayload();
  return (p?.permissions || []).includes(perm);
}
