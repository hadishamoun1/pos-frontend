// src/api/axiosClient.js
import axios from "axios";

// ✅ If you use Nginx /api proxy, this should be "/api" in production.
// If env is set, we use it; otherwise we fallback to "/api".
const API_BASE = (process.env.REACT_APP_API_BASE_URL || "/api").replace(/\/+$/, "");

export const axiosClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Uploaded files (item pictures, employee docs, etc.) are served by the
// backend's static file middleware, which sits OUTSIDE the "/api" prefix
// (NestJS's global API prefix only applies to controller routes, not
// app.useStaticAssets()). So a URL like "/uploads/items/x.png" must be
// resolved against the API origin WITHOUT "/api" — not against
// axiosClient.defaults.baseURL directly, or it 404s behind an /api proxy.
export const getUploadsBaseUrl = () => {
  const base = axiosClient.defaults.baseURL || "";
  return base.replace(/\/api\/?$/, "");
};

// Attach token on EVERY request automatically
axiosClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto logout on 401
axiosClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      sessionStorage.removeItem("token");
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);
