# Merge Docs + Pattern into a Single Line-by-Line Walkthrough — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the Studio Patterns tab's two redundant sub-views (Annotated + Documentation) into one decluttered surface: a continuous source spine with collapsible per-class pattern headers and inline line-by-line docs.

**Architecture:** A new `DocumentedSource` composition component derives a `documentedModel` (line → header / inline-doc payload) and renders the existing `SourceView` line renderer through two new render-slot props (no duplication of colour logic). `PatternHeader` renders at each class declaration line (collapsible, default collapsed); `InlineLineDoc` renders beneath each annotated line (visible by default). `LinePopover` is narrowed to the disambiguation picker. `AnnotatedTab` drops the sub-view toggle and the sidebar (`PatternCards`/`ClassBindings`/`ClassTreeView`); export buttons move into the results header and serialize the merged walkthrough.

**Tech Stack:** React + TypeScript, Zustand store, Vite, Vitest (newly added to Frontend), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-05-25-merge-docs-pattern-line-by-line-design.md`

---

## File Structure

**New files:**
- `Codebase/Frontend/src/logic/documentedModel.ts` — pure mapping: run + annotated-model → `{ headerByLine, docByLine }`.
- `Codebase/Frontend/src/components/analysis/PatternHeader.tsx` — collapsible per-class header.
- `Codebase/Frontend/src/components/analysis/InlineLineDoc.tsx` — inline under-line doc block.
- `Codebase/Frontend/src/components/analysis/DocumentedSource.tsx` — composition: derives `documentedModel`, renders `SourceView` with header/doc slots.
- `Codebase/Frontend/src/logic/__tests__/documentedModel.test.ts` — vitest unit tests.
- `Codebase/Frontend/vitest.config.ts` — Frontend vitest config (node env, logic only).
- Blueprints under `docs/Codebase/Frontend/src/...` mirroring each new code file.

**Modified files:**
- `Codebase/Frontend/src/components/analysis/SourceView.tsx` — add two optional render-slot props; gate popover to disambiguation lines.
- `Codebase/Frontend/src/components/analysis/LinePopover.tsx` — remove annotation-card body; keep picker + undo.
- `Codebase/Frontend/src/components/tabs/AnnotatedTab.tsx` — remove toggle + sidebar; mount `DocumentedSource`; move export buttons to header; add `data-testid="documented-source"`.
- `Codebase/Frontend/src/logic/docExport.ts` — re-author `generateMarkdown` to a line walkthrough; print CSS for new classes.
- `Codebase/Frontend/package.json` — add `vitest` dep + `test:unit` script.
- `.github/workflows/ci.yml` — add Frontend vitest step.
- `tests/routes.manifest.json` — keep `studio-shell` anchor (unchanged); no row add required, but verify.

**Removed from flow (files deleted in final task):**
- `Codebase/Frontend/src/components/tabs/DocumentationTab.tsx`
- `Codebase/Frontend/src/components/analysis/PatternCards.tsx`
- `Codebase/Frontend/src/components/analysis/ClassBindings.tsx`
- `Codebase/Frontend/src/components/analysis/ClassTreeView.tsx`
- their mirrored docs under `docs/Codebase/...`

---

## Task 1: Record design decisions + docs blueprints

**Files:**
- Modify: `docs/Codebase/DESIGN_DECISIONS.md`
- Create: `docs/Codebase/Frontend/src/logic/documentedModel.ts.md`
- Create: `docs/Codebase/Frontend/src/components/analysis/PatternHeader.tsx.md`
- Create: `docs/Codebase/Frontend/src/components/analysis/InlineLineDoc.tsx.md`
- Create: `docs/Codebase/Frontend/src/components/analysis/DocumentedSource.tsx.md`

- [ ] **Step 1: Append the design decision**

Append to `docs/Codebase/DESIGN_DECISIONS.md` (use the next free D-number; check the file's existing highest and increment):

```markdown
## D<N>: Patterns tab = single line-by-line walkthrough (Annotated + Docs merged)

The Studio Patterns tab no longer has an Annotated/Documentation sub-view
toggle. There is ONE surface: a continuous source spine. At each class
declaration line a collapsible `PatternHeader` carries the pattern-level
teaching (what-is-X / why-fired / when-to-use+analogy / methods-to-test).
Beneath each annotated line an `InlineLineDoc` carries the per-line note,
folding documentationTargets (landmarks) and usage callsites into one block.

- The sidebar (`PatternCards`, `ClassBindings`, `ClassTreeView`) is removed;
  class navigation is the ←/→ corner buttons; "where used" is inline.
- `LinePopover` is narrowed to the disambiguation picker only (docs moved inline).
- Default state: headers collapsed, inline docs visible.
- Export (MD/PDF/DOCX) serializes the merged walkthrough; print CSS forces
  headers expanded so nothing is hidden from the export.
- `DocumentedSource` composes the existing `SourceView` line renderer via two
  render-slot props — colour/scope logic is reused, not duplicated.
```

- [ ] **Step 2: Author the four blueprint docs**

Each blueprint mirrors the file it describes. Write `docs/Codebase/Frontend/src/logic/documentedModel.ts.md`:

```markdown
# documentedModel.ts

Pure derivation for the merged Patterns walkthrough. Input: `AnalysisRun` +
the already-derived `AnnotatedModel` (from `annotatedModel.ts`). Output:
`DocumentedModel` with two line-keyed maps:

- `headerByLine: Map<number, PatternHeaderData>` — one entry at each class
  declaration line, carrying pattern name, className, AI/static source, the
  definition (oneLiner/whenToUse/analogy/watchOuts) or AI education
  (explanation/whyThisFired/studyHint), and the unitTestTargets list.
- `docByLine: Map<number, InlineDocData>` — one entry per annotated line,
  merging the line's annotations (title/comment/stage), documentationTargets
  whose `line` matches, and usage callsites (classUsageBindings + rank
  callsites) whose `line` matches.

No mutation of inputs. Pure function `buildDocumentedModel(run, annotatedModel)`.
Collaborators: `patternDefinitionFor` (data/patternDefinitions), `familyOf`
(logic/docExport), `canonicalPatternName` (logic/patterns).
```

Write `docs/Codebase/Frontend/src/components/analysis/PatternHeader.tsx.md`:

```markdown
# PatternHeader.tsx

Collapsible header rendered at a class declaration line inside the documented
source spine. Props: `data: PatternHeaderData`, `onLineFlash?: (line) => void`.
Default collapsed: shows pattern badge + className + one-liner + AI/Static pill.
Expanded: What is it? / Why it fired / When to use + analogy + watch-out /
Methods to test (clickable rows that flash the line). Pure presentational;
collapse state is local `useState`. Print CSS forces the expanded body via
`@media print`.
```

Write `docs/Codebase/Frontend/src/components/analysis/InlineLineDoc.tsx.md`:

```markdown
# InlineLineDoc.tsx

