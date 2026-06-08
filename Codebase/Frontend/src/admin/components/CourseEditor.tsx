// Course editor modal (D92 Track B-UI). A real form over the LearningModule
// document: scalars + a sections sub-editor + theoretical question bank +
// practical-exam fields + lightweight keyTerms/seeAlso lists. Serializes a
// mutable working draft into the frozen LearningModuleDTO wire shape on save
// (empties stripped), then calls createLearningModule / updateLearningModule.
//
// The backend re-validates everything; the client validation here only powers
// inline errors so the admin never round-trips an obviously-bad payload.

import { useMemo, useState } from 'react';
import { createLearningModule, updateLearningModule } from '../../api/client';
import type { AdminLearningModule } from '../../types/api';
import type {
  LearningCategory,
  LearningModuleDTO,
  LearningSection,
  ExamQuestion,
} from '../../data/learningModules';

const CATEGORIES: ReadonlyArray<{ id: LearningCategory; label: string }> = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'creational', label: 'Creational' },
  { id: 'structural', label: 'Structural' },
  { id: 'behavioural', label: 'Behavioural' },
  { id: 'idioms', label: 'Idioms' },
];

const PRACTICAL_FAMILIES = ['Creational', 'Structural', 'Behavioural', 'Idioms'] as const;
type PracticalFamily = (typeof PRACTICAL_FAMILIES)[number];

const PASS_MODES: ReadonlyArray<{ id: 'detection' | 'detection_and_tests'; label: string }> = [
  { id: 'detection', label: 'Detection only — pattern tagged passes' },
  { id: 'detection_and_tests', label: 'Detection + tests — must also pass unit tests' },
];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── Working-draft model ─────────────────────────────────────────────────────
// The form edits mutable strings (bullets/options as one-per-line text isn't
// used here; we keep arrays directly with add/remove controls). On save we map
// this draft to the immutable DTO and drop empty optionals.

interface SectionDraft {
  key: string;
  heading: string;
  body: string;
  bulletsText: string; // one bullet per line
  code: string;
  note: string;
}

