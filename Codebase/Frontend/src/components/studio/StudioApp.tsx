import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { fetchHealth, fetchRuns, fetchSample } from '../../api/client';
import LoginOverlay from '../auth/LoginOverlay';
import MainLayout from '../layout/MainLayout';

export default function StudioApp() {
  const { token, user, setStatus, setMsStatus, setAiConfigured, resetSession } = useAppStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    resetSession();

    if (token && user?.role === 'admin') {
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
    if (!isLoggedIn) {
      if (path !== '/login' && path !== '/app') {
        window.history.replaceState(null, '', '/login');
      }
    } else if (path === '/login' || path === '/app') {
      window.history.replaceState(null, '', '/studio');
    }
  }

  return (
    <>
      {!isLoggedIn && <LoginOverlay />}
      {isLoggedIn && <MainLayout />}
    </>
  );
}
