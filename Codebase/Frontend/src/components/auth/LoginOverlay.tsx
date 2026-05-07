import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../store/appState';
import { useAuth } from '../../hooks/useAuth';
import { navigate } from '../../logic/router';
import AuroraBackground from '../marketing/effects/AuroraBackground';
import ShinyText from '../marketing/effects/ShinyText';
import TiltCard from '../marketing/effects/TiltCard';
import {
  fetchTesterAccounts,
  claimSeat,
  TesterAccountInfo
} from '../../api/client';
import { fetchRuns, fetchSample } from '../../api/client';
import { User } from '../../types/api';

type Mode = 'picker' | 'admin';

type EntryCopy = {
  title: string;
  hint: string;
};

// /app is the admin sign-in entry point. /login and /seat-selection are
// tester seat picker entry points. The path is the source of truth — the
// overlay does not flip modes based on data availability, so an empty
// picker stays as an empty picker (with a link to /app for admins) instead
// of silently morphing into the admin form.
function getPathMode(): Mode {
  if (typeof window === 'undefined') return 'picker';
  return window.location.pathname === '/app' ? 'admin' : 'picker';
}

function getEntryCopy(): EntryCopy {
  if (typeof window === 'undefined') {
    return {
      title: 'Pick a tester seat',
      hint: 'Claim an open seat to sign in.',
    };
  }

  if (window.location.pathname === '/developer') {
    return {
      title: 'Open Developer Studio',
      hint: 'Use an open seat to enter the existing C++ analysis studio.',
    };
  }

  if (window.location.pathname === '/student-studio') {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next === '/student-learning') {
      return {
        title: 'Start Student Learning',
        hint: 'Claim an open seat before starting the learning path.',
      };
    }
    return {
      title: 'Open Student Studio',
      hint: 'Use an open seat to try the analyzer after the learning modules.',
    };
  }

  return {
    title: 'Pick a tester seat',
    hint: 'Claim an open seat to sign in.',
  };
}

function getSafeReturnTarget(): string | null {
  if (typeof window === 'undefined') return null;
  const next = new URLSearchParams(window.location.search).get('next');
  if (next === '/student-learning') return next;
  return null;
}

