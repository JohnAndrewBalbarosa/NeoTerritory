import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { fetchHealth, fetchRuns, fetchSample } from '../../api/client';
import { navigate } from '../../logic/router';
import MainLayout from '../layout/MainLayout';

// Studio entry. After the learner-merge the standalone studio is no longer a
// destination for learners — its analysis surface is embedded inside the
// Learning Path practicals (see StudioSurface). So:
//   - logged-out visits → bounce to the learner sign-in page.
//   - logged-in admins  → keep the standalone studio (operators may still use
//     it); admins hitting the /app sign-in entry go to /admin.html.
//   - logged-in non-admins (developers/learners/guests) → /patterns/learn.
export default function StudioApp() {
  const { token, user, setStatus, setMsStatus, setAiConfigured, resetSession } = useAppStore();
  const [ready, setReady] = useState(false);

  const isLoggedIn = !!(token && user);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    resetSession();

    const here = typeof window !== 'undefined' ? window.location.pathname : '/';
    // Admins land on the dedicated admin dashboard from the /app sign-in entry.
    if (token && isAdmin && here === '/app') {
      window.location.href = '/admin.html';
      return;
    }

    setReady(true);

    if (isLoggedIn && isAdmin) {
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
      Promise.all([fetchRuns(), fetchSample()]).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Logged-out studio visit → learner sign-in. /app is the hidden admin entry
  // and renders its own gate, so it is exempt.
  useEffect(() => {
    if (!ready) return;
    if (isLoggedIn) return;
    if (typeof window === 'undefined') return;
    if (window.location.pathname === '/app') return;
    navigate('/student-learning/login');
  }, [ready, isLoggedIn]);

  // Logged-in non-admins never see the standalone studio — the studio now
  // lives inside the Learning Path practicals. Redirect them there.
  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn) return;
    if (isAdmin) return;
    if (typeof window === 'undefined') return;
    if (window.location.pathname === '/app') return;
    navigate('/patterns/learn');
  }, [ready, isLoggedIn, isAdmin]);

  if (!ready) return null;
  if (!isLoggedIn) return null;
  // Non-admins are mid-redirect to /patterns/learn — render nothing.
  if (!isAdmin) return null;

  return <MainLayout />;
}
