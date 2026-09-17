import { reactive, readonly } from 'vue';
import { api } from './api';

export const auth = reactive({
  ready: false,
  authenticated: false,
  user: null,
});

export async function checkAuth() {
  try {
    const { data } = await api.get('/auth/status', { _skipAuthRedirect: true });
    auth.authenticated = !!data.authenticated;
    auth.user = data.user || null;
  } catch {
    auth.authenticated = false;
    auth.user = null;
  } finally {
    auth.ready = true;
  }
}

export function setAuthenticated(user) {
  auth.authenticated = true;
  auth.user = user || null;
  auth.ready = true;
}

export async function logout() {
  await api.post('/auth/logout');
  auth.authenticated = false;
  auth.user = null;
}