export default function LoginOverlay() {
  const { signIn } = useAuth();
  const setAuth = useAppStore(s => s.setAuth);

  const pathMode = getPathMode();
  const entryCopy = getEntryCopy();
  const [mode] = useState<Mode>(pathMode);
  const [accounts, setAccounts] = useState<TesterAccountInfo[]>([]);
  const [accountsError, setAccountsError] = useState('');
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const loadAccounts = useCallback(async () => {
    if (mode !== 'picker') return;  // /app skips this entirely.
    try {
      const data = await fetchTesterAccounts();
      setAccounts(data.accounts);
      setAccountsError('');
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : 'Failed to load testers');
    } finally {
      setAccountsLoaded(true);
    }
  }, [mode]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function handleClaim(account: TesterAccountInfo) {
    if (account.claimed || claiming) return;
    setClaiming(account.username);
    setError('');
    try {
      // Authoritative pre-flight: re-fetch the seat list right before the
      // claim attempt and bail out locally if the picked account has
      // flipped to claimed since the user opened the page. The server
      // still owns the final say (409 below), but this avoids the
      // round-trip when we already know the answer.
      const fresh = await fetchTesterAccounts();
      setAccounts(fresh.accounts);
      const live = fresh.accounts.find(a => a.username === account.username);
      if (live?.claimed) {
        setError('That tester seat is currently in use. Pick a different one.');
        return;
      }
      const { token, user } = await claimSeat(account.username);
      setAuth(token, user as User);
      // Mirror useAuth.signIn parallel warm-up.
      await Promise.all([fetchRuns(), fetchSample()]).catch(() => {});
      const next = getSafeReturnTarget();
      if (next) {
        navigate(next);
      }
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      const msg = err instanceof Error ? err.message : 'Claim failed.';
      setError(msg);
      if (status === 409) {
        await loadAccounts();
      }
    } finally {
      setClaiming(null);
    }
  }

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-overlay">
      <AuroraBackground variant="cool" />
      <div className="login-wrap">
        <AnimatePresence mode="wait" initial={false}>
        {mode === 'picker' && (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -14, scale: 0.97, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 220, damping: 26, mass: 0.7 }}
          >
          <TiltCard className="login-card tester-chooser session-gateway" maxTilt={3} scale={1.002}>
            <section className="session-gateway__intro" aria-labelledby="session-gateway-heading">
              <p className="session-gateway__eyebrow">NeoTerritory Studio</p>
              <h2 id="session-gateway-heading">
                <ShinyText text="Claim your session seat" />
              </h2>
              <p className="session-gateway__lede">
                Choose an available seat to enter NeoTerritory Studio.
              </p>
              <p className="session-gateway__copy">
                Each seat represents an available session environment for using the analyzer. Pick
                one seat to continue.
              </p>
              <ul className="session-gateway__bullets" aria-label="Session notes">
                <li>Use the real Studio</li>
                <li>Keep one active session</li>
                <li>Admin access stays protected</li>
              </ul>
              <button
                type="button"
                className="session-gateway__back"
                onClick={() => navigate('/choose')}
              >
                Back to choices
              </button>
            </section>

            <section className="session-gateway__picker" aria-label="Available session seats">
              <header className="tester-chooser-head">
                <p className="tester-chooser-head__label">Available seats</p>
                <h3>{entryCopy.title}</h3>
                <p className="tester-hint">{entryCopy.hint}</p>
              </header>
              {accountsError && <p className="login-error">{accountsError}</p>}
              {accountsLoaded && !accountsError && accounts.length === 0 && (
                <p className="login-hint">
                  No tester seats are available right now. Contact an administrator.
                </p>
              )}
              {accounts.length > 0 && (
                <div className="tester-grid" role="list">
                  {accounts.map(acc => {
                    const isClaiming = claiming === acc.username;
                    const isClaimed = !!acc.claimed;
                    return (
                      <button
                        key={acc.username}
                        type="button"
                        role="listitem"
                        className="tester-chip tester-tile"
                        data-claimed={isClaimed ? 'true' : undefined}
                        disabled={isClaiming || isClaimed}
                      title={isClaimed ? 'Already claimed by another tester' : undefined}
                      aria-label={isClaimed ? `${acc.username} is already in use` : `Claim seat ${acc.username}`}
                      onClick={() => handleClaim(acc)}
                    >
                      <span className="tester-seat-icon" aria-hidden>
                        <svg viewBox="0 0 48 48" focusable="false">
                          <rect x="8" y="10" width="32" height="23" rx="3.5" />
                          <path d="M19 38h10" />
                          <path d="M24 33v5" />
                        </svg>
                      </span>
                      <span className="tester-seat-name">
                        {isClaiming ? 'Claiming...' : acc.username}
                      </span>
                      {isClaimed && <span className="tester-chip-sub">in use</span>}
                    </button>
                    );
                  })}
                </div>
              )}
              {error && <p className="login-error">{error}</p>}
              <p className="login-toggle">
                Need admin access?{' '}
                <a className="link-btn" href="/app">Admin sign in</a>
              </p>
            </section>
          </TiltCard>
          </motion.div>
        )}

        {mode === 'admin' && (
          <motion.form
            key="admin"
            className="login-card"
            onSubmit={handleAdminSubmit}
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -14, scale: 0.97, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 220, damping: 26, mass: 0.7 }}
          >
            <h2><ShinyText text="Admin sign in" /></h2>
            <p className="login-hint">Enter administrator credentials.</p>
            <label className="field">
              <span>Username</span>
              <input
                type="text"
                autoComplete="username"
                required
                maxLength={64}
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </label>
            <button className="primary-btn" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            {error && <p className="login-error">{error}</p>}
            <p className="login-toggle">
              Tester instead?{' '}
              <a className="link-btn" href="/login">Pick a seat</a>
            </p>
          </motion.form>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
