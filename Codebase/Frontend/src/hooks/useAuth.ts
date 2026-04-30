import { useAppStore } from '../store/appState';
import { login as apiLogin, fetchRuns, fetchSample } from '../api/client';
import { User } from '../types/api';

export function useAuth() {
  const { token, user, setAuth, clearAuth, setStatus } = useAppStore();

  async function signIn(username: string, password: string): Promise<void> {
    const { token: t, user: u } = await apiLogin(username, password);
    setAuth(t, u as User);
    if (u?.role === 'admin') {
      window.location.href = '/admin.html';
      return;
    }
    // Parallel load after sign in (was sequential bug)
    await Promise.all([fetchRuns(), fetchSample()]).catch(() => {});
  }

  function signOut() {
    clearAuth();
    setStatus({ kind: 'idle', title: 'Signed out', detail: '' });
  }

  return { token, user, signIn, signOut, isLoggedIn: !!(token && user) };
}
