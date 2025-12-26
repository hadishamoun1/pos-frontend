import React from "react";
import { hasPerm } from "./authz";

/**
 * Usage:
 * <PermGate perm="invoices.create">
 *   <button>Issue</button>
 * </PermGate>
 *
 * or with multiple:
 * <PermGate any={["invoices.create","invoices.update"]}>...</PermGate>
 */
export default function PermGate({ perm, all = [], any = [], fallback = null, children }) {
  let ok = true;

  if (perm) ok = hasPerm(perm);
  if (all.length) ok = all.every((p) => hasPerm(p));
  if (any.length) ok = any.some((p) => hasPerm(p));

  return ok ? children : fallback;
}
