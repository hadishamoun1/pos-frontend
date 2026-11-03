import { useEffect, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import { createSocket } from "../api/socketClient";

// Settings → POS Controls → "Lock editing of old documents".
// When ON, invoices, receivables and journal vouchers dated this many days
// ago or more can no longer be edited.
export const EDIT_LOCK_DAYS = 2;

// True when `date` (YYYY-MM-DD or a date string) is EDIT_LOCK_DAYS or more
// days before today, by calendar day in local time.
export const isPastEditWindow = (date) => {
  if (!date) return false;
  const s = String(date).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return false;
  const docDay = new Date(y, m - 1, d);
  const now = new Date();
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((todayDay - docDay) / 86400000) >= EDIT_LOCK_DAYS;
};

// ---- Shared POS controls store ----
// One fetch and one socket per browser tab, shared by every page that uses
// usePosControls(). The server pushes "posControls:changed" when an admin
// flips a switch, so there is no polling. On reconnect we refetch once, in
// case a change was missed while offline.
const DEFAULT_CONTROLS = { blockCreation: false, blockViewing: false, lockOldEdits: false };
let current = DEFAULT_CONTROLS;
const listeners = new Set();
let started = false;

const publish = (next) => {
  if (!next) return;
  current = { ...DEFAULT_CONTROLS, ...next };
  listeners.forEach((fn) => fn(current));
};

const fetchControls = () =>
  axiosClient
    .get("/pos-controls")
    .then((res) => publish(res.data))
    .catch(() => {});

const start = () => {
  if (started) return;
  started = true;
  const socket = createSocket();
  // Fires on the first connection and on every reconnect.
  socket.on("connect", fetchControls);
  socket.on("posControls:changed", publish);
  fetchControls();
};

export const usePosControls = () => {
  const [controls, setControls] = useState(current);
  useEffect(() => {
    start();
    listeners.add(setControls);
    setControls(current);
    return () => listeners.delete(setControls);
  }, []);
  return controls;
};

// Whether the edit lock is ON. Defaults to OFF until loaded.
export const useEditLockEnabled = () => !!usePosControls().lockOldEdits;
