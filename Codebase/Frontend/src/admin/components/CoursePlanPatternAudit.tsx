import type { AdminPatternAuditEntry } from '../../types/api';

interface CoursePlanPatternAuditProps {
  entries: ReadonlyArray<AdminPatternAuditEntry>;
}

export default function CoursePlanPatternAudit({ entries }: CoursePlanPatternAuditProps): JSX.Element | null {
  if (entries.length === 0) return null;

  return (
    <details className="admin-plan-diagnostics__audit" open>
      <summary>Pattern audit</summary>
      <ul className="admin-scope-list">
        {entries.map((item) => (
          <li key={item.slug} className="admin-scope-card">
            <strong>{item.name}</strong>
            <div className="admin-scope-meta">
              <span>{item.family}</span>
              <span>score {Math.round(item.score)}</span>
              <span className={item.selected ? 'tag tag--on' : 'tag tag--off'}>
                {item.selected ? 'selected' : 'rejected'}
              </span>
            </div>
            {item.matchedEvidence.length > 0 && <p>{item.matchedEvidence.slice(0, 4).join(', ')}</p>}
            {item.rejectedReason && <p>{item.rejectedReason}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}
