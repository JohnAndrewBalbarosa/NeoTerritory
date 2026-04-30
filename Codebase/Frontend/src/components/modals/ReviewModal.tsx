import { useEffect, useState } from 'react';
import { fetchReviewSchema, submitReview } from '../../api/client';
import { ReviewQuestion, ReviewSchema } from '../../types/api';

interface ReviewModalProps {
  scope: string;
  analysisRunId?: number | null;
  intro?: string;
  onClose: (submitted: boolean) => void;
}

type AnswerValue = string | number;

function StarsField({ q, value, onChange }: { q: ReviewQuestion; value: number | undefined; onChange: (v: number) => void }) {
  const max = q.max || 5;
  return (
    <div className="review-stars-picker" data-qid={q.id}>
      {Array.from({ length: max }, (_, i) => i + 1).map(i => (
        <button
          key={i}
          type="button"
          className={`star-btn${value && value >= i ? ' active' : ''}`}
          aria-label={`${i} of ${max}`}
          onClick={() => onChange(i)}
        >★</button>
      ))}
    </div>
  );
}

function QuestionField({ q, value, onChange }: { q: ReviewQuestion; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void }) {
  if (q.type === 'rating') {
    return <StarsField q={q} value={typeof value === 'number' ? value : undefined} onChange={onChange} />;
  }
  if (q.type === 'text') {
    return (
      <textarea
        className="review-textarea"
        rows={3}
        maxLength={q.maxLength || 500}
        data-qid={q.id}
        placeholder={q.required ? 'Required' : 'Optional'}
        value={typeof value === 'string' ? value : ''}
        onChange={e => onChange(e.target.value)}
      />
    );
  }
  if (q.type === 'choice') {
    return (
      <select
        className="review-select"
        data-qid={q.id}
        value={typeof value === 'string' ? value : ''}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">{q.required ? '— select —' : '(skip)'}</option>
        {(q.options || []).map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }
  return null;
}

export default function ReviewModal({ scope, analysisRunId, intro, onClose }: ReviewModalProps) {
  const [schema, setSchema] = useState<ReviewSchema | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchReviewSchema(scope)
      .then(s => { if (!cancelled) setSchema(s); })
      .catch(() => { if (!cancelled) { setLoadFailed(true); onClose(false); } });
    return () => { cancelled = true; };
  }, [scope, onClose]);

  if (loadFailed || !schema || !schema.questions?.length) return null;

  function setAnswer(id: string, v: AnswerValue) {
    setAnswers(prev => ({ ...prev, [id]: v }));
  }

  async function onSubmit() {
    setBusy(true);
    setError('');
    try {
      // Only include non-empty answers
      const filtered: Record<string, AnswerValue> = {};
      for (const [k, v] of Object.entries(answers)) {
        if (v !== '' && v !== undefined && v !== null) filtered[k] = v;
      }
      await submitReview({ scope, analysisRunId: analysisRunId || undefined, answers: filtered });
      onClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="review-modal" className="modal">
      <div className="modal-card">
        <p id="review-intro" className="modal-detail">{intro || 'A few quick questions:'}</p>
        <div id="review-questions" className="review-questions">
          {schema.questions.map(q => (
            <div key={q.id} className="review-q">
              <label className="review-q-prompt">{q.prompt}{q.required ? ' *' : ''}</label>
              <QuestionField q={q} value={answers[q.id]} onChange={v => setAnswer(q.id, v)} />
            </div>
          ))}
        </div>
        {error && <p id="review-error" className="login-error">{error}</p>}
        <div className="modal-actions">
          <button id="review-skip-btn" className="ghost-btn" type="button" onClick={() => onClose(false)} disabled={busy}>
            Skip
          </button>
          <button id="review-submit-btn" className="primary-btn" type="button" onClick={onSubmit} disabled={busy}>
            {busy ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