Inline documentation block rendered beneath an annotated source line. Props:
`data: InlineDocData`, `onLineFlash?: (line) => void`. Shows the annotation
title + comment with an AI/Static tag, the landmark label (from
documentationTargets), and usage line references ("used at L88, L91").
Left border inherits the line's pattern colour via a CSS var. Visible by
default. Interactive chrome is class `.no-print`.
```

Write `docs/Codebase/Frontend/src/components/analysis/DocumentedSource.tsx.md`:

```markdown
# DocumentedSource.tsx

Composition component for the merged Patterns walkthrough. Derives
`buildDocumentedModel(run, annotatedModel)` and renders `SourceView` passing
two render slots: `renderHeaderForLine(lineNo)` → `<PatternHeader>` when the
line is a class declaration with a header entry; `renderDocForLine(lineNo)` →
`<InlineLineDoc>` when the line has a doc entry. Owns the `contentRef` used by
PDF/DOCX export. Forwards all the SourceView colouring/scope props it already
receives in AnnotatedTab. No colour logic of its own.
```

- [ ] **Step 3: Commit**

```bash
git add docs/Codebase/DESIGN_DECISIONS.md docs/Codebase/Frontend/src/logic/documentedModel.ts.md docs/Codebase/Frontend/src/components/analysis/PatternHeader.tsx.md docs/Codebase/Frontend/src/components/analysis/InlineLineDoc.tsx.md docs/Codebase/Frontend/src/components/analysis/DocumentedSource.tsx.md
git commit -m "docs: blueprints + design decision for merged line-by-line walkthrough"
```

---

## Task 2: Add Vitest to the Frontend

**Files:**
- Create: `Codebase/Frontend/vitest.config.ts`
- Modify: `Codebase/Frontend/package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the vitest config**

Create `Codebase/Frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

// Frontend unit tests cover pure logic modules only (no DOM/component
// rendering). Components are exercised by Playwright e2e + visual regression.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    reporters: 'default',
  },
});
```

- [ ] **Step 2: Add the dep + script**

