// src/api/axiosClient.js
import axios from "axios";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

export const axiosClient = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

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
      // send user back to login
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);