interface QuestionDraft {
  key: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface TermDraft {
  key: string;
  term: string;
  definition: string;
}

interface SeeAlsoDraft {
  key: string;
  moduleId: string;
  label: string;
}

interface CourseDraft {
  id: string;
  category: LearningCategory;
  title: string;
  eyebrow: string;
  intro: string;
  summary: string;
  sections: SectionDraft[];
  hasTheoretical: boolean;
  questions: QuestionDraft[];
  hasPractical: boolean;
  patternSlug: string;
  patternName: string;
  practicalFamily: PracticalFamily;
  prompt: string;
  starterCode: string;
  passMode: 'detection' | 'detection_and_tests';
  keyTerms: TermDraft[];
  seeAlso: SeeAlsoDraft[];
  published: boolean;
  sortOrder: number;
}

let keySeq = 0;
function nextKey(prefix: string): string {
  keySeq += 1;
  return `${prefix}-${keySeq}-${Math.random().toString(16).slice(2, 8)}`;
}

function bulletsToText(bullets?: ReadonlyArray<string>): string {
  return (bullets ?? []).join('\n');
}

function textToBullets(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isPracticalFamily(value: string): value is PracticalFamily {
  return (PRACTICAL_FAMILIES as readonly string[]).includes(value);
}

// Seed a blank draft (create mode) or hydrate from an existing module (edit).
function toDraft(source: AdminLearningModule | null): CourseDraft {
  if (!source) {
    return {
      id: '',
      category: 'foundations',
      title: '',
      eyebrow: '',
      intro: '',
      summary: '',
      sections: [],
      hasTheoretical: false,
      questions: [],
      hasPractical: false,
      patternSlug: '',
      patternName: '',
      practicalFamily: 'Creational',
      prompt: '',
      starterCode: '',
      passMode: 'detection',
      keyTerms: [],
      seeAlso: [],
      published: false,
      sortOrder: 0,
    };
  }
  const theoretical = source.theoreticalExam;
  const practical = source.practicalExam;
  return {
    id: source.id,
    category: source.category,
    title: source.title,
    eyebrow: source.eyebrow,
    intro: source.intro,
    summary: source.summary ?? '',
    sections: source.sections.map((s) => ({
      key: nextKey('sec'),
      heading: s.heading,
      body: s.body ?? '',
      bulletsText: bulletsToText(s.bullets),
      code: s.code ?? '',
      note: s.note ?? '',
    })),
    hasTheoretical: Boolean(theoretical),
    questions: (theoretical?.questions ?? []).map((q) => ({
      key: nextKey('q'),
      question: q.question,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation ?? '',
    })),
    hasPractical: Boolean(practical),
    patternSlug: practical?.patternSlug ?? '',
    patternName: practical?.patternName ?? '',
    practicalFamily: practical?.family ?? 'Creational',
    prompt: practical?.prompt ?? '',
    starterCode: practical?.starterCode ?? '',
    passMode: practical?.passMode ?? 'detection',
    keyTerms: (source.keyTerms ?? []).map((t) => ({
      key: nextKey('term'),
      term: t.term,
      definition: t.definition,
    })),
    seeAlso: (source.seeAlso ?? []).map((s) => ({
      key: nextKey('see'),
      moduleId: s.moduleId,
      label: s.label,
    })),
    published: source.published,
    sortOrder: source.sortOrder,
  };
}

// ── Validation ──────────────────────────────────────────────────────────────
function validate(draft: CourseDraft): string[] {
  const errors: string[] = [];
  const id = draft.id.trim();
  if (id.length === 0) {
    errors.push('Module id is required.');
  } else if (!SLUG_RE.test(id)) {
    errors.push('Module id must be slug-ish (lowercase letters, digits, single hyphens).');
  }
  if (draft.title.trim().length === 0) errors.push('Title is required.');
  if (!CATEGORIES.some((c) => c.id === draft.category)) errors.push('Category is out of range.');

  draft.sections.forEach((s, i) => {
    if (s.heading.trim().length === 0) {
      errors.push(`Section ${i + 1}: heading is required.`);
    }
  });

  if (draft.hasTheoretical) {
    if (draft.questions.length === 0) {
      errors.push('Theoretical exam is on but has no questions.');
    }
    draft.questions.forEach((q, i) => {
      if (q.question.trim().length === 0) {
        errors.push(`Question ${i + 1}: prompt is required.`);
      }
      const filled = q.options.filter((o) => o.trim().length > 0);
      if (filled.length < 2) {
        errors.push(`Question ${i + 1}: needs at least 2 non-empty options.`);
      }
      if (q.correctIndex < 0 || q.correctIndex >= q.options.length || q.options[q.correctIndex]?.trim().length === 0) {
        errors.push(`Question ${i + 1}: pick a non-empty correct option.`);
      }
    });
  }

  if (draft.hasPractical) {
    if (draft.patternSlug.trim().length === 0) errors.push('Practical exam: pattern slug is required.');
    if (draft.patternName.trim().length === 0) errors.push('Practical exam: pattern name is required.');
    if (draft.prompt.trim().length === 0) errors.push('Practical exam: prompt is required.');
    if (!isPracticalFamily(draft.practicalFamily)) errors.push('Practical exam: family is out of range.');
  }

  return errors;
}

// ── Serialize draft → DTO (drop empty optionals) ───────────────────────────
function toPayload(
  draft: CourseDraft,
): LearningModuleDTO & { published?: boolean; sortOrder?: number } {
  const sections: LearningSection[] = draft.sections.map((s) => {
    const bullets = textToBullets(s.bulletsText);
    const section: LearningSection = { heading: s.heading.trim() };
    if (s.body.trim().length > 0) section.body = s.body.trim();
    if (bullets.length > 0) section.bullets = bullets;
    if (s.code.length > 0) section.code = s.code;
    if (s.note.trim().length > 0) section.note = s.note.trim();
    return section;
  });

  const payload: LearningModuleDTO & {
    published?: boolean;
    sortOrder?: number;
  } = {
    id: draft.id.trim(),
    category: draft.category,
    title: draft.title.trim(),
    eyebrow: draft.eyebrow.trim(),
    intro: draft.intro.trim(),
    sections,
    published: draft.published,
    sortOrder: draft.sortOrder,
  };

  if (draft.summary.trim().length > 0) payload.summary = draft.summary.trim();

  const keyTerms = draft.keyTerms
    .filter((t) => t.term.trim().length > 0 && t.definition.trim().length > 0)
    .map((t) => ({ term: t.term.trim(), definition: t.definition.trim() }));
  if (keyTerms.length > 0) payload.keyTerms = keyTerms;

  const seeAlso = draft.seeAlso
    .filter((s) => s.moduleId.trim().length > 0 && s.label.trim().length > 0)
    .map((s) => ({ moduleId: s.moduleId.trim(), label: s.label.trim() }));
  if (seeAlso.length > 0) payload.seeAlso = seeAlso;

  if (draft.hasTheoretical) {
    const questions: ExamQuestion[] = draft.questions.map((q) => {
      const options = q.options.map((o) => o.trim()).filter((o) => o.length > 0);
      const correctText = q.options[q.correctIndex]?.trim() ?? '';
      const correctIndex = Math.max(0, options.indexOf(correctText));
      const item: ExamQuestion = {
        question: q.question.trim(),
        options,
        correctIndex,
      };
      if (q.explanation.trim().length > 0) item.explanation = q.explanation.trim();
      return item;
    });
    payload.theoreticalExam = { kind: 'theoretical', questions };
  }

  if (draft.hasPractical) {
    payload.practicalExam = {
      kind: 'practical',
      patternSlug: draft.patternSlug.trim(),
      patternName: draft.patternName.trim(),
      family: draft.practicalFamily,
      prompt: draft.prompt.trim(),
      passMode: draft.passMode,
      ...(draft.starterCode.length > 0 ? { starterCode: draft.starterCode } : {}),
    };
  }

  return payload;
}

interface CourseEditorProps {
  // null ⇒ create mode (id editable). Otherwise edit mode (id read-only).
  source: AdminLearningModule | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function CourseEditor({ source, onClose, onSaved }: CourseEditorProps) {
  const isEdit = source !== null;
  const [draft, setDraft] = useState<CourseDraft>(() => toDraft(source));
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const errors = useMemo(() => validate(draft), [draft]);

  function patch(next: Partial<CourseDraft>): void {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  // ── Sections ──
  function addSection(): void {
    patch({
      sections: [
        ...draft.sections,
        { key: nextKey('sec'), heading: '', body: '', bulletsText: '', code: '', note: '' },
      ],
    });
  }
  function updateSection(key: string, next: Partial<SectionDraft>): void {
    patch({ sections: draft.sections.map((s) => (s.key === key ? { ...s, ...next } : s)) });
  }
  function removeSection(key: string): void {
    patch({ sections: draft.sections.filter((s) => s.key !== key) });
  }
  function moveSection(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= draft.sections.length) return;
    const copy = [...draft.sections];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    patch({ sections: copy });
  }

  // ── Questions ──
  function addQuestion(): void {
    patch({
      questions: [
        ...draft.questions,
        { key: nextKey('q'), question: '', options: ['', ''], correctIndex: 0, explanation: '' },
      ],
    });
  }
  function updateQuestion(key: string, next: Partial<QuestionDraft>): void {
    patch({ questions: draft.questions.map((q) => (q.key === key ? { ...q, ...next } : q)) });
  }
  function removeQuestion(key: string): void {
    patch({ questions: draft.questions.filter((q) => q.key !== key) });
  }
  function addOption(qKey: string): void {
    patch({
      questions: draft.questions.map((q) =>
        q.key === qKey ? { ...q, options: [...q.options, ''] } : q,
      ),
    });
  }
  function updateOption(qKey: string, optIndex: number, value: string): void {
    patch({
      questions: draft.questions.map((q) =>
        q.key === qKey
          ? { ...q, options: q.options.map((o, i) => (i === optIndex ? value : o)) }
          : q,
      ),
    });
  }
  function removeOption(qKey: string, optIndex: number): void {
    patch({
      questions: draft.questions.map((q) => {
        if (q.key !== qKey || q.options.length <= 2) return q;
        const options = q.options.filter((_, i) => i !== optIndex);
        let correctIndex = q.correctIndex;
        if (optIndex === correctIndex) correctIndex = 0;
        else if (optIndex < correctIndex) correctIndex -= 1;
        return { ...q, options, correctIndex };
      }),
    });
  }

  // ── Key terms ──
  function addTerm(): void {
    patch({ keyTerms: [...draft.keyTerms, { key: nextKey('term'), term: '', definition: '' }] });
  }
  function updateTerm(key: string, next: Partial<TermDraft>): void {
    patch({ keyTerms: draft.keyTerms.map((t) => (t.key === key ? { ...t, ...next } : t)) });
  }
  function removeTerm(key: string): void {
    patch({ keyTerms: draft.keyTerms.filter((t) => t.key !== key) });
  }

  // ── See also ──
  function addSeeAlso(): void {
    patch({ seeAlso: [...draft.seeAlso, { key: nextKey('see'), moduleId: '', label: '' }] });
  }
  function updateSeeAlso(key: string, next: Partial<SeeAlsoDraft>): void {
    patch({ seeAlso: draft.seeAlso.map((s) => (s.key === key ? { ...s, ...next } : s)) });
  }
  function removeSeeAlso(key: string): void {
    patch({ seeAlso: draft.seeAlso.filter((s) => s.key !== key) });
  }

  async function onSave(): Promise<void> {
    if (saving) return;
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const payload = toPayload(draft);
      if (isEdit) {
        await updateLearningModule(payload.id, payload);
      } else {
        await createLearningModule(payload);
      }
      onSaved();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="courses-overlay" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit course' : 'New course'}>
      <div className="courses-modal" data-testid="courses-editor">
        <header className="courses-modal__head">
          <h3>{isEdit ? `Edit course · ${source?.id}` : 'New course'}</h3>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>
            Close
          </button>
        </header>

        <div className="courses-modal__body">
          {/* ── Scalars ── */}
          <fieldset className="courses-fieldset">
            <legend>Basics</legend>
            <div className="courses-grid">
              <label className="admin-catalog-field">
                <span>Module id (slug){isEdit ? ' · read-only' : ''}</span>
                <input
                  type="text"
                  value={draft.id}
                  onChange={(e) => patch({ id: e.target.value })}
                  placeholder="e.g. creational-singleton"
                  disabled={isEdit || saving}
                  readOnly={isEdit}
                  data-testid="courses-field-id"
                />
              </label>
              <label className="admin-catalog-field">
                <span>Category</span>
                <select
                  value={draft.category}
                  onChange={(e) => patch({ category: e.target.value as LearningCategory })}
                  disabled={saving}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-catalog-field">
                <span>Title</span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  disabled={saving}
                />
              </label>
              <label className="admin-catalog-field">
                <span>Eyebrow</span>
                <input
                  type="text"
                  value={draft.eyebrow}
                  onChange={(e) => patch({ eyebrow: e.target.value })}
                  placeholder="short kicker above the title"
                  disabled={saving}
                />
              </label>
            </div>
            <label className="admin-catalog-field">
              <span>Intro</span>
              <textarea
                rows={3}
                value={draft.intro}
                onChange={(e) => patch({ intro: e.target.value })}
                disabled={saving}
              />
            </label>
            <label className="admin-catalog-field">
              <span>Summary (optional)</span>
              <textarea
                rows={2}
                value={draft.summary}
                onChange={(e) => patch({ summary: e.target.value })}
                disabled={saving}
              />
            </label>
          </fieldset>

          {/* ── Sections ── */}
          <fieldset className="courses-fieldset">
            <legend>Sections ({draft.sections.length})</legend>
            {draft.sections.length === 0 && (
              <p className="admin-section__hint">No sections yet.</p>
            )}
            {draft.sections.map((s, i) => (
              <div key={s.key} className="courses-subcard">
                <div className="courses-subcard__head">
                  <strong>Section {i + 1}</strong>
                  <div className="courses-subcard__actions">
                    <button type="button" className="ghost-btn" onClick={() => moveSection(i, -1)} disabled={saving || i === 0} aria-label="Move section up">↑</button>
                    <button type="button" className="ghost-btn" onClick={() => moveSection(i, 1)} disabled={saving || i === draft.sections.length - 1} aria-label="Move section down">↓</button>
                    <button type="button" className="ghost-btn" onClick={() => removeSection(s.key)} disabled={saving}>Remove</button>
                  </div>
                </div>
                <label className="admin-catalog-field">
                  <span>Heading</span>
                  <input type="text" value={s.heading} onChange={(e) => updateSection(s.key, { heading: e.target.value })} disabled={saving} />
                </label>
                <label className="admin-catalog-field">
                  <span>Body (optional)</span>
                  <textarea rows={2} value={s.body} onChange={(e) => updateSection(s.key, { body: e.target.value })} disabled={saving} />
                </label>
                <label className="admin-catalog-field">
                  <span>Bullets (optional · one per line)</span>
                  <textarea rows={2} value={s.bulletsText} onChange={(e) => updateSection(s.key, { bulletsText: e.target.value })} disabled={saving} />
                </label>
                <label className="admin-catalog-field">
                  <span>Code (optional)</span>
                  <textarea rows={3} className="courses-code" value={s.code} onChange={(e) => updateSection(s.key, { code: e.target.value })} disabled={saving} />
                </label>
                <label className="admin-catalog-field">
                  <span>Note (optional)</span>
                  <input type="text" value={s.note} onChange={(e) => updateSection(s.key, { note: e.target.value })} disabled={saving} />
                </label>
              </div>
            ))}
            <button type="button" className="ghost-btn" onClick={addSection} disabled={saving}>+ Add section</button>
          </fieldset>

          {/* ── Theoretical exam ── */}
          <fieldset className="courses-fieldset">
            <legend>Theoretical exam</legend>
            <label className="courses-toggle-row">
              <input type="checkbox" checked={draft.hasTheoretical} onChange={(e) => patch({ hasTheoretical: e.target.checked })} disabled={saving} data-testid="courses-toggle-theoretical" />
              <span>Include a theoretical exam (MCQ bank)</span>
            </label>
            {draft.hasTheoretical && (
              <>
                {draft.questions.length === 0 && <p className="admin-section__hint">No questions yet.</p>}
                {draft.questions.map((q, qi) => (
                  <div key={q.key} className="courses-subcard">
                    <div className="courses-subcard__head">
                      <strong>Question {qi + 1}</strong>
                      <button type="button" className="ghost-btn" onClick={() => removeQuestion(q.key)} disabled={saving}>Remove</button>
                    </div>
                    <label className="admin-catalog-field">
                      <span>Question</span>
                      <textarea rows={2} value={q.question} onChange={(e) => updateQuestion(q.key, { question: e.target.value })} disabled={saving} />
                    </label>
                    <div className="courses-options">
                      <span className="courses-options__label">Options (radio = correct answer)</span>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="courses-option-row">
                          <input
                            type="radio"
                            name={`correct-${q.key}`}
                            checked={q.correctIndex === oi}
                            onChange={() => updateQuestion(q.key, { correctIndex: oi })}
                            disabled={saving}
                            aria-label={`Mark option ${oi + 1} correct`}
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(q.key, oi, e.target.value)}
                            placeholder={`Option ${oi + 1}`}
                            disabled={saving}
                          />
                          <button type="button" className="ghost-btn" onClick={() => removeOption(q.key, oi)} disabled={saving || q.options.length <= 2}>×</button>
                        </div>
                      ))}
                      <button type="button" className="ghost-btn" onClick={() => addOption(q.key)} disabled={saving}>+ Add option</button>
                    </div>
                    <label className="admin-catalog-field">
                      <span>Explanation (optional)</span>
                      <textarea rows={2} value={q.explanation} onChange={(e) => updateQuestion(q.key, { explanation: e.target.value })} disabled={saving} />
                    </label>
                  </div>
                ))}
                <button type="button" className="ghost-btn" onClick={addQuestion} disabled={saving}>+ Add question</button>
              </>
            )}
          </fieldset>

