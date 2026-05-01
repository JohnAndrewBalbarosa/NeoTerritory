import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAdminLogs, fetchAdminReviews, deleteAdminLogs } from '../../api/client';
import { AdminLogEntry, AdminReview } from '../../types/api';
import { fmtDate } from '../../lib/patterns';
import { isAuthError } from '../lib/silenceAuthErrors';

// ─── Reviews (unchanged) ──────────────────────────────────────────────────────

function renderStars(value: number, max = 5): string {
  const v = Math.max(0, Math.min(max, Math.floor(value || 0)));
  return '★'.repeat(v) + '☆'.repeat(max - v);
}

function ReviewAnswer({ qid, value }: { qid: string; value: string | number }) {
  const isRating = typeof value === 'number' && value >= 1 && value <= 10;
  return (
    <p className="review-answer">
      <strong>{qid}:</strong>{' '}
      {isRating ? (
        <>
          <span className="review-stars">{renderStars(value as number)}</span>
          {' '}<small>({value}/5)</small>
        </>
      ) : (
        String(value)
      )}
    </p>
  );
}

function ReviewsList() {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminReviews()
      .then(d => { if (!cancelled) setReviews(d.reviews || []); })
      .catch(err => {
        if (cancelled) return;
        if (isAuthError(err)) { setReviews([]); return; }
        setError(err instanceof Error ? err.message : 'Failed to load reviews');
      });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="empty-state admin-error" role="alert">Failed to load reviews: {error}</div>;
  if (reviews === null) return <div className="empty-state">Loading reviews...</div>;
  if (!reviews.length) return <div className="empty-state">No reviews submitted yet.</div>;

  return (
    <div id="reviews-list" className="reviews-list">
      {reviews.map((r, idx) => {
        const entries = Object.entries(r.answers || {});
        return (
          <div key={idx} className="review-card">
            <div className="review-card-head">
              <span>
                <strong>{r.username || '?'}</strong> · {r.scope}
                {r.sourceName && <> · <code>{r.sourceName}</code></>}
              </span>
              <span>{fmtDate(r.createdAt)} · v{r.schemaVersion}</span>
            </div>
            {entries.length === 0
              ? <p className="review-answer"><em>(no answers)</em></p>
              : entries.map(([k, v]) => <ReviewAnswer key={k} qid={k} value={v} />)}
          </div>
        );
      })}
    </div>
  );
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, string> = {
  login:         'blue',
  claim_seat:    'blue',
  analysis:      'green',
  save_run:      'green',
  manual_review: 'purple',
  error:         'red',
};

function EventPill({ type }: { type: string }) {
  const color = EVENT_COLORS[type] ?? 'grey';
  return <span className={`log-event-pill log-event-pill--${color}`}>{type}</span>;
}

interface DeleteModalProps {
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteModal({ onClose, onDeleted }: DeleteModalProps) {
  const [pw, setPw]   = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleConfirm() {
    if (!pw.trim()) { setErr('Enter password'); return; }
    setBusy(true);
    setErr(null);
    try {
      await deleteAdminLogs(pw);
      onDeleted();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="log-delete-overlay" role="dialog" aria-modal="true" aria-label="Delete all logs">
      <div className="log-delete-modal">
        <h3>Delete all logs</h3>
        <p className="log-delete-warn">This is permanent and cannot be undone.</p>
        <input
          type="password"
          className="log-delete-pw-input"
          placeholder="Delete password…"
          value={pw}
          maxLength={128}
          autoFocus
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose(); }}
        />
        {err && <p className="log-delete-err" role="alert">{err}</p>}
        <div className="log-delete-actions">
          <button className="log-delete-btn--cancel" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="log-delete-btn--confirm" onClick={handleConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Confirm delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

type LogCategory = 'all' | 'auth' | 'analysis' | 'survey' | 'frontend' | 'errors';

const LOG_CATEGORY_TABS: Array<{ id: LogCategory; label: string; hint: string }> = [
  { id: 'all',      label: 'All activity',     hint: 'Every event recorded across the system' },
  { id: 'auth',     label: 'Sign-in & seats',  hint: 'Logins, registrations, tester seat claims, sign-outs' },
  { id: 'analysis', label: 'Analysis runs',    hint: 'Submissions, saved runs, manual retags, GDB tests' },
  { id: 'survey',   label: 'Surveys & reviews', hint: 'Consent, pretest, per-run and end-of-session feedback' },
  { id: 'frontend', label: 'Frontend events',  hint: 'In-app actions reported by the SPA (navigation, dispatch, etc.)' },
  { id: 'errors',   label: 'Errors & failures', hint: 'Anything that failed — backend or frontend' }
];

// Bucket an event_type into one of the admin tab categories. Frontend events
// are detected by the `frontend.` prefix; backend events are split by
// hand-curated keyword matches against a small allow-list.
function categoryOf(eventType: string): LogCategory {
  if (!eventType) return 'all';
  const t = eventType.toLowerCase();
  if (t.startsWith('frontend.')) {
    return t.includes('fail') || t.includes('error') ? 'errors' : 'frontend';
  }
  if (t.includes('login') || t.includes('register') || t.includes('claim') || t.includes('logout') || t.includes('disconnect')) return 'auth';
  if (t.includes('survey') || t.includes('consent') || t.includes('review')) return 'survey';
  if (t.includes('error') || t.includes('fail')) return 'errors';
  if (t.includes('analy') || t.includes('save') || t.includes('upload') || t.includes('transform') || t.includes('manual_review') || t.includes('test')) return 'analysis';
  return 'all';
}

function LogsList() {
  const [logs, setLogs]           = useState<AdminLogEntry[] | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [eventFilter, setFilter]  = useState('');
  const [category, setCategory]   = useState<LogCategory>('all');
  const [sortDesc, setSortDesc]   = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const cancelledRef = useRef(false);

  function load() {
    cancelledRef.current = false;
    fetchAdminLogs(200)
      .then(d => { if (!cancelledRef.current) setLogs(d.logs ?? []); })
      .catch(err => {
        if (cancelledRef.current) return;
        if (isAuthError(err)) { setLogs([]); return; }
        setError(err instanceof Error ? err.message : 'Failed to load logs');
      });
  }

  useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => { cancelledRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allEventTypes = useMemo(() => {
    if (!logs) return [];
    return [...new Set(logs.map(l => l.event_type))].sort();
  }, [logs]);

  const visible = useMemo(() => {
    if (!logs) return [];
    let result = logs;
    const q = search.toLowerCase();
    if (q) result = result.filter(l => (l.username ?? '').toLowerCase().includes(q));
    if (eventFilter) result = result.filter(l => l.event_type === eventFilter);
    if (category !== 'all') result = result.filter(l => categoryOf(l.event_type) === category);
    return sortDesc
      ? [...result].sort((a, b) => b.id - a.id)
      : [...result].sort((a, b) => a.id - b.id);
  }, [logs, search, eventFilter, category, sortDesc]);

  const categoryCounts = useMemo(() => {
    const counts: Record<LogCategory, number> = { all: 0, auth: 0, analysis: 0, survey: 0, frontend: 0, errors: 0 };
    if (logs) {
      counts.all = logs.length;
      for (const l of logs) {
        const c = categoryOf(l.event_type);
        if (c !== 'all') counts[c] += 1;
      }
    }
    return counts;
  }, [logs]);

  if (error) return <div className="empty-state admin-error" role="alert">Failed to load logs: {error}</div>;
  if (logs === null) return <div className="empty-state">Loading logs…</div>;

  return (
    <>
      <nav className="logs-cat-tabs" role="tablist" aria-label="Log categories">
        {LOG_CATEGORY_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={category === t.id}
            title={t.hint}
            className={`logs-cat-tab${category === t.id ? ' is-active' : ''}`}
            onClick={() => setCategory(t.id)}
          >
            <span className="logs-cat-label">{t.label}</span>
            <span className="logs-cat-count">{categoryCounts[t.id]}</span>
          </button>
        ))}
      </nav>
      <div className="logs-controls">
        <input
          type="search"
          className="user-search-input"
          placeholder="Filter by username…"
          value={search}
          maxLength={64}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search logs by username"
        />
        <select
          className="logs-event-select"
          value={eventFilter}
          onChange={e => setFilter(e.target.value)}
          aria-label="Filter by event type"
        >
          <option value="">All events</option>
          {allEventTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          className="user-ctrl-btn"
          onClick={() => setSortDesc(d => !d)}
          title={`Date ${sortDesc ? 'newest first' : 'oldest first'} — click to toggle`}
        >
          Date {sortDesc ? '↓' : '↑'}
        </button>
        <button className="user-ctrl-btn user-ctrl-btn--danger" onClick={() => setShowDelete(true)}>
          Delete all…
        </button>
      </div>

      {visible.length === 0
        ? (
          <div className="empty-state">
            No log entries{search || eventFilter ? ' matching filters' : ''}.
          </div>
        )
        : (
          <div className="logs-table-wrap">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>User</th>
                  <th>Event</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(l => (
                  <tr key={l.id}>
                    <td className="logs-td-date">{fmtDate(l.created_at)}</td>
                    <td className="logs-td-user">{l.username ?? '—'}</td>
                    <td><EventPill type={l.event_type} /></td>
                    <td className="logs-td-msg">{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {showDelete && (
        <DeleteModal
          onClose={() => setShowDelete(false)}
          onDeleted={() => setLogs([])}
        />
      )}
    </>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

import AuditPanel from './AuditPanel';
import RunsManager from './RunsManager';

export default function LogsView() {
  return (
    <>
      <section className="admin-section">
        <h2>Reviews</h2>
        <ReviewsList />
      </section>
      <section className="admin-section">
        <h2>Analysis runs</h2>
        <p className="admin-section-lede">
          Each row is a saved submission. Click a run to inspect the file(s)
          that were analyzed; deletion is audited and cascades to its reviews.
        </p>
        <RunsManager />
      </section>
      <section className="admin-section">
        <h2>Logs</h2>
        <LogsList />
      </section>
      <section className="admin-section">
        <h2>Audit log</h2>
        <p className="admin-section-lede">
          Append-only record of destructive admin actions (run deletions, log
          purges). Cannot be cleared.
        </p>
        <AuditPanel />
      </section>
    </>
  );
}
