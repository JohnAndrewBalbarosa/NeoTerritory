import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appState';
import SourceView from '../analysis/SourceView';
import PatternLegend from '../analysis/PatternLegend';
import PatternCards from '../analysis/PatternCards';
import ClassBindings from '../analysis/ClassBindings';
import { synthesizeUsageAnnotations } from '../../lib/usageAnnotations';
import { AnalysisRunFile } from '../../types/api';

interface AnnotatedTabProps {
  onLineFlash: (line: number) => void;
  onCommentFlash: (id: string) => void;
  pendingSave?: boolean;
  onDiscard?: () => void;
  onGoToReview?: () => void;
}

export default function AnnotatedTab({
  onLineFlash, onCommentFlash, pendingSave, onDiscard, onGoToReview
}: AnnotatedTabProps) {
  const { currentRun, aiStatus } = useAppStore();
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [classNavIdx, setClassNavIdx] = useState(0);

  // Resolve the per-file slice. Multi-file runs ship `files[]`; legacy
  // single-file runs back-fill into a synthetic single-entry list so the
  // rest of this component can iterate uniformly.
  const files: AnalysisRunFile[] = useMemo(() => {
    if (!currentRun) return [];
    if (currentRun.files && currentRun.files.length > 0) return currentRun.files;
    return [{ name: currentRun.sourceName || 'snippet.cpp', sourceText: currentRun.sourceText || '' }];
  }, [currentRun]);
  const activeFile = files[activeFileIdx] || files[0];

  const allAnnotations = useMemo(() => {
    if (!currentRun) return [];
    const usage = synthesizeUsageAnnotations(
      currentRun.classUsageBindings || {},
      currentRun.detectedPatterns || [],
      currentRun.classResolvedPatterns,
      currentRun.classUsageBindingSource || 'heuristic'
    );
    return [...(currentRun.annotations || []), ...usage];
  // Re-synthesize when retag updates classResolvedPatterns so colors propagate.
  }, [currentRun]);

  if (!currentRun) {
    return (
      <section className="tab-panel tab-annotated tab-empty">
        <p>Run an analysis to see annotated source.</p>
      </section>
    );
  }

  const patternCount = currentRun.detectedPatterns?.length || 0;
  const commentCount = allAnnotations.length;
  const fileSuffix = files.length > 1 ? ` • ${files.length} files` : '';
  const summaryText = `${activeFile?.name || currentRun.sourceName || 'snippet.cpp'} • ${patternCount} pattern(s) • ${commentCount} comment(s)${fileSuffix}`;

  // A class counts as "tagged" if EITHER the matcher already gave it a
  // pattern (presence in detectedPatterns) OR the user explicitly resolved
  // one via the popover/picker. The total population is the set of all
  // classes the run knows about — detected patterns + class-usage bindings.
  // "Missing tags" is the complement: classes that exist in source but have
  // neither a matcher verdict nor a user resolution.
  const detectedClassNames = new Set(
    (currentRun.detectedPatterns || [])
      .map(p => p.className)
      .filter((c): c is string => !!c)
  );
  const bindingClassNames = new Set(Object.keys(currentRun.classUsageBindings || {}));
  const allClassNames = new Set<string>([...detectedClassNames, ...bindingClassNames]);
  const resolvedMap = currentRun.classResolvedPatterns || {};
  const taggedClassNames = [...allClassNames].filter(c => detectedClassNames.has(c) || !!resolvedMap[c]);
  const missingClassNames = [...allClassNames].filter(c => !detectedClassNames.has(c) && !resolvedMap[c]);
  const taggedCount = taggedClassNames.length;
  const missingCount = missingClassNames.length;
  const totalClasses = allClassNames.size;
  const allTagged = totalClasses > 0 && missingCount === 0;

  // Ordered class navigation for the bottom-right overlay. Restricted to
  // classes that still need attention: the matcher emitted multiple
  // candidate patterns for them (ambiguous) OR the user has not resolved
  // them yet (missing tag). Once a class is resolved or unambiguously
  // detected, it drops off the nav list — no point cycling through
  // already-decided classes.
  const classNav = useMemo(() => {
    const run = currentRun;
    if (!run) return [];
    // Count how many distinct patterns the matcher produced per class.
    const patternCountByClass = new Map<string, number>();
    const firstLineByClass = new Map<string, number>();
    for (const p of run.detectedPatterns || []) {
      if (!p.className) continue;
      patternCountByClass.set(
        p.className,
        (patternCountByClass.get(p.className) || 0) + 1
      );
      const firstLine = (p.documentationTargets || [])
        .map(t => t.line)
        .filter((l): l is number => typeof l === 'number')
        .sort((a, b) => a - b)[0] ?? 1;
      const prev = firstLineByClass.get(p.className);
      if (prev === undefined || firstLine < prev) {
        firstLineByClass.set(p.className, firstLine);
      }
    }
    const resolvedMap = run.classResolvedPatterns || {};
    const out: Array<{ className: string; line: number }> = [];
    for (const [className, line] of firstLineByClass.entries()) {
      if (resolvedMap[className]) continue; // user already picked
      const ambiguous = (patternCountByClass.get(className) || 0) > 1;
      if (!ambiguous) continue; // single confident detection
      out.push({ className, line });
    }
    return out.sort((a, b) => a.line - b.line);
  }, [currentRun]);
  const navClass = classNav[classNavIdx];
  // If the active class drops off the list (e.g. user resolved it), snap
  // the index back to a valid range so the overlay re-renders correctly.
  if (navClass === undefined && classNav.length > 0 && classNavIdx !== 0) {
    setClassNavIdx(0);
  }

  function gotoClass(idx: number) {
    if (classNav.length === 0) return;
    const wrapped = ((idx % classNav.length) + classNav.length) % classNav.length;
    setClassNavIdx(wrapped);
    onLineFlash(classNav[wrapped].line);
  }

  return (
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
        <PatternLegend detectedPatterns={currentRun.detectedPatterns || []} />
        {pendingSave && onDiscard && (
          <button
            type="button"
            className="ghost-btn discard-btn"
            onClick={() => { if (confirm('Discard this run? Your tags and edits will be lost.')) onDiscard(); }}
            title="Drop the current unsaved run"
          >
            Discard run
          </button>
        )}
      </header>
      {totalClasses > 0 && (
        <div className="tag-progress" data-complete={allTagged ? 'true' : undefined}>
          <span className="tag-progress-pill tag-progress-pill--tagged">
            {taggedCount} class{taggedCount === 1 ? '' : 'es'} tagged
          </span>
          {missingCount > 0 && (
            <span className="tag-progress-pill tag-progress-pill--missing" title={missingClassNames.join(', ')}>
              {missingCount} class{missingCount === 1 ? '' : 'es'} with missing tags
            </span>
          )}
          {allTagged && onGoToReview && (
            <button
              type="button"
              className="primary-btn tag-progress-cta"
              onClick={onGoToReview}
            >
              Next: Review before submission →
            </button>
          )}
        </div>
      )}
      {files.length > 1 && (
        <nav className="file-tab-bar" role="tablist" aria-label="Submitted files">
          {files.map((f, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === activeFileIdx}
              className={`file-tab-btn ${i === activeFileIdx ? 'is-active' : ''}`}
              onClick={() => setActiveFileIdx(i)}
              title={f.name}
            >
              {f.name}
            </button>
          ))}
        </nav>
      )}
      <div className="results-body">
        <SourceView
          sourceText={activeFile?.sourceText || currentRun.sourceText || ''}
          annotations={allAnnotations}
          detectedPatterns={currentRun.detectedPatterns || []}
          classResolvedPatterns={currentRun.classResolvedPatterns}
          onLineClick={onCommentFlash}
        />
      </div>
      <PatternCards
        detectedPatterns={currentRun.detectedPatterns || []}
        ranking={currentRun.ranking}
        userResolvedPattern={currentRun.userResolvedPattern}
        classUsageBindings={currentRun.classUsageBindings || {}}
        classUsageBindingSource={currentRun.classUsageBindingSource || 'heuristic'}
        onLineFlash={onLineFlash}
      />
      <ClassBindings
        bindings={currentRun.classUsageBindings || {}}
        detectedPatterns={currentRun.detectedPatterns || []}
        classResolvedPatterns={currentRun.classResolvedPatterns}
        onLineFlash={onLineFlash}
      />
      {classNav.length >= 1 && navClass && (
        <div className="class-nav-overlay" role="navigation" aria-label="Ambiguous class navigation">
          <span className="class-nav-eyebrow">Ambiguous</span>
          <button
            type="button"
            className="class-nav-btn"
            onClick={() => gotoClass(classNavIdx - 1)}
            aria-label="Previous class"
            title="Previous class"
          >←</button>
          <span className="class-nav-label" title={navClass.className}>
            <span className="class-nav-position">{classNavIdx + 1} / {classNav.length}</span>
            <span className="class-nav-classname">{navClass.className}</span>
            <span className="class-nav-line">L{navClass.line}</span>
          </span>
          <button
            type="button"
            className="class-nav-btn"
            onClick={() => gotoClass(classNavIdx + 1)}
            aria-label="Next class"
            title="Next class"
          >→</button>
        </div>
      )}
    </section>
  );
}
