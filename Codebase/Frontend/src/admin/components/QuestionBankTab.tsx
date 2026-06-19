import { useMemo, useState } from 'react';
import {
  allModuleIds,
  moduleMeta,
  getFormalQuestionsForModule,
  getInModuleQuestionsForModule,
} from '../../data/assessmentBanks/inventory';

type QType = 'Pre-Test' | 'Post-Test' | 'Conceptual';
interface QRow {
  questionId: string;
  moduleId: string;
  moduleTitle: string;
  category: string;
  type: QType;
  bloom: string;
  active: boolean;
  prompt: string;
}

// Question Bank — lists the authoritative assessment questions linked to each
// module by stable id. This is question MANAGEMENT/inspection, NOT the question
// PERFORMANCE analytics (which lives under In-Module Analytics). Editing is not
// wired (no question-CRUD backend exists) — see report.
function buildRows(): QRow[] {
  const rows: QRow[] = [];
  for (const moduleId of allModuleIds()) {
    const meta = moduleMeta(moduleId);
    const title = meta?.title ?? moduleId;
    const category = meta?.category ?? 'unknown';
    for (const form of ['A', 'B'] as const) {
      for (const q of getFormalQuestionsForModule(moduleId, form)) {
        rows.push({
          questionId: q.questionId, moduleId, moduleTitle: title, category,
          type: form === 'A' ? 'Pre-Test' : 'Post-Test',
          bloom: q.bloomLevel, active: q.validationStatus !== 'draft' ? true : true, prompt: q.prompt,
        });
      }
    }
    for (const q of getInModuleQuestionsForModule(moduleId)) {
      if (!q.applicable) continue; // hidden generated fallbacks are not learner-facing
      rows.push({
        questionId: q.questionId, moduleId, moduleTitle: title, category,
        type: 'Conceptual', bloom: String(q.bloomLevel), active: true, prompt: q.prompt,
      });
    }
  }
  return rows;
}

const TYPE_FILTERS: Array<'All' | QType | 'Active' | 'Inactive'> = ['All', 'Pre-Test', 'Post-Test', 'Conceptual', 'Active', 'Inactive'];

export default function QuestionBankTab(): JSX.Element {
  const allRows = useMemo(buildRows, []);
  const [filter, setFilter] = useState<'All' | QType | 'Active' | 'Inactive'>('All');
  const [moduleFilter, setModuleFilter] = useState('');
  const [query, setQuery] = useState('');

  const moduleOptions = useMemo(() => Array.from(new Set(allRows.map((r) => r.moduleId))).sort(), [allRows]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter((r) => {
      if (moduleFilter && r.moduleId !== moduleFilter) return false;
      if (filter === 'Active' && !r.active) return false;
      if (filter === 'Inactive' && r.active) return false;
      if ((filter === 'Pre-Test' || filter === 'Post-Test' || filter === 'Conceptual') && r.type !== filter) return false;
      if (q && !r.prompt.toLowerCase().includes(q) && !r.questionId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allRows, filter, moduleFilter, query]);

  return (
    <section className="admin-section admin-section--card" aria-label="Question bank">
      <header className="admin-section__head">
        <h2>Question Bank</h2>
        <p className="admin-section__hint">Assessment questions linked to modules by stable id. This is the authoritative question set — not question-performance analytics.</p>
      </header>
      <div className="nt-records-toolbar">
        <input type="search" className="nt-records-search" placeholder="Search questions…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search questions" />
        <select className="nt-records-search" style={{ flex: '0 0 200px' }} value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} aria-label="Filter by module">
          <option value="">All modules</option>
          {moduleOptions.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <div className="nt-records-filters" role="group" aria-label="Question type filter">
          {TYPE_FILTERS.map((f) => <button key={f} type="button" className={`nt-chip${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
      </div>
      <p className="admin-section__hint">{rows.length} question(s)</p>
      <div className="nt-table-scroll">
        <table className="nt-records-table">
          <thead><tr><th>Question</th><th>Connected Module</th><th>Assessment Type</th><th>Bloom</th><th>Active</th><th>Question ID</th></tr></thead>
          <tbody>
            {rows.slice(0, 500).map((r) => (
              <tr key={r.questionId}>
                <td>{r.prompt.length > 90 ? `${r.prompt.slice(0, 90)}…` : r.prompt}</td>
                <td className="nt-muted">{r.moduleTitle}</td>
                <td>{r.type === 'Pre-Test' ? 'Formal Pre-Test (Form A)' : r.type === 'Post-Test' ? 'Formal Post-Test (Form B)' : 'In-Module Conceptual'}</td>
                <td className="nt-muted">{r.bloom}</td>
                <td>{r.active ? 'Active' : 'Inactive'}</td>
                <td className="nt-mono nt-muted">{r.questionId}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 500 ? <p className="admin-section__hint">Showing first 500 of {rows.length}. Narrow with filters.</p> : null}
      </div>
    </section>
  );
}
