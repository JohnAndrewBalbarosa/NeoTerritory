import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../store/appState';
import { useAuth } from '../../hooks/useAuth';
import AuroraBackground from '../marketing/effects/AuroraBackground';
import TiltCard from '../marketing/effects/TiltCard';
import {
  fetchTesterAccounts,
  claimSeat,
  TesterAccountInfo
} from '../../api/client';
import { fetchRuns, fetchSample } from '../../api/client';
import { User } from '../../types/api';

type Mode = 'picker' | 'admin';
type PickerView = 'home' | 'seats';

// /app is the admin sign-in entry point. /login and /seat-selection are
// tester seat picker entry points. The path is the source of truth — the
// overlay does not flip modes based on data availability, so an empty
// picker stays as an empty picker (with a link to /app for admins) instead
// of silently morphing into the admin form.
function getPathMode(): Mode {
  if (typeof window === 'undefined') return 'picker';
  return window.location.pathname === '/app' ? 'admin' : 'picker';
}

function getInitialView(): PickerView {
  if (typeof window === 'undefined') return 'home';
  return window.location.pathname === '/seat-selection' ? 'seats' : 'home';
}

// CodiNeo brand mark SVG
function CodineoBrandMark() {
  return (
    <div className="codineo-brand-mark" aria-hidden>
      <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="16" height="11" rx="2" />
        <path d="M7 18h6M10 14v4" />
        <path d="M6 8l2 2-2 2M11 10h3" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

const TESTER_WORKFLOW_STEPS = [
  {
    label: 'Seat Selection',
    desc: 'Choose your assigned seat from the testing room map',
  },
  {
    label: 'Consent & Privacy Notice',
    desc: 'Review the Letter to Respondents and Data Privacy Notice',
  },
  {
    label: 'Testing Dashboard',
    desc: "Access CodiNeo's evaluation modules and tasks",
  },
  {
    label: 'Post-Test Survey',
    desc: 'Submit your evaluation responses and ratings',
  },
];

export default function LoginOverlay() {
  const { signIn } = useAuth();
  const setAuth = useAppStore(s => s.setAuth);

  const pathMode = getPathMode();
  const [mode] = useState<Mode>(pathMode);
  const [pickerView, setPickerView] = useState<PickerView>(getInitialView());
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

  function handleProceedToSeats() {
    setPickerView('seats');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/seat-selection');
    }
  }

  const availableCount = accounts.filter(a => !a.claimed).length;
  const totalCount = accounts.length;

  return (
    <div className="login-overlay">
      <AuroraBackground variant="cool" />
      <div className="login-wrap">
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'picker' && pickerView === 'home' && (
            <motion.div
              key="picker-home"
              initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -14, scale: 0.97, filter: 'blur(6px)' }}
              transition={{ type: 'spring', stiffness: 220, damping: 26, mass: 0.7 }}
            >
              <TiltCard className="login-card" maxTilt={3} scale={1.003}>
                {/* CodiNeo brand header */}
                <div className="codineo-brand-header">
                  <CodineoBrandMark />
                  <div>
                    <div className="codineo-brand-name">CodiNeo</div>
                    <div className="codineo-brand-sub">DEVCON 1 · Code Intelligence</div>
                  </div>
                </div>

                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px', color: 'var(--ink)' }}>
                    Tester Session Mode
                  </h2>
                  <p className="login-hint">
                    No credentials required. Select your assigned seat and review the consent letter before accessing the testing environment.
                  </p>
                </div>

                {/* Seat availability */}
                {accountsLoaded && accounts.length > 0 && (
                  <div className="seat-availability-bar">
                    <div className="seat-availability-left">
                      <span className="seat-availability-dot" />
                      <span className="seat-availability-label">Available Seats</span>
                    </div>
                    <div className="seat-availability-right">
                      <span className="seat-availability-count">{availableCount}</span>
                      <span className="seat-availability-total">/ {totalCount}</span>
                    </div>
                  </div>
                )}

                {/* Tester workflow steps */}
                <div className="tester-steps">
                  {TESTER_WORKFLOW_STEPS.map((step, idx) => (
                    <div key={step.label} className="tester-step">
                      <span className="tester-step-num">{idx + 1}</span>
                      <div className="tester-step-text">
                        <strong>{step.label}</strong>
                        <span> — {step.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {accountsError && <p className="login-error">{accountsError}</p>}

                <button
                  id="proceed-seat-btn"
                  className="proceed-btn"
                  type="button"
                  onClick={handleProceedToSeats}
                  disabled={!!accountsError && !accountsLoaded}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="3" width="16" height="11" rx="2" />
                    <path d="M7 18h6M10 14v4" />
                  </svg>
                  Proceed to Seat Selection
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }} aria-hidden="true">
                    <path d="M7 4l6 6-6 6" />
                  </svg>
                </button>
                <p style={{ fontSize: '11px', color: 'var(--ink-dim)', textAlign: 'center', margin: 0 }}>
                  You will be prompted to read and acknowledge the consent letter before testing begins.
                </p>

                <p className="login-toggle">
                  Need admin access?{' '}
                  <a className="link-btn" href="/app">Admin sign in</a>
                </p>
              </TiltCard>
            </motion.div>
          )}

          {mode === 'picker' && pickerView === 'seats' && (
            <motion.div
              key="picker-seats"
              initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -14, scale: 0.97, filter: 'blur(6px)' }}
              transition={{ type: 'spring', stiffness: 220, damping: 26, mass: 0.7 }}
            >
              <TiltCard className="login-card tester-chooser" maxTilt={2} scale={1.002}>
                {/* Step badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="step-badge">Step 1 of 3 — Seat Selection</span>
                  <button
                    type="button"
                    className="ghost-btn"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                    onClick={() => {
                      setPickerView('home');
                      if (typeof window !== 'undefined') {
                        window.history.replaceState(null, '', '/login');
                      }
                    }}
                  >
                    ← Back
                  </button>
                </div>

                <div className="tester-chooser-head">
                  <h2>Select Your Testing Seat</h2>
                  <p className="tester-hint">Claim an open seat to begin the session.</p>
                </div>

                {/* Seat availability bar */}
                {accountsLoaded && accounts.length > 0 && (
                  <div className="seat-availability-bar">
                    <div className="seat-availability-left">
                      <span className="seat-availability-dot" />
                      <span className="seat-availability-label">Available Seats</span>
                    </div>
                    <div className="seat-availability-right">
                      <span className="seat-availability-count">{availableCount}</span>
                      <span className="seat-availability-total">/ {totalCount}</span>
                    </div>
                  </div>
                )}

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
                          id={`seat-${acc.username}`}
                          className="tester-chip tester-tile"
                          data-claimed={isClaimed ? 'true' : undefined}
                          disabled={isClaiming || isClaimed}
                          title={isClaimed ? 'Already claimed by another tester' : `Select seat ${acc.username}`}
                          onClick={() => handleClaim(acc)}
                        >
                          <span className="tester-chip-label">
                            {isClaiming ? 'Claiming…' : acc.username}
                          </span>
                          {isClaimed && (
                            <span className="tester-chip-sub">in use</span>
                          )}
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
              <div className="codineo-brand-header">
                <CodineoBrandMark />
                <div>
                  <div className="codineo-brand-name">CodiNeo</div>
                  <div className="codineo-brand-sub">DEVCON 1 · Code Intelligence</div>
                </div>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Admin Sign In</h2>
              <p className="login-hint">Enter administrator credentials.</p>
              <label className="field">
                <span>Username</span>
                <input
                  type="text"
                  id="admin-username"
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
                  id="admin-password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </label>
              <button className="primary-btn" type="submit" disabled={busy} id="admin-signin-btn">
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
