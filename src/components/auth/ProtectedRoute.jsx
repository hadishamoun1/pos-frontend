import React from "react";
import { Navigate, Outlet } from "react-router-dom";

function hasToken() {
  const token = sessionStorage.getItem("token");
  return !!token;
}

const ProtectedRoute = () => {
  if (!hasToken()) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
