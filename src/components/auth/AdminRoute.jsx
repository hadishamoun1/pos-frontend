import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { hasPerm } from "./authz";

export default function AdminRoute() {
  // only admins with users.manage can enter
  if (!hasPerm("users.manage")) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
