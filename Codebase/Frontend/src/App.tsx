import { useEffect, useState } from 'react';
import { useAppStore } from './store/appState';
import { fetchHealth, fetchRuns, fetchSample } from './api/client';
import LoginOverlay from './components/auth/LoginOverlay';
import MainLayout from './components/layout/MainLayout';

export default function App() {
  const { token, user, setStatus, setMsStatus, setAiConfigured, resetSession } = useAppStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Clear any leftover analysis state from the previous page load.
    resetSession();

    // Redirect admin immediately
    if (token && user?.role === 'admin') {
      window.location.href = '/admin.html';
      return;
    }

    // Show UI immediately, load health in background
    setReady(true);

    fetchHealth()
      .then(h => {
        const ms = h.microservice;
        if (ms.connected) {
          setMsStatus('online', 'online');
        } else {
          const reason = !ms.binaryFound ? 'binary missing' : !ms.catalogFound ? 'catalog missing' : 'unreachable';
          setMsStatus('offline', `offline (${reason})`);
        }
        setAiConfigured(h.aiProviderConfigured);
        setStatus({
          kind: 'ok',
          title: 'API ok',
          detail: `${h.service} • ${h.totalRuns} run(s)${h.aiProviderConfigured ? ' • AI on' : ' • AI off'}`
        });
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : 'unreachable';
        setMsStatus('offline', err?.name === 'AbortError' ? 'offline (timeout)' : 'offline (unreachable)');
        setStatus({ kind: 'error', title: 'API offline', detail: msg });
      });

    if (token && user) {
      // Load runs and sample in parallel (bug fix: was sequential before)
      Promise.all([fetchRuns(), fetchSample()]).catch(() => {});
    }
  }, []);

  if (!ready) return null;

  const isLoggedIn = !!(token && user);

  return (
    <>
      {!isLoggedIn && <LoginOverlay />}
      {isLoggedIn && <MainLayout />}
    </>
  );
}
