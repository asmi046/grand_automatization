import axios from 'axios';
import { auth } from './auth';

export const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?._skipAuthRedirect) {
      auth.authenticated = false;
      auth.user = null;
      const path = window.location.pathname + window.location.search;
      if (window.location.pathname !== '/login') {
        window.location.assign('/login?redirect=' + encodeURIComponent(path));
      }
    }
    return Promise.reject(err);
  },
);

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ru-RU');
}

