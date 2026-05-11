import { useEffect, useState } from 'react';
import { fetchAdminReviews } from '../../api/client';
import { AdminReview } from '../../types/api';
import { isAuthError } from '../lib/silenceAuthErrors';

/**
 * Reviews list pulled out of AdminApp.tsx so the entry-point file
 * stays focused on shell/layout. Logic is byte-identical to the
 * inline component it replaces — same fetch path, same auth-error
 * silencing, same render shape.
 */
export default function ReviewsPanel() {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchAdminReviews()
      .then(r => setReviews(r.reviews))
      .catch(e => {
        if (isAuthError(e)) { setReviews([]); return; }
        setError(e.message);
      });
  }, []);
  if (error) return <div className="empty-state admin-error" role="alert">{error}</div>;
  if (!reviews) return <div className="empty-state">Loading…</div>;
  if (reviews.length === 0) return <div className="empty-state">No reviews yet.</div>;
  return (
    <table className="f1-pattern-table">
      <thead>
        <tr>
          <th>User</th><th>Scope</th><th>Source</th><th>Version</th><th>Date</th>
        </tr>
      </thead>
      <tbody>
        {reviews.map((r, i) => (
          <tr key={i}>
            <td>{r.username ?? '—'}</td>
            <td>{r.scope}</td>
            <td>{r.sourceName ?? '—'}</td>
            <td>{r.schemaVersion}</td>
            <td>{r.createdAt?.slice(0, 10)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
