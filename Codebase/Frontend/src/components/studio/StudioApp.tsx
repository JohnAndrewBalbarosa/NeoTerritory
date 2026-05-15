import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { fetchHealth, fetchRuns, fetchSample } from '../../api/client';
import { navigate } from '../../logic/router';
import { dispatchTryItChooserOpen } from '../marketing/TryItChooser';
import MainLayout from '../layout/MainLayout';

function getSafeReturnTarget(): string | null {
  if (typeof window === 'undefined') return null;
  const next = new URLSearchParams(window.location.search).get('next');
  if (next === '/student-learning' || next === '/patterns/learn') return next;
  return null;
}

export default function StudioApp() {
  const { token, user, setStatus, setMsStatus, setAiConfigured, resetSession } = useAppStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    resetSession();

    // Admins land on the dedicated admin dashboard ONLY when they hit the
    // admin sign-in entry (/app). Other studio paths let admins stay so
    // they can sign out or pick a seat without being yanked away.
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

  // Logged-out studio visit → bounce to the marketing homepage and pop
  // the TryItChooser open on the seat-claim view. This replaces the old
  // /choose page + LoginOverlay seat picker that lived on /login. The
  // popup is the only auth surface now.
  const isLoggedIn = !!(token && user);
  useEffect(() => {
    if (!ready) return;
    if (isLoggedIn) return;
    if (typeof window === 'undefined') return;
    // /app is the hidden admin entry — let it render its own gate.
    if (window.location.pathname === '/app') return;
    navigate('/');
    dispatchTryItChooserOpen();
  }, [ready, isLoggedIn]);

  if (!ready) return null;

  if (isLoggedIn && typeof window !== 'undefined') {
    const path = window.location.pathname;
    const SIGN_IN_PATHS = ['/app', '/developer', '/student-studio'];
    if (SIGN_IN_PATHS.includes(path)) {
      const next = getSafeReturnTarget();
      if (path === '/student-studio' && next) {
        navigate(next);
      } else {
        window.history.replaceState(null, '', '/studio');
      }
    }
  }

  // While the bounce-to-home effect runs, render nothing so the logged-out
  // visitor never sees the studio chrome flash.
  if (!isLoggedIn) return null;
  return <MainLayout />;
}
