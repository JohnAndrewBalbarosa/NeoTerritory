import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import {
  fetchHealth,
  fetchLearningAssessments,
  fetchLearningProgress,
  fetchRuns,
  fetchSample,
} from '../../api/client';
import { navigate } from '../../logic/router';
import MainLayout from '../layout/MainLayout';
import { useLearningModules } from '../../data/useLearningModules';
import { deriveInternLearningStatus } from '../../logic/internLearningStatus';

// Studio entry. After the learner-merge the studio's analysis surface is
// embedded inside the Learning Path practicals (see StudioSurface), and the
// product UX never links learners here — "Try it now" goes straight to the
// learner sign-in, and pattern modules host the studio inline. The /studio
// route itself still renders for a directly-navigated signed-in session
// (e.g. operators, or the E2E pipeline harness), so:
//   - logged-out visits → bounce to the learner sign-in page.
//   - logged-in admins hitting the /app sign-in entry → /admin.html.
//   - any other signed-in session → the standalone studio shell.
export default function StudioApp() {
  const { token, user, setStatus, setMsStatus, setAiConfigured, resetSession } = useAppStore();
  const [ready, setReady] = useState(false);
  const [studioGate, setStudioGate] = useState<'checking' | 'allowed' | 'blocked'>('checking');
  const { modules, loaded: modulesLoaded } = useLearningModules();

  const isLoggedIn = !!(token && user);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isLoggedIn || !modulesLoaded) return;
    if (isAdmin) {
      setStudioGate('allowed');
      return;
    }

    let cancelled = false;
    Promise.all([fetchLearningProgress(), fetchLearningAssessments()])
      .then(([progress, assessments]) => {
        if (cancelled) return;
        const status = deriveInternLearningStatus(modules, assessments, progress);
        setStudioGate(status.studioUnlocked ? 'allowed' : 'blocked');
      })
      .catch(() => {
        if (!cancelled) setStudioGate('blocked');
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, isLoggedIn, modules, modulesLoaded]);

  useEffect(() => {
    resetSession();

    const here = typeof window !== 'undefined' ? window.location.pathname : '/';
    // Admins land on the dedicated admin dashboard from the /app sign-in entry.
    if (token && isAdmin && here === '/app') {
      window.location.href = '/admin.html';
      return;
    }

    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoggedIn && (isAdmin || studioGate === 'allowed')) {
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
  }, [isAdmin, isLoggedIn, setAiConfigured, setMsStatus, setStatus, studioGate]);

  // Logged-out studio visit → learner sign-in. /app is the hidden admin entry
  // and renders its own gate, so it is exempt.
  useEffect(() => {
    if (!ready) return;
    if (isLoggedIn) return;
    if (typeof window === 'undefined') return;
    if (window.location.pathname === '/app') return;
    navigate('/student-learning/login');
  }, [ready, isLoggedIn]);

  if (!ready) return null;
  if (!isLoggedIn) return null;
  if (!isAdmin && studioGate === 'checking') {
    return (
      <main className="nt-test-page">
        <div className="nt-test-page__shell">
          <section className="nt-test-page__panel">
            <div className="nt-test-page__panel-head">
              <span className="nt-test-page__panel-kicker">Studio access</span>
              <h1 className="nt-test-page__panel-title">Checking learning completion</h1>
            </div>
          </section>
        </div>
      </main>
    );
  }
  if (!isAdmin && studioGate === 'blocked') {
    return (
      <main className="nt-test-page" data-testid="studio-learning-gate">
        <div className="nt-test-page__shell">
          <section className="nt-test-page__panel">
            <div className="nt-test-page__panel-head">
              <span className="nt-test-page__panel-kicker">Studio locked</span>
              <h1 className="nt-test-page__panel-title">Finish the intern learning flow first</h1>
            </div>
            <p className="nt-test-page__panel-copy">
              Studio unlocks after your Pre-Test, all required Learning Path modules, and the Post-Test are complete.
            </p>
            <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={() => navigate('/intern-dashboard')}>
              Back to Intern Dashboard
            </button>
          </section>
        </div>
      </main>
    );
  }

  return <MainLayout />;
}
