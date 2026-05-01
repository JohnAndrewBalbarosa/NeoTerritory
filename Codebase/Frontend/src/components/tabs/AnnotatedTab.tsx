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
  // Locate each class's declaration site (file + line) AND a coarse line
  // range so we can decide whether a given annotation falls "inside" a
  // class scope. We approximate the range by finding the next class/struct
  // declaration in the same file and using (decl_line, next_decl_line - 1)
  // as the inclusive range — this is a heuristic, not a real C++ parser,
  // but it's good enough to detect "ambiguous tag inside class Foo".
  const classLocations = useMemo(() => {
    const locs = new Map<string, { fileIdx: number; line: number; endLine: number }>();
    for (let fi = 0; fi < files.length; fi++) {
      const text = files[fi].sourceText || '';
      const lines = text.split('\n');
      const decls: Array<{ name: string; line: number }> = [];
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/\b(?:class|struct)\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
        if (m) decls.push({ name: m[1], line: i + 1 });
      }
      for (let k = 0; k < decls.length; k++) {
        const d = decls[k];
        const next = decls[k + 1]?.line ?? lines.length + 1;
        if (!locs.has(d.name)) {
          locs.set(d.name, { fileIdx: fi, line: d.line, endLine: next - 1 });
        }
      }
    }
    return locs;
  }, [files]);

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

    // Second pass: a class also counts as ambiguous when the matcher emitted
    // an ambiguous pattern *inside its line scope*, even if the per-class
    // attribution wasn't captured directly on that detection. We scan every
    // detectedPattern and count how many fall into each known class scope.
    const inScopePatterns = new Map<string, Set<string>>();
    for (const p of run.detectedPatterns || []) {
      const targetLines = (p.documentationTargets || [])
        .map(t => t.line)
        .filter((l): l is number => typeof l === 'number');
      if (targetLines.length === 0) continue;
      for (const [name, loc] of classLocations.entries()) {
        const hits = targetLines.some(l => l >= loc.line && l <= loc.endLine);
        if (hits) {
          if (!inScopePatterns.has(name)) inScopePatterns.set(name, new Set());
          inScopePatterns.get(name)!.add(p.patternId);
        }
      }
    }

    const out: Array<{ className: string; line: number; fileIdx: number }> = [];
    const considered = new Set<string>([
      ...firstLineByClass.keys(),
      ...inScopePatterns.keys(),
      ...classLocations.keys()
    ]);
    for (const className of considered) {
      if (resolvedMap[className]) continue;
      const directAmbiguous   = (patternCountByClass.get(className) || 0) > 1;
      const inScopeAmbiguous  = (inScopePatterns.get(className)?.size  || 0) > 1;
      if (!directAmbiguous && !inScopeAmbiguous) continue;
      const fallbackLine = firstLineByClass.get(className) ?? 1;
      const loc = classLocations.get(className);
      out.push({
        className,
        line: loc?.line ?? fallbackLine,
        fileIdx: loc?.fileIdx ?? activeFileIdx,
      });
    }
    return out.sort((a, b) => (a.fileIdx - b.fileIdx) || (a.line - b.line));
  }, [currentRun, classLocations, activeFileIdx]);
  const navClass = classNav[classNavIdx];
  // If the active class drops off the list (e.g. user resolved it), snap
  // the index back to a valid range so the overlay re-renders correctly.
  if (navClass === undefined && classNav.length > 0 && classNavIdx !== 0) {
    setClassNavIdx(0);
  }

  function gotoClass(idx: number) {
    if (classNav.length === 0) return;
    const wrapped = ((idx % classNav.length) + classNav.length) % classNav.length;
    const target = classNav[wrapped];
    setClassNavIdx(wrapped);
    // Switch tabs first if the class lives in another file, otherwise the
    // line flash fires against the wrong source.
    if (target.fileIdx !== activeFileIdx) {
      setActiveFileIdx(target.fileIdx);
      // Defer the flash a tick so SourceView has rerendered with the new file.
      setTimeout(() => onLineFlash(target.line), 0);
    } else {
      onLineFlash(target.line);
    }
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
