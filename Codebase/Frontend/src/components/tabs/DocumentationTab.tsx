import { useRef } from 'react';
import { useAppStore } from '../../store/appState';
import { patternDefinitionFor } from '../../data/patternDefinitions';
import {
  FAMILY_DESCRIPTIONS, FAMILY_ORDER,
  groupByFamily, annotationsForPattern, isAiAnnotation,
  downloadMarkdown, downloadDocx, triggerPdfPrint,
} from '../../logic/docExport';
import { DetectedPatternFull, Annotation } from '../../types/api';

// Per-row AI/Static badge removed (project owner: don't say "AI
// pending" per line — show one banner at the top of the page when
// AI annotations are absent so the user sees the documentation source
// at a glance instead of N redundant pills).
function AnnotationRow({ a }: { a: Annotation }) {
  return (
    <li className="docs-ann-row">
      {a.line != null && <span className="docs-line-ref">L{a.line}</span>}
      <span className="docs-ann-title">{a.title}</span>
      {a.comment && <span className="docs-ann-body">{a.comment}</span>}
    </li>
  );
}

function PatternSection({ p, annotations }: { p: DetectedPatternFull; annotations: Annotation[] }) {
  const def = patternDefinitionFor(p.patternName);
  const { static: stAnns, ai: aiAnns } = annotationsForPattern(annotations, p);
  const allAnns = [...stAnns, ...aiAnns];

  return (
    <article className="docs-pattern">
      <header className="docs-pattern-header">
        <h3 className="docs-pattern-name">{p.patternName}</h3>
        {p.className && <span className="docs-classname">{p.className}</span>}
        {p.parentClassName && (
          <span className="docs-inherited">inherited from {p.parentClassName}</span>
        )}
      </header>

      {/* Static pattern definition */}
      {def && (
        <div className="docs-definition">
          <p className="docs-oneliner">{def.oneLiner}</p>
          <p><span className="docs-label">When to use:</span> {def.whenToUse}</p>
          {def.realWorldAnalogy && (
            <p><span className="docs-label">Analogy:</span> {def.realWorldAnalogy}</p>
          )}
          {def.watchOuts && (
            <p className="docs-watchout"><span className="docs-label">Watch out:</span> {def.watchOuts}</p>
          )}
        </div>
      )}

      {/* AI-generated pattern education */}
      {p.patternEducation && (
        <div className="docs-ai-education">
          <h4 className="docs-section-heading">
            <span className="badge badge-ai">AI</span> Analysis of your code
          </h4>
          <p>{p.patternEducation.explanation}</p>
          <p><span className="docs-label">Why it fired:</span> {p.patternEducation.whyThisFired}</p>
          <p><span className="docs-label">Study hint:</span> {p.patternEducation.studyHint}</p>
        </div>
      )}

      {/* All annotations (static and AI mixed, labeled) */}
      {allAnns.length > 0 && (
        <div className="docs-annotations">
          <h4 className="docs-section-heading">Code Annotations</h4>
          <ul className="docs-ann-list">
            {stAnns.map(a => <AnnotationRow key={a.id} a={a} />)}
            {aiAnns.map(a => <AnnotationRow key={a.id} a={a} />)}
          </ul>
        </div>
      )}

      {/* Unit test targets */}
      {p.unitTestTargets.length > 0 && (
        <div className="docs-unit-tests">
          <h4 className="docs-section-heading">Unit Tests to Implement</h4>
          <ul className="docs-test-list">
            {p.unitTestTargets.map(t => (
              <li key={String(t.function_hash)} className="docs-test-row">
                <span className="docs-checkbox">☐</span>
                <code>{t.function_name}</code>
                <span className="docs-line-ref">L{t.line}</span>
                <span className="docs-branch">{t.branch_kind}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Documentation targets from microservice */}
      {p.documentationTargets.length > 0 && (
        <div className="docs-targets">
          <h4 className="docs-section-heading">Documentation Targets</h4>
          <ul className="docs-target-list">
            {p.documentationTargets.map((t, i) => (
              <li key={i} className="docs-target-row">
                <span className="docs-line-ref">L{t.line}</span>
                <span className="docs-target-label">{t.label}</span>
                <code>{t.lexeme}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default function DocumentationTab() {
  const { currentRun, aiStatus } = useAppStore();
  const contentRef = useRef<HTMLDivElement>(null);

  if (!currentRun) {
    return (
      <div className="docs-empty">
        <p>Run an analysis first to generate documentation.</p>
      </div>
    );
  }

  const groups = groupByFamily(currentRun.detectedPatterns);
  const primaryFile = currentRun.files?.[0]?.name ?? currentRun.sourceName ?? 'source.cpp';

  // Top-of-page documentation-source banner. Replaces the per-row AI
  // pending pill the project owner asked us to drop. We surface ONE of
  // three messages once: AI ready, AI working, or static-only.
  const allAnns = currentRun.annotations || [];
  const hasAiAnnotations = allAnns.some(isAiAnnotation);
  const docsBanner = hasAiAnnotations
    ? { kind: 'ai-ready', label: 'AI documentation included for this run.' }
    : aiStatus === 'pending'
      ? { kind: 'ai-pending', label: 'Static documentation only (AI commentary still arriving — refresh shortly).' }
      : aiStatus === 'failed'
        ? { kind: 'ai-failed', label: 'Static documentation only (AI commentary failed for this run).' }
        : { kind: 'static-only', label: 'Static documentation only.' };

  function handleDocx() {
    if (contentRef.current) downloadDocx(currentRun!, contentRef.current.innerHTML);
  }

  return (
    <div className="docs-tab">
      {/* Per D69 (this turn): "How to read this page" guide. One concise
          explainer at the top of the Docs tab so the reader knows what
          each section means before scrolling into the per-pattern body.
          Collapsible so it stays out of the way after first read. */}
      <details className="docs-read-guide">
        <summary>How to read this page</summary>
        <ol>
          <li>
            <strong>Banner at the top</strong> tells you whether AI documentation is included or
            the page is showing only static pattern definitions. AI status appears once - not on
            every line.
          </li>
          <li>
            <strong>Pattern Documentation</strong> (per family) is the catalog-side definition of
            the pattern (one-liner, when to use it, real-world analogy). Same vocabulary the
            classroom uses; lifted from the pattern catalog.
          </li>
          <li>
            <strong>AI Analysis of your code</strong> (when present) explains how the pattern
            shows up in your specific class, why the detector fired, and a study hint pointing
            at the lines that mattered.
          </li>
          <li>
            <strong>Code Annotations</strong> are per-line callouts (line number + title +
            note) tying the explanation back to your source. Static annotations come from the
            microservice; AI annotations supplement them when AI is configured.
          </li>
          <li>
            <strong>Unit Tests to Implement</strong> lists the function points the matcher flagged
            as test-worthy. The Tests tab generates and runs scaffolds for these.
          </li>
          <li>
            <strong>Documentation Targets</strong> are the structural anchors the microservice
            emitted (class header, key method, constructor) so you know which lines are
            load-bearing for the pattern verdict.
          </li>
        </ol>
        <p className="docs-read-guide__foot">
          Export buttons (MD / PDF / DOCX) ship the same content as the printable view. Nothing
          is hidden from the export.
        </p>
      </details>
      {/* Toolbar */}
      <div className="docs-toolbar">
        <div className="docs-toolbar-info">
          <span className="docs-toolbar-title">Pattern Documentation</span>
          <span className="docs-toolbar-meta">
            {currentRun.detectedPatterns.length} pattern(s) · {primaryFile}
          </span>
        </div>
        <div className="docs-download-group">
          <button className="ghost-btn docs-dl-btn" onClick={() => downloadMarkdown(currentRun!)}>
            MD
          </button>
          <button className="ghost-btn docs-dl-btn" onClick={() => triggerPdfPrint(contentRef.current)}>
            PDF
          </button>
          <button className="ghost-btn docs-dl-btn" onClick={handleDocx}>
            DOCX
          </button>
        </div>
      </div>

      {/* Printable / exportable content */}
      <div ref={contentRef} className="docs-content">
        <h1 className="docs-main-title">Code Documentation</h1>
        <p className="docs-main-meta">
          <strong>File:</strong> {primaryFile} &nbsp;·&nbsp;
          <strong>Patterns:</strong> {currentRun.detectedPatterns.length} &nbsp;·&nbsp;
          <strong>Generated:</strong> {new Date().toLocaleString()}
        </p>
        <div className={`docs-source-banner docs-source-banner--${docsBanner.kind}`} role="status">
          {docsBanner.label}
        </div>

        {currentRun.detectedPatterns.length === 0 && (
          <p className="docs-no-patterns">No patterns were detected in this submission.</p>
        )}

        {FAMILY_ORDER.map(fam => {
          const patterns = groups[fam];
          if (!patterns?.length) return null;
          return (
            <section key={fam} className="docs-family">
              <h2 className="docs-family-heading">{fam} Patterns</h2>
              {FAMILY_DESCRIPTIONS[fam] && (
                <p className="family-desc">{FAMILY_DESCRIPTIONS[fam]}</p>
              )}
              {patterns.map(p => (
                <PatternSection
                  key={`${p.patternId}-${p.className ?? 'x'}`}
                  p={p}
                  annotations={currentRun.annotations}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
