import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import {
  fetchTesterAccounts,
  claimSeat,
  fetchRuns,
  fetchSample,
  TesterAccountInfo,
} from '../../api/client';
import { User } from '../../types/api';

// Extracted seat-claim grid from the now-deleted LoginOverlay. Used inline
// inside the homepage TryItChooser so the Tester (Guest) flow lives in one
// modal step instead of bouncing to a dedicated /login surface.

interface SeatClaimPanelProps {
  // Called after a successful claim so the parent popup can close itself
  // and route the user into the studio.
  onClaimed: () => void;
  // Optional "Back" affordance — when present, rendered as a ghost button
  // at the bottom of the panel. The popup uses this to rewind to its
  // 3-card choices view instead of navigating to a literal /choose page.
  onBack?: () => void;
}

export default function SeatClaimPanel({ onClaimed, onBack }: SeatClaimPanelProps) {
  const setAuth = useAppStore(s => s.setAuth);
  const [accounts, setAccounts] = useState<TesterAccountInfo[]>([]);
  const [accountsError, setAccountsError] = useState('');
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadAccounts = useCallback(async () => {
    try {
      const data = await fetchTesterAccounts();
      setAccounts(data.accounts);
      setAccountsError('');
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : 'Failed to load testers');
    } finally {
      setAccountsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function handleClaim(account: TesterAccountInfo): Promise<void> {
    if (account.claimed || claiming) return;
    setClaiming(account.username);
    setError('');
    try {
      // Authoritative pre-flight: re-fetch the seat list right before the
      // claim attempt and bail locally if the picked seat flipped to
      // claimed while the user was reading the page. The server still
      // owns the final say (409 below) but this avoids the round-trip
      // when we already know the answer.
      const fresh = await fetchTesterAccounts();
      setAccounts(fresh.accounts);
      const live = fresh.accounts.find(a => a.username === account.username);
      if (live?.claimed) {
        setError('That tester seat is currently in use. Pick a different one.');
        return;
      }
      const { token, user } = await claimSeat(account.username);
      setAuth(token, user as User);
      // Warm the studio caches in parallel so the first frame after the
      // popup closes already has runs + sample.
      await Promise.all([fetchRuns(), fetchSample()]).catch(() => {});
      onClaimed();
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

  return (
    <section className="nt-seat-claim" aria-label="Available session seats">
      <header className="nt-seat-claim__head">
        <p className="nt-tryit__eyebrow">Tester guest seat</p>
        <h3 className="nt-tryit__title">Claim your session seat</h3>
        <p className="nt-tryit__lede">
          Each seat is a shared environment for trying the analyzer. Pick an open one to continue —
          no account, no saved history.
        </p>
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
                aria-label={
                  isClaimed ? `${acc.username} is already in use` : `Claim seat ${acc.username}`
                }
                onClick={() => void handleClaim(acc)}
              >
                <span className="tester-seat-icon" aria-hidden="true">
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

      {onBack && (
        <div className="nt-tryit__foot">
          <button type="button" className="nt-tryit__back" onClick={onBack}>
            ← Back to choices
          </button>
        </div>
      )}
    </section>
  );
}
