import { useRef } from 'react';
import { useAppStore } from '../../store/appState';
import { patternDefinitionFor } from '../../data/patternDefinitions';
import {
  FAMILY_DESCRIPTIONS, FAMILY_ORDER,
  groupByFamily, annotationsForPattern, isAiAnnotation,
  downloadMarkdown, downloadDocx, triggerPdfPrint,
} from '../../logic/docExport';
import { DetectedPatternFull, Annotation } from '../../types/api';

function AnnotationRow({ a }: { a: Annotation }) {
  const isAi = isAiAnnotation(a);
  return (
    <li className="docs-ann-row">
      <span className={`badge ${isAi ? 'badge-ai' : 'badge-static'}`}>
        {isAi ? 'AI' : 'Static'}
      </span>
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
        <span className="docs-confidence">{Math.round(p.confidence * 100)}%</span>
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
  const { currentRun } = useAppStore();
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

  function handleDocx() {
    if (contentRef.current) downloadDocx(currentRun!, contentRef.current.innerHTML);
  }

  return (
    <div className="docs-tab">
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