          {/* ── Practical exam ── */}
          <fieldset className="courses-fieldset">
            <legend>Practical exam</legend>
            <label className="courses-toggle-row">
              <input type="checkbox" checked={draft.hasPractical} onChange={(e) => patch({ hasPractical: e.target.checked })} disabled={saving} data-testid="courses-toggle-practical" />
              <span>Include a practical exam (Studio code-check)</span>
            </label>
            {draft.hasPractical && (
              <>
                <div className="courses-grid">
                  <label className="admin-catalog-field">
                    <span>Pattern slug</span>
                    <input type="text" value={draft.patternSlug} onChange={(e) => patch({ patternSlug: e.target.value })} placeholder="e.g. singleton" disabled={saving} />
                  </label>
                  <label className="admin-catalog-field">
                    <span>Pattern name</span>
                    <input type="text" value={draft.patternName} onChange={(e) => patch({ patternName: e.target.value })} placeholder="e.g. Singleton" disabled={saving} />
                  </label>
                  <label className="admin-catalog-field">
                    <span>Family</span>
                    <select value={draft.practicalFamily} onChange={(e) => patch({ practicalFamily: e.target.value as PracticalFamily })} disabled={saving}>
                      {PRACTICAL_FAMILIES.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-catalog-field">
                    <span>Pass mode</span>
                    <select value={draft.passMode} onChange={(e) => patch({ passMode: e.target.value as 'detection' | 'detection_and_tests' })} disabled={saving} data-testid="courses-field-passmode">
                      {PASS_MODES.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="admin-catalog-field">
                  <span>Prompt</span>
                  <textarea rows={2} value={draft.prompt} onChange={(e) => patch({ prompt: e.target.value })} disabled={saving} />
                </label>
                <label className="admin-catalog-field">
                  <span>Starter code (optional)</span>
                  <textarea rows={4} className="courses-code" value={draft.starterCode} onChange={(e) => patch({ starterCode: e.target.value })} disabled={saving} />
                </label>
              </>
            )}
          </fieldset>

          {/* ── Key terms ── */}
          <fieldset className="courses-fieldset">
            <legend>Key terms ({draft.keyTerms.length})</legend>
            {draft.keyTerms.map((t) => (
              <div key={t.key} className="courses-pair-row">
                <input type="text" value={t.term} onChange={(e) => updateTerm(t.key, { term: e.target.value })} placeholder="Term" disabled={saving} />
                <input type="text" value={t.definition} onChange={(e) => updateTerm(t.key, { definition: e.target.value })} placeholder="Definition" disabled={saving} />
                <button type="button" className="ghost-btn" onClick={() => removeTerm(t.key)} disabled={saving}>×</button>
              </div>
            ))}
            <button type="button" className="ghost-btn" onClick={addTerm} disabled={saving}>+ Add term</button>
          </fieldset>

          {/* ── See also ── */}
          <fieldset className="courses-fieldset">
            <legend>See also ({draft.seeAlso.length})</legend>
            {draft.seeAlso.map((s) => (
              <div key={s.key} className="courses-pair-row">
                <input type="text" value={s.moduleId} onChange={(e) => updateSeeAlso(s.key, { moduleId: e.target.value })} placeholder="module id" disabled={saving} />
                <input type="text" value={s.label} onChange={(e) => updateSeeAlso(s.key, { label: e.target.value })} placeholder="Label" disabled={saving} />
                <button type="button" className="ghost-btn" onClick={() => removeSeeAlso(s.key)} disabled={saving}>×</button>
              </div>
            ))}
            <button type="button" className="ghost-btn" onClick={addSeeAlso} disabled={saving}>+ Add link</button>
          </fieldset>

          {/* ── Publishing controls (module on/off) ── */}
          <fieldset className="courses-fieldset">
            <legend>On / Off</legend>
            <label className="courses-toggle-row">
              <input type="checkbox" checked={draft.published} onChange={(e) => patch({ published: e.target.checked })} disabled={saving} />
              <span>On (visible to learners)</span>
            </label>
            <p className="admin-section__hint">
              Questions are already tagged in the module JSON. Use On/Off to control
              whether the module is visible to learners.
            </p>
            <label className="admin-catalog-field courses-sortorder">
              <span>Sort order</span>
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) => patch({ sortOrder: Number.parseInt(e.target.value, 10) || 0 })}
                disabled={saving}
              />
            </label>
          </fieldset>

          {showErrors && errors.length > 0 && (
            <div className="admin-login-error" role="alert" data-testid="courses-validation-errors">
              <strong>Fix before saving:</strong>
              <ul className="courses-errorlist">
                {errors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
          {serverError && <p className="admin-login-error" role="alert">{serverError}</p>}
        </div>

        <footer className="courses-modal__foot">
          <button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            type="button"
            className="primary-btn"
            onClick={onSave}
            disabled={saving || (showErrors && errors.length > 0)}
            data-testid="courses-save"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create course'}
          </button>
        </footer>
      </div>
    </div>
  );
}
