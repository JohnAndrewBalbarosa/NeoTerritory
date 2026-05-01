import { useAppStore } from '../store/appState';
import { login as apiLogin, fetchRuns, fetchSample, signOutAndRevoke } from '../api/client';
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
    // Tell the server to free the tester seat and revoke the JWT BEFORE we
    // drop the token client-side. Fire-and-forget; the local clearAuth runs
    // immediately so the UI doesn't wait on the network round trip.
    void signOutAndRevoke();
    clearAuth();
    setStatus({ kind: 'idle', title: 'Signed out', detail: '' });
  }

  return { token, user, signIn, signOut, isLoggedIn: !!(token && user) };
}
