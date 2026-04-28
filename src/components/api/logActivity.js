import { axiosClient } from './axiosClient';

export function logActivity({ action, entityType, description, metadata } = {}) {
  if (!sessionStorage.getItem('token')) return;
  axiosClient
    .post('/activity-log', { action, entityType, description, metadata })
    .catch(() => {});
}
