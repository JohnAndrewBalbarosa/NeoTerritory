import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../store/appState';
import { useAuth } from '../../hooks/useAuth';
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

export default function LoginOverlay() {
  const { signIn } = useAuth();
  const setAuth = useAppStore(s => s.setAuth);

  const [mode, setMode] = useState<Mode>('picker');
  const [accounts, setAccounts] = useState<TesterAccountInfo[]>([]);
  const [accountsError, setAccountsError] = useState('');
  const [showPicker, setShowPicker] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await fetchTesterAccounts();
      setAccounts(data.accounts);
      // Hide picker entirely when backend reports no tester mode / no accounts.
      setShowPicker(data.accounts.length > 0);
      if (data.accounts.length === 0) {
        setMode('admin');
      }
      setAccountsError('');
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : 'Failed to load testers');
      setShowPicker(false);
      setMode('admin');
    }
  }, []);

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

  return (
    <div className="login-overlay">
      <AuroraBackground variant="cool" />
      <div className="login-wrap">
        <AnimatePresence mode="wait" initial={false}>
        {mode === 'picker' && showPicker && (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
          <TiltCard className="login-card tester-chooser" maxTilt={4} scale={1.005}>
            <header className="tester-chooser-head">
              <h2><ShinyText text="Pick a tester seat" /></h2>
              <p className="tester-hint">Claim an open seat to sign in.</p>
            </header>
            {accountsError && <p className="login-error">{accountsError}</p>}
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
                    onClick={() => handleClaim(acc)}
                  >
                    {isClaiming ? 'Claiming…' : acc.username}
                    {isClaimed && <span className="tester-chip-sub">in use</span>}
                  </button>
                );
              })}
            </div>
            {error && <p className="login-error">{error}</p>}
            <p className="login-toggle">
              Need admin access?{' '}
              <button type="button" className="link-btn" onClick={() => { setMode('admin'); setError(''); }}>
                Admin sign in
              </button>
            </p>
          </TiltCard>
          </motion.div>
        )}

        {(mode === 'admin' || !showPicker) && (
          <motion.form
            key="admin"
            className="login-card"
            onSubmit={handleAdminSubmit}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
            {showPicker && (
              <p className="login-toggle">
                <button type="button" className="link-btn" onClick={() => { setMode('picker'); setError(''); }}>
                  Back to seat picker
                </button>
              </p>
            )}
          </motion.form>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