Install vitest in the Frontend workspace (matches Backend's `^1.6.0`):

```bash
npm --prefix Codebase/Frontend install -D vitest@^1.6.0
```

Then confirm `Codebase/Frontend/package.json` `scripts` contains:

```json
"test:unit": "vitest run --reporter=default"
```

Add it via Edit if absent (insert after the `"typecheck"` line in the scripts block).

- [ ] **Step 3: Verify the runner works on an empty suite**

Run: `npm --prefix Codebase/Frontend run test:unit`
Expected: vitest runs, reports "No test files found, exiting with code 0" or passes 0 tests (exit 0). If it errors on config, fix the config path before continuing.

- [ ] **Step 4: Wire the CI step**

In `.github/workflows/ci.yml`, find the existing `Backend unit tests (vitest)` step (around line 114). Add a sibling step immediately after it:

```yaml
      - name: Frontend unit tests (vitest)
        working-directory: Codebase/Frontend
        run: npm run test:unit
```

(Match the existing step's indentation and `working-directory` style; the Backend step uses `npm --prefix` — mirror whichever form the surrounding steps use. If the Backend step uses `run: npm --prefix Codebase/Backend run test:unit` without `working-directory`, use `run: npm --prefix Codebase/Frontend run test:unit` instead and omit `working-directory`.)

- [ ] **Step 5: Commit**

```bash
git add Codebase/Frontend/vitest.config.ts Codebase/Frontend/package.json Codebase/Frontend/package-lock.json .github/workflows/ci.yml
git commit -m "test(frontend): add vitest for pure-logic unit tests + CI step"
```

---

## Task 3: documentedModel types + failing tests

**Files:**
- Create: `Codebase/Frontend/src/logic/documentedModel.ts` (types + stub)
- Create: `Codebase/Frontend/src/logic/__tests__/documentedModel.test.ts`

- [ ] **Step 1: Write the types + a throwing stub**

Create `Codebase/Frontend/src/logic/documentedModel.ts`:

```typescript
import { AnalysisRun, Annotation, DocumentationTarget } from '../types/api';
import { AnnotatedModel } from './annotatedModel';
import { PatternDefinition } from '../data/patternDefinitions';

export interface PatternHeaderData {
  line: number;                 // class declaration line
  patternName: string;
  className: string;
  source: 'ai' | 'static';      // which explanation won
  oneLiner: string;             // AI explanation OR definition.oneLiner
  whyThisFired?: string;        // AI only
  whenToUse?: string;           // static only
  realWorldAnalogy?: string;    // static only
  watchOuts?: string;           // static only
  methodsToTest: Array<{ name: string; line: number; branchKind: string }>;
}

export interface InlineDocData {
  line: number;
  notes: Array<{ title: string; comment: string; source: 'ai' | 'static' }>;
  landmarks: string[];          // documentationTarget labels on this line
  usageLines: number[];         // other lines where this line's class is used
}

export interface DocumentedModel {
  headerByLine: Map<number, PatternHeaderData>;
  docByLine: Map<number, InlineDocData>;
}

export function buildDocumentedModel(
  _run: AnalysisRun | null,
  _annotatedModel: AnnotatedModel,
): DocumentedModel {
  throw new Error('not implemented');
}

// Local helpers referenced by tests are exported for direct coverage.
export function isAiAnn(a: Annotation): boolean {
  return a.stage === 'ai_commentary';
}
export function landmarksForLine(targets: DocumentationTarget[], line: number): string[] {
  return targets.filter(t => t.line === line).map(t => t.label);
}
export type { PatternDefinition };
```

- [ ] **Step 2: Write the failing tests**

Create `Codebase/Frontend/src/logic/__tests__/documentedModel.test.ts`:

```typescript
import { describe, test, expect } from 'vitest';
import { buildDocumentedModel } from '../documentedModel';
import { deriveAnnotatedModel } from '../annotatedModel';
import { AnalysisRun } from '../../types/api';

function makeRun(over: Partial<AnalysisRun> = {}): AnalysisRun {
  return {
    runId: null,
    sourceName: 'demo.cpp',
    sourceText: 'class ShapeFactory {\n  Shape* create(int t);\n};\n',
    detectedPatterns: [],
    annotations: [],
    ranking: null,
    classUsageBindings: {},
    classUsageBindingSource: 'heuristic',
    summary: '',
    ...over,
  };
}

describe('buildDocumentedModel', () => {
  test('returns empty maps for a run with no patterns or annotations', () => {
    // Arrange
    const run = makeRun();
    const annotated = deriveAnnotatedModel({ run });

    // Act
    const model = buildDocumentedModel(run, annotated);

    // Assert
    expect(model.headerByLine.size).toBe(0);
    expect(model.docByLine.size).toBe(0);
  });

  test('emits a header at the class declaration line with the static one-liner', () => {
    // Arrange
    const run = makeRun({
      detectedPatterns: [{
        patternId: 'creational.factory',
        patternName: 'Factory',
        confidence: 1,
        className: 'ShapeFactory',
        documentationTargets: [{ label: 'factory class', line: 1, lexeme: 'class ShapeFactory' }],
        unitTestTargets: [{ function_hash: 'h1', function_name: 'create', branch_kind: 'if', line: 2 }],
      }],
    });
    const annotated = deriveAnnotatedModel({ run });

    // Act
    const model = buildDocumentedModel(run, annotated);
    const header = model.headerByLine.get(1);

    // Assert
    expect(header).toBeDefined();
    expect(header!.patternName).toBe('Factory');
    expect(header!.className).toBe('ShapeFactory');
    expect(header!.source).toBe('static');
    expect(header!.oneLiner.length).toBeGreaterThan(0);
    expect(header!.methodsToTest).toEqual([{ name: 'create', line: 2, branchKind: 'if' }]);
  });

  test('prefers AI education over the static definition', () => {
    // Arrange
    const run = makeRun({
      detectedPatterns: [{
        patternId: 'creational.factory',
        patternName: 'Factory',
        confidence: 1,
        className: 'ShapeFactory',
        documentationTargets: [{ label: 'factory class', line: 1, lexeme: 'class ShapeFactory' }],
        unitTestTargets: [],
        patternEducation: {
          explanation: 'This builds shapes for you.',
          whyThisFired: 'create() returns a base pointer.',
          studyHint: 'Look at create().',
        },
      }],
    });
    const annotated = deriveAnnotatedModel({ run });

    // Act
    const model = buildDocumentedModel(run, annotated);
    const header = model.headerByLine.get(1);

    // Assert
    expect(header!.source).toBe('ai');
    expect(header!.oneLiner).toBe('This builds shapes for you.');
    expect(header!.whyThisFired).toBe('create() returns a base pointer.');
  });

  test('emits an inline doc on an annotated line, folding landmark + usage', () => {
    // Arrange
    const run = makeRun({
      detectedPatterns: [{
        patternId: 'creational.factory',
        patternName: 'Factory',
        confidence: 1,
        className: 'ShapeFactory',
        documentationTargets: [{ label: 'create method', line: 2, lexeme: 'create' }],
        unitTestTargets: [],
      }],
      annotations: [{
        id: 'a1', order: 0, stage: 'static', severity: 'low',
        line: 2, lineEnd: null, title: 'Factory method', comment: 'Picks the concrete type.',
        excerpt: '', kind: 'doc', patternKey: 'Factory', className: 'ShapeFactory',
      }],
      classUsageBindings: {
        ShapeFactory: [{ kind: 'call', line: 8 }, { kind: 'call', line: 9 }],
      },
    });
    const annotated = deriveAnnotatedModel({ run });

    // Act
    const model = buildDocumentedModel(run, annotated);
    const doc = model.docByLine.get(2);

    // Assert
    expect(doc).toBeDefined();
    expect(doc!.notes[0]).toEqual({ title: 'Factory method', comment: 'Picks the concrete type.', source: 'static' });
    expect(doc!.landmarks).toContain('create method');
    expect(doc!.usageLines).toEqual([8, 9]);
  });

  test('marks an AI annotation note with source "ai"', () => {
    // Arrange
    const run = makeRun({
      annotations: [{
        id: 'a2', order: 0, stage: 'ai_commentary', severity: 'low',
        line: 2, lineEnd: null, title: 'Note', comment: 'AI note.',
        excerpt: '', kind: 'doc', patternKey: 'Factory', className: 'ShapeFactory',
      }],
    });
    const annotated = deriveAnnotatedModel({ run });

    // Act
    const model = buildDocumentedModel(run, annotated);

    // Assert
    expect(model.docByLine.get(2)!.notes[0].source).toBe('ai');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm --prefix Codebase/Frontend run test:unit`
Expected: FAIL — all `buildDocumentedModel` tests throw "not implemented" (the empty-run test also throws, since the stub throws unconditionally).

- [ ] **Step 4: Commit the failing tests**

```bash
git add Codebase/Frontend/src/logic/documentedModel.ts Codebase/Frontend/src/logic/__tests__/documentedModel.test.ts
git commit -m "test(frontend): failing tests for documentedModel mapping"
```

---

## Task 4: Implement documentedModel

**Files:**
- Modify: `Codebase/Frontend/src/logic/documentedModel.ts`

- [ ] **Step 1: Implement `buildDocumentedModel`**

Replace the `buildDocumentedModel` stub body in `Codebase/Frontend/src/logic/documentedModel.ts` with:

```typescript
import { patternDefinitionFor } from '../data/patternDefinitions';

export function buildDocumentedModel(
  run: AnalysisRun | null,
  annotatedModel: AnnotatedModel,
): DocumentedModel {
  const headerByLine = new Map<number, PatternHeaderData>();
  const docByLine = new Map<number, InlineDocData>();
  if (!run) return { headerByLine, docByLine };

  // Only patterns surviving cascade earn a header (matches the source spine).
  const patterns = annotatedModel.activePatterns.length
    ? annotatedModel.activePatterns
    : run.detectedPatterns;

  // ── Headers: one per class declaration line ──────────────────────────────
  for (const p of patterns) {
    if (!p.className) continue;
    const loc = annotatedModel.classLocations.get(p.className);
    const declLine = loc?.line
      ?? (p.documentationTargets || [])
          .map(t => t.line)
          .filter((l): l is number => typeof l === 'number')
          .sort((a, b) => a - b)[0];
    if (typeof declLine !== 'number') continue;
    if (headerByLine.has(declLine)) continue; // first pattern wins the line

    const edu = p.patternEducation;
    const def = patternDefinitionFor(p.patternName);
    const source: 'ai' | 'static' = edu ? 'ai' : 'static';
    const oneLiner = edu ? edu.explanation : (def?.oneLiner ?? '');

    headerByLine.set(declLine, {
      line: declLine,
      patternName: p.patternName,
      className: p.className,
      source,
      oneLiner,
      whyThisFired: edu?.whyThisFired,
      whenToUse: edu ? undefined : def?.whenToUse,
      realWorldAnalogy: edu ? undefined : def?.realWorldAnalogy,
      watchOuts: edu ? undefined : def?.watchOuts,
      methodsToTest: (p.unitTestTargets || []).map(t => ({
        name: t.function_name,
        line: t.line,
        branchKind: t.branch_kind,
      })),
    });
  }

  // ── Inline docs: one per annotated line ──────────────────────────────────
  // Build a per-line landmark index from every pattern's documentationTargets.
  const landmarkByLine = new Map<number, string[]>();
  for (const p of patterns) {
    for (const t of p.documentationTargets || []) {
      if (typeof t.line !== 'number') continue;
      const list = landmarkByLine.get(t.line) ?? [];
      if (!list.includes(t.label)) list.push(t.label);
      landmarkByLine.set(t.line, list);
    }
  }

  // Usage lines per class (where the class is referenced elsewhere).
  const usageByClass = new Map<string, number[]>();
  for (const [cls, list] of Object.entries(run.classUsageBindings || {})) {
    const lines = (list || [])
      .map(b => b.line)
      .filter((l): l is number => typeof l === 'number');
    if (lines.length) usageByClass.set(cls, lines);
  }

  for (const a of run.annotations || []) {
    if (typeof a.line !== 'number') continue;
    const line = a.line;
    const entry = docByLine.get(line) ?? {
      line,
      notes: [],
      landmarks: landmarkByLine.get(line) ?? [],
      usageLines: a.className ? (usageByClass.get(a.className) ?? []) : [],
    };
    entry.notes.push({
      title: a.title,
      comment: a.comment,
      source: isAiAnn(a) ? 'ai' : 'static',
    });
    docByLine.set(line, entry);
  }

  // Lines that have a landmark but no annotation still deserve an inline doc.
  for (const [line, landmarks] of landmarkByLine) {
    if (docByLine.has(line)) continue;
    docByLine.set(line, { line, notes: [], landmarks, usageLines: [] });
  }

  return { headerByLine, docByLine };
}
```

Remove the now-unused `_run`/`_annotatedModel` stub signature and the
`throw new Error('not implemented')`. Move the `patternDefinitionFor` import to
the top import block with the others (do not leave a mid-file import).

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm --prefix Codebase/Frontend run test:unit`
Expected: PASS — all 5 tests green.

- [ ] **Step 3: Typecheck**

Run: `npm --prefix Codebase/Frontend run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add Codebase/Frontend/src/logic/documentedModel.ts
git commit -m "feat(frontend): implement documentedModel line mapping"
```

---

## Task 5: PatternHeader component

**Files:**
- Create: `Codebase/Frontend/src/components/analysis/PatternHeader.tsx`

- [ ] **Step 1: Write the component**

Create `Codebase/Frontend/src/components/analysis/PatternHeader.tsx`:

```tsx
import { useState } from 'react';
import { PatternHeaderData } from '../../logic/documentedModel';
import { colorFor, ensureReadableContrast } from '../../logic/patterns';

interface PatternHeaderProps {
  data: PatternHeaderData;
  onLineFlash?: (line: number) => void;
}

// Collapsible per-class header. Default collapsed: badge + class + one-liner +
// AI/Static pill. Expanded body carries the full pattern teaching. Print CSS
// (`@media print`) forces the body open so exports are complete.
export default function PatternHeader({ data, onLineFlash }: PatternHeaderProps) {
  const [open, setOpen] = useState(false);
  const base = colorFor(data.patternName);
  const text = ensureReadableContrast(base.text, 4.5);

  return (
    <div className={`pattern-header ${open ? 'pattern-header--open' : ''}`} data-pattern={data.patternName}>
      <button
        type="button"
        className="pattern-header__toggle no-print"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="pattern-header__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span
          className="pattern-header__badge"
          style={{ borderColor: base.border, background: base.bg, color: text }}
        >
          {data.patternName}
        </span>
        <code className="pattern-header__class">{data.className}</code>
        <span className="pattern-header__oneliner">{data.oneLiner}</span>
        <span className={`pattern-header__pill pattern-header__pill--${data.source}`}>
          {data.source === 'ai' ? 'AI explanation' : 'Built-in guide'}
        </span>
      </button>

      <div className="pattern-header__body">
        <p><span className="pattern-header__label">What is it?</span> {data.oneLiner}</p>
        {data.whyThisFired && (
          <p><span className="pattern-header__label">Why it fired:</span> {data.whyThisFired}</p>
        )}
        {data.whenToUse && (
          <p><span className="pattern-header__label">When to use:</span> {data.whenToUse}</p>
        )}
        {data.realWorldAnalogy && (
          <p><span className="pattern-header__label">Analogy:</span> {data.realWorldAnalogy}</p>
        )}
        {data.watchOuts && (
          <p className="pattern-header__watchout"><span className="pattern-header__label">Watch out:</span> {data.watchOuts}</p>
        )}
        {data.methodsToTest.length > 0 && (
          <div className="pattern-header__methods">
            <span className="pattern-header__label">Methods to test:</span>
            <ul className="pattern-header__method-list">
              {data.methodsToTest.map((m, i) => (
                <li key={i}>
                  <button type="button" className="pattern-header__method no-print" onClick={() => onLineFlash?.(m.line)}>
                    <code>{m.name}</code>
                    <span className="pattern-header__method-kind">{m.branchKind}</span>
                    <span className="pattern-header__method-line">L{m.line}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm --prefix Codebase/Frontend run typecheck`
Expected: no errors (the component is not yet imported anywhere; that is fine — `tsc --noEmit` still validates it).

- [ ] **Step 3: Commit**

```bash
git add Codebase/Frontend/src/components/analysis/PatternHeader.tsx
git commit -m "feat(frontend): add collapsible PatternHeader component"
```

---

## Task 6: InlineLineDoc component

**Files:**
- Create: `Codebase/Frontend/src/components/analysis/InlineLineDoc.tsx`

- [ ] **Step 1: Write the component**

Create `Codebase/Frontend/src/components/analysis/InlineLineDoc.tsx`:

```tsx
import { InlineDocData } from '../../logic/documentedModel';

interface InlineLineDocProps {
  data: InlineDocData;
  onLineFlash?: (line: number) => void;
}

// Inline doc block rendered beneath an annotated source line. Folds the line's
// annotation notes, landmark labels, and usage line references into one block.
// The left border colour is inherited from the parent line via the CSS var
// `--ann-border` set on the source line, so no colour prop is needed here.
export default function InlineLineDoc({ data, onLineFlash }: InlineLineDocProps) {
  const hasContent = data.notes.length > 0 || data.landmarks.length > 0 || data.usageLines.length > 0;
  if (!hasContent) return null;

  return (
    <div className="inline-line-doc" data-line={data.line}>
      {data.notes.map((n, i) => (
        <p key={i} className="inline-line-doc__note">
          <span className="inline-line-doc__title">{n.title}</span>
          {n.comment && <span className="inline-line-doc__comment"> — {n.comment}</span>}
          <span className={`inline-line-doc__tag inline-line-doc__tag--${n.source}`}>
            {n.source === 'ai' ? 'AI' : 'Static'}
          </span>
        </p>
      ))}
      <div className="inline-line-doc__meta">
        {data.landmarks.length > 0 && (
          <span className="inline-line-doc__landmark">landmark: {data.landmarks.join(', ')}</span>
        )}
        {data.usageLines.length > 0 && (
          <span className="inline-line-doc__usage no-print">
            used at {data.usageLines.map((l, i) => (
              <button key={i} type="button" className="inline-line-doc__usage-ref" onClick={() => onLineFlash?.(l)}>
                L{l}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm --prefix Codebase/Frontend run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add Codebase/Frontend/src/components/analysis/InlineLineDoc.tsx
git commit -m "feat(frontend): add InlineLineDoc component"
```

---

## Task 7: Add render-slot props to SourceView

**Files:**
- Modify: `Codebase/Frontend/src/components/analysis/SourceView.tsx`

- [ ] **Step 1: Extend the props interface**

In `SourceView.tsx`, add two optional render slots to `SourceViewProps` (after the `onLineClick` line, before the closing brace of the interface):

```typescript
  // Render slots for the merged walkthrough. Returning null renders nothing.
  // renderHeaderForLine fires for every line BEFORE the line itself, so a
  // class-declaration header sits above its declaration line. renderDocForLine
  // fires AFTER the line, so inline docs sit beneath the code.
  renderHeaderForLine?: (lineNo: number) => React.ReactNode;
  renderDocForLine?: (lineNo: number) => React.ReactNode;
```

- [ ] **Step 2: Destructure and render the slots**

In the `SourceView` function signature, add `renderHeaderForLine, renderDocForLine` to the destructured props list (alongside `onLineClick`).

Then, in the `rows.map(row => { ... })` return, wrap the existing `<span className={classNames} ...>` line element so headers/docs render around it. Replace the single returned `<span key={row.lineNo} ...>...</span>` with:

```tsx
          const header = renderHeaderForLine?.(row.lineNo);
          const doc = renderDocForLine?.(row.lineNo);
          return (
            <React.Fragment key={row.lineNo}>
              {header}
              <span
                className={classNames}
                data-line={row.lineNo}
                data-class-name={row.isScopeStart ? row.scope?.className : undefined}
                style={style}
                onClick={(ev) => handleLineClick(row, ev)}
              >
                <span className="src-gutter">{num}</span>
                <span className="src-code">{row.text || '​'}</span>
                {hasAnnotation && isAmbiguousLine && (
                  <span className="src-line-badge" aria-hidden="true">
                    {`${distinctPatternCount}×`}
                  </span>
                )}
              </span>
              {doc}
            </React.Fragment>
          );
```

(`React` is already imported at the top of the file. Remove the old `key={row.lineNo}` from the inner span since the Fragment now carries the key.)

- [ ] **Step 3: Narrow the popover trigger to disambiguation**

In `handleLineClick`, the current guard opens the popover when there are annotations OR a stale override. Narrow it so the popover only opens for lines that actually need a decision (ambiguous lines or an existing override to undo). Replace the block:

```typescript
    const hasOverride = !!linePatternOverrides[row.lineNo];
    if (!row.rawAnns.length && !hasOverride) return;
```

with:

```typescript
    // Docs now render inline; the popover is the disambiguation picker only.
    // Open it when the user can act: the line (or its class-decl scope) is
    // ambiguous, or there is an existing override to undo.
    const hasOverride = !!linePatternOverrides[row.lineNo];
    const distinct = new Set(
      row.rawAnns
        .map(a => patternFromAnnotation(a))
        .filter(isRealPattern)
        .map(canonicalPatternName)
    ).size;
    const scopeUnion = row.isScopeStart && row.scope
      ? (inScopePatternsByClass?.get(row.scope.className)?.size ?? 0)
      : 0;
    const lineNeedsPick = distinct > 1 || scopeUnion > 1;
    if (!lineNeedsPick && !hasOverride) return;
```

(`patternFromAnnotation`, `isRealPattern`, `canonicalPatternName` are already imported at the top of `SourceView.tsx`.)

- [ ] **Step 4: Typecheck**

Run: `npm --prefix Codebase/Frontend run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add Codebase/Frontend/src/components/analysis/SourceView.tsx
git commit -m "feat(frontend): SourceView render slots + popover narrowed to picker"
```

---

## Task 8: Narrow LinePopover to the picker

**Files:**
- Modify: `Codebase/Frontend/src/components/analysis/LinePopover.tsx`

- [ ] **Step 1: Remove the annotation-card body**

In `LinePopover.tsx`, delete the `AnnotationCard` component definition (the `interface CardProps` + `function AnnotationCard(...)` block, lines ~27–65) and remove the body that renders it. Replace the `<div className="src-popover-body">...</div>` block near the end with nothing (delete it). The popover now shows only the close button + the resolved/undo badge or the rivals picker.

After the edit, the returned JSX inside `createPortal` should be:

```tsx
    <div
      ref={popoverRef}
      id="src-popover"
      className="src-popover src-popover--pinned"
      role="dialog"
      aria-label={`Disambiguation for line ${line}`}
    >
      <button
        className="src-popover-close"
        type="button"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
      {resolvedPattern ? (
        <div className="src-popover-ambiguous-badge src-popover-ambiguous-badge--resolved">
          {(() => { const c = colorFor(resolvedPattern); return (
            <span className="src-popover-rival" style={{ borderColor: c.border, color: c.text, background: c.bg }}>
              {resolvedPattern}
            </span>
          ); })()}
          {onUnresolve && (
            <button type="button" className="src-popover-undo-btn" onClick={() => onUnresolve(line)}>
              Undo
            </button>
          )}
        </div>
      ) : ambiguous && (
        <div className="src-popover-ambiguous-badge">
          {distinctPatterns.length} possible patterns at this line — pick the one that matches:
          <div className="src-popover-rivals">
            {distinctPatterns.map(p => (
              <RivalChip
                key={p}
                patternKey={p}
                onClick={onResolve ? () => onResolve(line, p) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
```

- [ ] **Step 2: Drop the now-unused dedupe/annotation logic**

Remove `dedupedAnnotations` and the `AnnotationCard`-only imports if they become unused. Keep `linePatterns`, `distinctPatterns`, `ambiguous`, `patternFromAnnotation`, `canonicalPatternName`, `isRealPattern`, `colorFor` — they still drive the picker. Note `linePatterns` derives from `annotations` directly now (not `dedupedAnnotations`); change its loop source from `dedupedAnnotations` to `annotations`. The early return `if (!annotations.length && !resolvedPattern) return null;` stays.

- [ ] **Step 3: Typecheck**

Run: `npm --prefix Codebase/Frontend run typecheck`
Expected: no errors (no unused-variable errors; remove any that appear).

- [ ] **Step 4: Commit**

```bash
git add Codebase/Frontend/src/components/analysis/LinePopover.tsx
git commit -m "refactor(frontend): narrow LinePopover to disambiguation picker"
```

---

## Task 9: DocumentedSource composition component

**Files:**
- Create: `Codebase/Frontend/src/components/analysis/DocumentedSource.tsx`

- [ ] **Step 1: Write the component**

Create `Codebase/Frontend/src/components/analysis/DocumentedSource.tsx`:

```tsx
import { useMemo, forwardRef } from 'react';
import SourceView from './SourceView';
import PatternHeader from './PatternHeader';
import InlineLineDoc from './InlineLineDoc';
import { buildDocumentedModel } from '../../logic/documentedModel';
import { AnnotatedModel } from '../../logic/annotatedModel';
import { AnalysisRun, Annotation, DetectedPatternFull, ClassUsageBinding } from '../../types/api';

interface DocumentedSourceProps {
  run: AnalysisRun;
  annotatedModel: AnnotatedModel;
  sourceText: string;
  annotations: Annotation[];
  detectedPatterns: DetectedPatternFull[];
  classResolvedPatterns?: Record<string, string>;
  classUsageBindings?: Record<string, ClassUsageBinding[]>;
  inScopePatternsByClass?: Map<string, Set<string>>;
  coloringAmbiguousClassNames?: Set<string>;
  subclassPendingClassNames?: Set<string>;
  subclassDroppedClassNames?: Set<string>;
  usageLinesByAmbiguousClass?: Map<number, string>;
  onLineClick?: (commentId: string) => void;
  onLineFlash?: (line: number) => void;
}

// Composition layer for the merged walkthrough. Owns the documentedModel
// derivation and the export contentRef (forwarded). Renders SourceView with
// header/doc render slots; no colour logic of its own.
const DocumentedSource = forwardRef<HTMLDivElement, DocumentedSourceProps>(function DocumentedSource(
  props, ref,
) {
  const { run, annotatedModel, onLineFlash, ...sourceProps } = props;
  const docModel = useMemo(
    () => buildDocumentedModel(run, annotatedModel),
    [run, annotatedModel],
  );

  return (
    <div ref={ref} className="documented-source" data-testid="documented-source">
      <SourceView
        {...sourceProps}
        renderHeaderForLine={(lineNo) => {
          const h = docModel.headerByLine.get(lineNo);
          return h ? <PatternHeader data={h} onLineFlash={onLineFlash} /> : null;
        }}
        renderDocForLine={(lineNo) => {
          const d = docModel.docByLine.get(lineNo);
          return d ? <InlineLineDoc data={d} onLineFlash={onLineFlash} /> : null;
        }}
      />
    </div>
  );
});

export default DocumentedSource;
```

- [ ] **Step 2: Typecheck**

Run: `npm --prefix Codebase/Frontend run typecheck`
Expected: no errors. (If `SourceView`'s prop spread complains about the extra `run`/`annotatedModel`, confirm they are excluded via the destructure rest `...sourceProps` — they are.)

- [ ] **Step 3: Commit**

```bash
git add Codebase/Frontend/src/components/analysis/DocumentedSource.tsx
git commit -m "feat(frontend): add DocumentedSource composition component"
```

---

## Task 10: Wire DocumentedSource into AnnotatedTab; remove toggle + sidebar

**Files:**
- Modify: `Codebase/Frontend/src/components/tabs/AnnotatedTab.tsx`

- [ ] **Step 1: Swap imports**

In `AnnotatedTab.tsx`, remove these imports:

```typescript
import DocumentationTab from './DocumentationTab';
import SourceView from '../analysis/SourceView';
import PatternLegend from '../analysis/PatternLegend';
import PatternCards from '../analysis/PatternCards';
import ClassBindings from '../analysis/ClassBindings';
import ClassTreeView from '../analysis/ClassTreeView';
```

Replace with:

```typescript
import { useRef } from 'react';
import DocumentedSource from '../analysis/DocumentedSource';
import PatternLegend from '../analysis/PatternLegend';
import { downloadMarkdown, downloadDocx, triggerPdfPrint } from '../../logic/docExport';
```

(Keep `PatternLegend`; it stays in the header. Merge `useRef` into the existing `react` import at the top instead of duplicating — the file already imports `useMemo, useState` from react; add `useRef` there.)

- [ ] **Step 2: Remove the view-toggle state and handlers**

Delete the line:

```typescript
  const [view, setView] = useState<'annotated' | 'docs'>('annotated');
```

Delete the `handlePickClass` function ONLY IF it is no longer referenced after removing `ClassTreeView` (it is passed to `ClassTreeView` via `onPickClass`). Search the file for `handlePickClass`; it is used only by `ClassTreeView`, so delete the function. The picker flow is preserved through `SourceView`'s `LinePopover` (`handleResolve`), which is independent.

Add an export contentRef near the other hooks:

```typescript
  const exportRef = useRef<HTMLDivElement>(null);

  function handleDocx() {
    if (currentRun && exportRef.current) downloadDocx(currentRun, exportRef.current.innerHTML);
  }
```

- [ ] **Step 3: Replace the toggle + body JSX**

Find the `return (` block. Remove the entire `studio-subview-toggle` `<div role="tablist">...</div>` and the `{view === 'docs' && <DocumentationTab />}` line and the `{view === 'annotated' && ( <> ... </> )}` wrapper — but KEEP the inner content of the annotated branch. Concretely, the new top of the returned JSX is:

```tsx
  return (
    <div className="tab-annotated-shell">
      <section className="tab-panel tab-annotated">
        <header className="results-header">
          <p className="results-summary">{summaryText}</p>
          {aiStatus === 'pending' && (
            <span className="ai-pill ai-pill-pending" aria-live="polite">
              AI commentary loading…
            </span>
          )}
          {aiStatus === 'failed' && (
            <span className="ai-pill ai-pill-failed">AI commentary failed</span>
          )}
          <PatternLegend legendPatterns={model.legendPatterns} />
          <div className="docs-download-group no-print">
            <button className="ghost-btn docs-dl-btn" onClick={() => currentRun && downloadMarkdown(currentRun)}>MD</button>
            <button className="ghost-btn docs-dl-btn" onClick={() => triggerPdfPrint(exportRef.current)}>PDF</button>
            <button className="ghost-btn docs-dl-btn" onClick={handleDocx}>DOCX</button>
          </div>
        </header>
```

The `tag-progress` row and `file-tab-bar` blocks stay exactly as they are.

- [ ] **Step 4: Replace the results-body + sidebar**

Replace the `<div className="results-body"><SourceView ... /></div>` block AND the entire `<aside className="results-sidebar">...</aside>` block with a single documented source mount:

```tsx
        <div className="results-body">
          <DocumentedSource
            ref={exportRef}
            run={currentRun}
            annotatedModel={model}
            sourceText={activeFile?.sourceText || currentRun.sourceText || ''}
            annotations={allAnnotations}
            detectedPatterns={model.activePatterns}
            classResolvedPatterns={currentRun.classResolvedPatterns}
            classUsageBindings={currentRun.classUsageBindings}
            inScopePatternsByClass={model.inScopePatterns}
            coloringAmbiguousClassNames={model.greyClassNames}
            subclassPendingClassNames={model.subclassPendingClassNames}
            subclassDroppedClassNames={model.droppedClassNames}
            usageLinesByAmbiguousClass={usageLinesByAmbiguousClass}
            onLineClick={onCommentFlash}
            onLineFlash={onLineFlash}
          />
        </div>
      </section>
```

Keep the `{classNav.length >= 1 && navClass && ( ... )}` corner-button block (the ←/→ navigator) — it remains the class navigator. Close the `tab-annotated-shell` div after it. Remove the now-orphaned `</>` and `)}` that closed the old `view === 'annotated'` fragment.

- [ ] **Step 5: Typecheck**

Run: `npm --prefix Codebase/Frontend run typecheck`
Expected: no errors. Common fixes: remove any now-unused locals flagged by tsc (e.g. `handlePickClass`, `classTree`, `buildClassTree` import if `ClassTreeView` was its only consumer). If `classTree`/`buildClassTree` are unused, delete the `classTree` `useMemo` and the `buildClassTree` import.

- [ ] **Step 6: Build the frontend to confirm it bundles**

Run: `npm --prefix Codebase/Frontend run build`
Expected: tsc passes, vite build succeeds.

- [ ] **Step 7: Commit**

```bash
git add Codebase/Frontend/src/components/tabs/AnnotatedTab.tsx
git commit -m "feat(frontend): merge Patterns tab into single DocumentedSource spine"
```

---

## Task 11: Re-author Markdown export + print CSS

**Files:**
- Modify: `Codebase/Frontend/src/logic/docExport.ts`
- Modify: the Studio stylesheet that owns `.src-line` / `.docs-*` (find it in Step 3)

- [ ] **Step 1: Rewrite `generateMarkdown` to a line walkthrough**

In `docExport.ts`, replace the body of `generateMarkdown` so it emits, per pattern: the header bullets, then a fenced code block of the class scope lines with inline `// ←` notes. Replace the whole `for (const p of patterns)` inner loop with this (keep the surrounding family loop, the title header, and the helpers unchanged):

```typescript
    for (const p of patterns) {
      const classPart = p.className ? ` — \`${p.className}\`` : '';
      lines.push(`### ${p.patternName}${classPart}`);
      lines.push('');

      const edu = p.patternEducation;
      const def = patternDefinitionFor(p.patternName);
      if (edu) {
        lines.push(`**What is it?** ${edu.explanation}`);
        lines.push('');
        lines.push(`*Why it fired*: ${edu.whyThisFired}`);
        lines.push(`*Study hint*: ${edu.studyHint}`);
        lines.push('');
      } else if (def) {
        lines.push(`**What is it?** ${def.oneLiner}`);
        lines.push('');
        lines.push(`**When to use**: ${def.whenToUse}`);
        if (def.realWorldAnalogy) lines.push(`**Analogy**: ${def.realWorldAnalogy}`);
        if (def.watchOuts)        lines.push(`**Watch out**: ${def.watchOuts}`);
        lines.push('');
      }

      // Line-by-line: per-line annotation notes (the inline docs, serialized).
      const { static: stAnns, ai: aiAnns } = annotationsForPattern(run.annotations, p);
      const allAnns = [...stAnns, ...aiAnns].filter(a => typeof a.line === 'number');
      if (allAnns.length > 0) {
        lines.push('#### Line-by-line');
        lines.push('');
        for (const a of allAnns) {
          const tag = isAiAnnotation(a) ? 'AI' : 'Static';
          lines.push(`- **L${a.line}** [${tag}] **${a.title}**: ${a.comment}`);
        }
        lines.push('');
      }

      if (p.unitTestTargets.length > 0) {
        lines.push('#### Methods to test');
        lines.push('');
        for (const t of p.unitTestTargets) {
          lines.push(`- [ ] \`${t.function_name}\` (L${t.line}) — *${t.branch_kind}*`);
        }
        lines.push('');
      }

      if (p.documentationTargets.length > 0) {
        lines.push('#### Key landmarks');
        lines.push('');
        for (const t of p.documentationTargets) {
          lines.push(`- **${t.label}** (L${t.line}): \`${t.lexeme}\``);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
```

At the top of `generateMarkdown`, change the iteration source so it reads
`run.detectedPatterns` grouped exactly as today (no change needed there — the
`groups`/`FAMILY_ORDER` loop already supplies `patterns`). Confirm `patterns`
is the loop variable inside the family loop; the snippet above replaces the
inner `for (const p of patterns)` body verbatim.

- [ ] **Step 2: Update the title string**

The Markdown H1 currently reads `# CodiNeo Code Documentation`. Change it to
`# CodiNeo Pattern Walkthrough` so the exported title matches the merged surface.

- [ ] **Step 3: Add print CSS for the new classes**

Find the stylesheet that defines `.src-line` and `.docs-pattern` (run
`grep -rl "\.src-line" Codebase/Frontend/src --include=*.css`). In that file
(or the Studio results stylesheet), append:

```css
/* Merged walkthrough — on-screen */
.pattern-header { margin: 0.75rem 0 0.25rem; }
.pattern-header__body { display: none; padding: 0.5rem 0 0.5rem 1.5rem; }
.pattern-header--open .pattern-header__body { display: block; }
.pattern-header__toggle { display: flex; gap: 0.5rem; align-items: center; width: 100%; background: none; border: none; cursor: pointer; text-align: left; }
.pattern-header__badge { border: 1px solid; border-radius: 999px; padding: 0 0.5rem; font-size: 0.8rem; }
.inline-line-doc { margin: 0 0 0.4rem 2rem; padding: 0.25rem 0.5rem; border-left: 3px solid var(--ann-border, #d1d5db); font-size: 0.85rem; }
.inline-line-doc__tag { margin-left: 0.4rem; font-size: 0.7rem; opacity: 0.7; }
.inline-line-doc__usage-ref { background: none; border: none; cursor: pointer; color: inherit; text-decoration: underline; padding: 0 0.2rem; }

/* Export: never print interactive chrome; always expand headers */
@media print {
  .no-print { display: none !important; }
  .pattern-header__body { display: block !important; }
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npm --prefix Codebase/Frontend run typecheck && npm --prefix Codebase/Frontend run build`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add Codebase/Frontend/src/logic/docExport.ts Codebase/Frontend/src/
git commit -m "feat(frontend): serialize merged walkthrough to MD + print CSS"
```

---

## Task 12: Remove dead components + their docs; verify e2e surface

**Files:**
- Delete: `Codebase/Frontend/src/components/tabs/DocumentationTab.tsx`
- Delete: `Codebase/Frontend/src/components/analysis/PatternCards.tsx`
- Delete: `Codebase/Frontend/src/components/analysis/ClassBindings.tsx`
- Delete: `Codebase/Frontend/src/components/analysis/ClassTreeView.tsx`
- Delete: their mirrored `docs/Codebase/...md` blueprints
- Modify: `tests/routes.manifest.json` (verify only)

- [ ] **Step 1: Confirm nothing imports the dead components**

Run: `grep -rn "DocumentationTab\|PatternCards\|ClassBindings\|ClassTreeView" Codebase/Frontend/src --include=*.ts --include=*.tsx`
Expected: zero matches outside the files about to be deleted. If `ClassTreeView` is imported by anything other than `AnnotatedTab` (already edited), stop and resolve that import first.

- [ ] **Step 2: Delete the component files**

```bash
git rm Codebase/Frontend/src/components/tabs/DocumentationTab.tsx \
       Codebase/Frontend/src/components/analysis/PatternCards.tsx \
       Codebase/Frontend/src/components/analysis/ClassBindings.tsx \
       Codebase/Frontend/src/components/analysis/ClassTreeView.tsx
```

- [ ] **Step 3: Delete the mirrored docs**

Find and remove the blueprints (paths mirror the code):

```bash
git rm docs/Codebase/Frontend/src/components/tabs/DocumentationTab.tsx.md \
       docs/Codebase/Frontend/src/components/analysis/PatternCards.tsx.md \
       docs/Codebase/Frontend/src/components/analysis/ClassBindings.tsx.md \
       docs/Codebase/Frontend/src/components/analysis/ClassTreeView.tsx.md
```

(If any of these doc paths do not exist, skip that path — run `ls docs/Codebase/Frontend/src/components/analysis/` first to confirm exact names.)

- [ ] **Step 4: Verify the routes manifest anchor still resolves**

Open `tests/routes.manifest.json`. The `studio-landing` row pins
`[data-testid="studio-shell"]`, which is unaffected by this change. No row edit
is required. Confirm no row references `subview-docs`, `subview-annotated`,
`pattern-cards`, or any deleted testid:

Run: `grep -n "subview\|pattern-cards\|class-strip\|documented" tests/routes.manifest.json`
Expected: no stale references. (The new `documented-source` testid does not need a manifest row — it lives inside the already-covered `studio-shell`.)

- [ ] **Step 5: Typecheck + build**

Run: `npm --prefix Codebase/Frontend run typecheck && npm --prefix Codebase/Frontend run build`
Expected: both pass with no unresolved imports.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(frontend): remove DocumentationTab/PatternCards/ClassBindings/ClassTreeView + docs"
```

---

## Task 13: Playwright behavior + visual regression; final verification

**Files:**
- Modify/Create: `Codebase/Frontend/playwright/tests/documented-source.spec.ts`

- [ ] **Step 1: Check existing specs for stale selectors**

Run: `grep -rn "subview-docs\|subview-annotated\|pattern-card\|class-strip\|results-sidebar" Codebase/Frontend/playwright/`
Expected: zero matches (the merge removed these). If any spec references them, update that assertion to target `[data-testid="documented-source"]`.

- [ ] **Step 2: Add a behavioral spec for the merged surface**

Create `Codebase/Frontend/playwright/tests/documented-source.spec.ts`. Use the same fixture/run-trigger pattern as `Codebase/Frontend/playwright/tests/all-samples.spec.ts` (open it first and copy how it loads a sample + runs analysis — reuse that helper rather than inventing a new flow):

```typescript
import { test, expect } from '@playwright/test';
// Reuse the sample-run helper from all-samples.spec.ts. If that file exports
// a helper, import it; otherwise replicate its goto + run-analysis steps here.

test.describe('merged documented source', () => {
  test('renders the documented source spine after analysis', async ({ page }) => {
    await page.goto('/');
    // ... trigger an analysis using the same steps as all-samples.spec.ts ...
    await expect(page.locator('[data-testid="documented-source"]')).toBeVisible();
  });

  test('pattern headers start collapsed; expand on click', async ({ page }) => {
    await page.goto('/');
    // ... trigger an analysis ...
    const header = page.locator('.pattern-header').first();
    await expect(header).not.toHaveClass(/pattern-header--open/);
    await header.locator('.pattern-header__toggle').click();
    await expect(header).toHaveClass(/pattern-header--open/);
  });

  test('inline line docs are visible by default', async ({ page }) => {
    await page.goto('/');
    // ... trigger an analysis on a sample known to produce annotations ...
    await expect(page.locator('.inline-line-doc').first()).toBeVisible();
  });
});
```

Fill the `// ...` steps by copying the analysis-trigger sequence verbatim from `all-samples.spec.ts` (Step 1 told you to read it). Do not invent new selectors for the trigger flow.

- [ ] **Step 3: Run the new spec**

Run: `npm --prefix Codebase/Frontend run test:e2e -- documented-source.spec.ts`
Expected: PASS. (Requires the stack running per the project's e2e setup; if the harness needs the server, follow `all-samples.spec.ts`'s assumptions.)

- [ ] **Step 4: Refresh visual-regression screenshots**

The merged surface changes the Studio results view. Regenerate the screenshot baselines:

Run: `npm --prefix Codebase/Frontend run test:e2e:screenshots`
Review the diffs to confirm the single-column spine renders at the captured breakpoints. Commit the updated baselines.

- [ ] **Step 5: Full typecheck, build, and unit tests**

Run:
```bash
npm --prefix Codebase/Frontend run typecheck
npm --prefix Codebase/Frontend run build
npm --prefix Codebase/Frontend run test:unit
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add Codebase/Frontend/playwright/ Codebase/Frontend/**/__screenshots__/ 2>/dev/null || git add -A
git commit -m "test(e2e): cover merged documented source + refresh screenshots"
```

- [ ] **Step 7: Propose the rebuild**

Per CLAUDE.md, the default post-change proposal is the full local rebuild. State to the user: "Frontend merge complete. Proposed rebuild: `./scripts/rebuild.sh` (micro+docker)." Run it only after confirmation per the project's rebuild rule, then verify `/api/health` and load `/` to eyeball the merged Patterns tab.

---

## Self-Review

**Spec coverage:**
- Merge into one view (no toggle) → Task 10 ✓
- Inline-under-line docs → Tasks 6, 7, 9 ✓
- Keep all content, dedupe, fold line-anchored into inline → Tasks 3–4 (declutter map realized in documentedModel) ✓
- Remove sidebar (ClassTree + ClassBindings) → Tasks 10, 12 ✓
- Default: headers collapsed, docs shown → Task 5 (PatternHeader `useState(false)`) + Task 6 (InlineLineDoc renders unconditionally) ✓
- LinePopover narrowed to picker → Task 8 ✓
- Export serializes merged walkthrough; nothing hidden → Task 11 (print CSS forces headers open; `.no-print` strips chrome) ✓
- Vitest infra → Task 2 ✓
- docs/Codebase mirror + DESIGN_DECISIONS → Tasks 1, 12 ✓
- Routes manifest + CI sync → Tasks 2 (CI vitest), 12 (manifest verify), 13 (playwright) ✓
- Visual regression both themes/breakpoints → Task 13 ✓

**Placeholder scan:** The only intentional `// ...` placeholders are in the Playwright spec (Task 13), where the surrounding steps explicitly instruct copying the verbatim analysis-trigger flow from `all-samples.spec.ts` — that file is the source of truth and must be read at execution time rather than guessed.

**Type consistency:** `PatternHeaderData` / `InlineDocData` field names defined in Task 3 are used identically in Tasks 5, 6, 9. `buildDocumentedModel(run, annotatedModel)` signature consistent across Tasks 3, 4, 9. `renderHeaderForLine` / `renderDocForLine` slot names consistent across Tasks 7, 9. `data-testid="documented-source"` consistent across Tasks 9, 12, 13.
