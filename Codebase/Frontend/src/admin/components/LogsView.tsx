import { useEffect, useState } from 'react';
import { fetchAdminLogs, fetchAdminReviews } from '../../api/client';
import { AdminLogEntry, AdminReview } from '../../types/api';
import { fmtDate } from '../../lib/patterns';

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
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load reviews'); });
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

function LogsList() {
  const [logs, setLogs] = useState<AdminLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminLogs(80)
      .then(d => { if (!cancelled) setLogs(d.logs || []); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load logs'); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="empty-state admin-error" role="alert">Failed to load logs: {error}</div>;
  if (logs === null) return <div className="empty-state">Loading logs...</div>;
  if (!logs.length) return <div className="empty-state">No log entries.</div>;

  return (
    <div id="logs-list" className="logs-list">
      {logs.map((l, idx) => (
        <div key={idx} className="log-row">
          <span>{fmtDate(l.created_at)}</span>
          <span>{l.username || '—'}</span>
          <strong>{l.event_type}</strong>
          <span>{l.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function LogsView() {
  return (
    <>
      <section className="admin-section">
        <h2>Reviews</h2>
        <ReviewsList />
      </section>
      <section className="admin-section">
        <h2>Logs</h2>
        <LogsList />
      </section>
    </>
  );
}
