import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { fetchHealth, fetchRuns, fetchSample } from '../../api/client';
import { navigate } from '../../logic/router';
import LoginOverlay from '../auth/LoginOverlay';
import MainLayout from '../layout/MainLayout';

function getSafeReturnTarget(): string | null {
  if (typeof window === 'undefined') return null;
  const next = new URLSearchParams(window.location.search).get('next');
  if (next === '/student-learning') return next;
  return null;
}

const DEVELOPER_ENTRY_KEY = 'nt-entry-flow';

export default function StudioApp() {
  const { token, user, setStatus, setMsStatus, setAiConfigured, resetSession } = useAppStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    resetSession();

    // Admins land on the dedicated admin dashboard ONLY when they hit the
    // admin sign-in entry (/app). On the tester picker (/login,
    // /seat-selection) we let them stay so they can sign out or pick a
    // seat without being yanked to /admin.html.
    const here = typeof window !== 'undefined' ? window.location.pathname : '/';
    if (token && user?.role === 'admin' && here === '/app') {
      window.location.href = '/admin.html';
      return;
    }

    setReady(true);

    fetchHealth()
      .then((h) => {
        const ms = h.microservice;
        if (ms.connected) {
          setMsStatus('online', 'online');
        } else {
          const reason = !ms.binaryFound
            ? 'binary missing'
            : !ms.catalogFound
              ? 'catalog missing'
              : 'unreachable';
          setMsStatus('offline', `offline (${reason})`);
        }
        setAiConfigured(h.aiProviderConfigured);
        setStatus({
          kind: 'ok',
          title: 'API ok',
          detail: `${h.service} • ${h.totalRuns} run(s)${h.aiProviderConfigured ? ' • AI on' : ' • AI off'}`,
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'unreachable';
        const name = err instanceof Error ? err.name : '';
        setMsStatus('offline', name === 'AbortError' ? 'offline (timeout)' : 'offline (unreachable)');
        setStatus({ kind: 'error', title: 'API offline', detail: msg });
      });

    if (token && user) {
      Promise.all([fetchRuns(), fetchSample()]).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;

  const isLoggedIn = !!(token && user);

  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    const SIGN_IN_PATHS = ['/login', '/seat-selection', '/app', '/developer', '/student-studio'];
    if (path === '/developer') {
      window.sessionStorage.setItem(DEVELOPER_ENTRY_KEY, 'developer');
    } else if (path === '/student-studio') {
      window.sessionStorage.setItem(DEVELOPER_ENTRY_KEY, 'student');
    } else if (!isLoggedIn) {
      window.sessionStorage.removeItem(DEVELOPER_ENTRY_KEY);
    }
    if (!isLoggedIn) {
      // Logged-out visitors landing on consent/pretest/studio go through
      // the tester picker. /app stays at /app so admins can keep typing
      // credentials there.
      if (!SIGN_IN_PATHS.includes(path)) {
        window.history.replaceState(null, '', '/login');
      }
    } else if (SIGN_IN_PATHS.includes(path)) {
      const next = getSafeReturnTarget();
      if (path === '/student-studio' && next) {
        navigate(next);
      } else {
        window.history.replaceState(null, '', '/studio');
      }
    }
  }

  return (
    <>
      {!isLoggedIn && <LoginOverlay />}
      {isLoggedIn && <MainLayout />}
    </>
  );
}
