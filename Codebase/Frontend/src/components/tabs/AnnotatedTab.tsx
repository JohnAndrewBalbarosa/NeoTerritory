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
  const { currentRun, aiStatus, gdbAllPassedForRun, setActiveTab } = useAppStore();
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

  // The class population: detected patterns ∪ usage-binding classes ∪
  // classes the regex pulled from source whose body contains in-scope
  // ambiguity. The third set matters because a class can host competing
  // pattern guesses on its body lines without itself being directly
  // attached to any pattern — those still count as ambiguous.
  const detectedClassNames = new Set(
    (currentRun.detectedPatterns || [])
      .map(p => p.className)
      .filter((c): c is string => !!c)
  );
  const bindingClassNames = new Set(Object.keys(currentRun.classUsageBindings || {}));
  const resolvedMap = currentRun.classResolvedPatterns || {};

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

  // Shared per-class derivation feeding both the navigator and the
  // tag-progress pill. We compute (a) how many distinct patterns the matcher
  // attached directly to each class, (b) the first-line of each class's
  // detected patterns (for fallback navigation), and (c) the set of
  // patternIds whose targets fall inside each class's scope. The progress
  // pill treats (c.size > 1) as ambiguous too — even one ambiguous line
  // inside a class declaration marks the whole class.
  const classDerivation = useMemo(() => {
    const run = currentRun;
    const patternCountByClass = new Map<string, number>();
    const firstLineByClass = new Map<string, number>();
    const inScopePatterns = new Map<string, Set<string>>();
    if (!run) return { patternCountByClass, firstLineByClass, inScopePatterns };

    // Pass A — pattern documentation targets.
    for (const p of run.detectedPatterns || []) {
      if (p.className) {
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

    // Pass B — annotations. The annotation stream often carries ambiguity
    // signal the matcher's documentationTargets don't (e.g. ShapeFactory's
    // body is single-pattern in detectedPatterns but the per-line
    // annotations can carry two distinct patternKeys). Treat each
    // annotation's (line, patternKey) as in-scope evidence for the class
    // whose declaration scope contains that line. We also fold the class's
    // own usage-binding lines in (so global helpers that reference it
    // contribute to its ambiguity verdict).
    for (const ann of allAnnotations) {
      const line = typeof ann.line === 'number' ? ann.line : null;
      const key = ann.patternKey;
      if (!line || !key) continue;
      for (const [name, loc] of classLocations.entries()) {
        if (line >= loc.line && line <= loc.endLine) {
          if (!inScopePatterns.has(name)) inScopePatterns.set(name, new Set());
          inScopePatterns.get(name)!.add(key);
        }
      }
    }
    const usageBindings = run.classUsageBindings || {};
    for (const [name, list] of Object.entries(usageBindings)) {
      for (const b of list || []) {
        const line = typeof b?.line === 'number' ? b.line : null;
        if (!line) continue;
        // For every detected pattern target on this usage line, log the
        // pattern under the bound class so a global helper that touches
        // multiple pattern signatures flags its referent class as ambiguous.
        for (const p of run.detectedPatterns || []) {
          const hit = (p.documentationTargets || []).some(t => t.line === line);
          if (hit) {
            if (!inScopePatterns.has(name)) inScopePatterns.set(name, new Set());
            inScopePatterns.get(name)!.add(p.patternId);
          }
        }
        for (const ann of allAnnotations) {
          if (ann.line === line && ann.patternKey) {
            if (!inScopePatterns.has(name)) inScopePatterns.set(name, new Set());
            inScopePatterns.get(name)!.add(ann.patternKey);
          }
        }
      }
    }
    return { patternCountByClass, firstLineByClass, inScopePatterns };
  }, [currentRun, classLocations, allAnnotations]);

  const classNav = useMemo(() => {
    const run = currentRun;
    if (!run) return [];
    const { patternCountByClass, firstLineByClass, inScopePatterns } = classDerivation;
    const out: Array<{ className: string; line: number; fileIdx: number }> = [];
    const considered = new Set<string>([
      ...firstLineByClass.keys(),
      ...inScopePatterns.keys(),
      ...classLocations.keys()
    ]);
    for (const className of considered) {
      if (resolvedMap[className]) continue;
      // STRICT: navigator only cycles classes the microservice DIRECTLY
      // tagged with more than one pattern. No in-scope inference, no
      // annotation-derived guesses, no untagged classes. The set is
      // exactly: classes with `>1` distinct patternIds where each
      // detection carried this className. Anything else stays out.
      if (!detectedClassNames.has(className)) continue;
      const directAmbiguous = (patternCountByClass.get(className) || 0) > 1;
      if (!directAmbiguous) continue;
      const fallbackLine = firstLineByClass.get(className) ?? 1;
      const loc = classLocations.get(className);
      out.push({
        className,
        line: loc?.line ?? fallbackLine,
        fileIdx: loc?.fileIdx ?? activeFileIdx,
      });
    }
    return out.sort((a, b) => (a.fileIdx - b.fileIdx) || (a.line - b.line));
  }, [currentRun, classDerivation, classLocations, resolvedMap, detectedClassNames, activeFileIdx]);

  // Tag-progress count derives from the same ambiguity model the navigator
  // uses. A class is ambiguous (and therefore "missing") when:
  //   • the matcher emitted >1 patterns directly on it, OR
  //   • >1 distinct patterns target lines inside its declaration scope,
  // and the user has not picked a pattern via the popover. Picking a pattern
  // patches `currentRun.classResolvedPatterns`, which retriggers this memo
  // and updates the pill live without a re-fetch.
  const { taggedClassNames, missingClassNames, untaggedClassNames, allClassNames } = useMemo(() => {
    const ambiguous = new Set<string>();
    const tagged: string[] = [];
    const missing: string[] = [];
    const untagged: string[] = [];
    const { patternCountByClass, inScopePatterns } = classDerivation;
    const all = new Set<string>([
      ...detectedClassNames,
      ...bindingClassNames,
      ...inScopePatterns.keys()
    ]);
    // The microservice "tagged" the class when it surfaces in
    // detectedPatterns with a className. Only those classes are eligible
    // for the ambiguous bucket — a class no pattern detector reported
    // can't be ambiguous (it has nothing to be ambiguous between yet).
    // Classes with regex/binding evidence but zero microservice tags
    // become "untagged" — informational only, no CTA effect.
    for (const c of all) {
      // STRICT: ambiguous == microservice DIRECTLY tagged the class with
      // more than one distinct pattern, and the user hasn't resolved it.
      // Classes with a single direct tag = tagged. Classes with no direct
      // detection = untagged. No in-scope inference is allowed to bump a
      // class into the ambiguous bucket — the navigator cycles exactly
      // this set, and the user explicitly does not want anything else in
      // the nav.
      const isTaggedByMicroservice = detectedClassNames.has(c);
      const isResolved = !!resolvedMap[c];
      const directAmbiguous = (patternCountByClass.get(c) || 0) > 1;
      const isAmbiguous = isTaggedByMicroservice && directAmbiguous && !isResolved;
      if (isAmbiguous) {
        ambiguous.add(c);
        missing.push(c);
      } else if (isTaggedByMicroservice || isResolved) {
        tagged.push(c);
      } else {
        untagged.push(c);
      }
    }
    return {
      ambiguousClassNames: ambiguous,
      taggedClassNames:    tagged,
      missingClassNames:   missing,
      untaggedClassNames:  untagged,
      allClassNames:       all
    };
  }, [classDerivation, detectedClassNames, bindingClassNames, resolvedMap]);

  const taggedCount = taggedClassNames.length;
  const missingCount = missingClassNames.length;
  const totalClasses = allClassNames.size;
  const allTagged = totalClasses > 0 && missingCount === 0;
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

  // CTA state machine. The user must run the GDB tests and pass them all
  // for the current run before being allowed to advance to the Review step.
  // gdbAllPassedForRun is invalidated whenever a new analysis is dispatched
  // (see store.setCurrentRun), so re-running an analysis re-blocks Review.
  const ctaPhase: 'tag' | 'gdb' | 'review' =
    !allTagged ? 'tag' : !gdbAllPassedForRun ? 'gdb' : 'review';

  function onCtaClick() {
    if (ctaPhase === 'gdb') setActiveTab('gdb');
    else if (ctaPhase === 'review' && onGoToReview) onGoToReview();
  }

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
          <PatternLegend detectedPatterns={currentRun.detectedPatterns || []} />
        </header>
        {totalClasses > 0 && (
          <div className="tag-progress" data-complete={allTagged ? 'true' : undefined}>
            <span className="tag-progress-pill tag-progress-pill--tagged">
              {taggedCount} class{taggedCount === 1 ? '' : 'es'} tagged
            </span>
            {missingCount > 0 && (
              <span
                className="tag-progress-pill tag-progress-pill--missing"
                title={missingClassNames.join(', ')}
              >
                {missingCount} ambiguous class{missingCount === 1 ? '' : 'es'} with missing tags
              </span>
            )}
            {untaggedClassNames.length > 0 && (
              <span
                className="tag-progress-pill tag-progress-pill--untagged"
                title={untaggedClassNames.join(', ')}
              >
                {untaggedClassNames.length} class{untaggedClassNames.length === 1 ? '' : 'es'} without a design pattern tag
              </span>
            )}
            {ctaPhase !== 'tag' && (
              <button
                type="button"
                className="primary-btn tag-progress-cta"
                onClick={onCtaClick}
                disabled={ctaPhase === 'review' && !onGoToReview}
              >
                {ctaPhase === 'gdb'
                  ? 'Next: Run unit tests →'
                  : 'Next: Review before submission →'}
              </button>
            )}
            {/* Discard tucked into the tag-progress row, right-aligned via CSS,
                instead of competing for attention in the header. */}
            {pendingSave && onDiscard && (
              <button
                type="button"
                className="ghost-btn tag-progress-discard"
                onClick={() => { if (confirm('Discard this run? Your tags and edits will be lost.')) onDiscard(); }}
                title="Drop the current unsaved run"
              >
                Discard
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
            classUsageBindings={currentRun.classUsageBindings}
            onLineClick={onCommentFlash}
          />
        </div>
      </section>
      {/* Two viewport-corner buttons. The middle label that previously sat
          between them was redundant with the popover/source flash, so it
          was dropped — the buttons themselves carry their semantics via
          `aria-label` + `title`. They vanish when classNav.length === 0
          and re-appear on undo. */}
      {classNav.length >= 1 && navClass && (
        <>
          <button
            type="button"
            className="class-nav-corner class-nav-corner--left"
            onClick={() => gotoClass(classNavIdx - 1)}
            aria-label={`Previous ambiguous class (${classNavIdx + 1} / ${classNav.length})`}
            title={`Previous ambiguous class — currently ${navClass.className} L${navClass.line}`}
          >←</button>
          <button
            type="button"
            className="class-nav-corner class-nav-corner--right"
            onClick={() => gotoClass(classNavIdx + 1)}
            aria-label={`Next ambiguous class (${classNavIdx + 1} / ${classNav.length})`}
            title={`Next ambiguous class — currently ${navClass.className} L${navClass.line}`}
          >→</button>
        </>
      )}
      <aside className="results-sidebar" aria-label="Detected patterns and class bindings">
        {/* ClassBindings (which renders .class-strip-row) goes first so the
            strip sits above the scoring-explainer-banner inside PatternCards. */}
        <ClassBindings
          bindings={currentRun.classUsageBindings || {}}
          detectedPatterns={currentRun.detectedPatterns || []}
          classResolvedPatterns={currentRun.classResolvedPatterns}
          onLineFlash={onLineFlash}
        />
        <PatternCards
          detectedPatterns={currentRun.detectedPatterns || []}
          ranking={currentRun.ranking}
          userResolvedPattern={currentRun.userResolvedPattern}
          classUsageBindings={currentRun.classUsageBindings || {}}
          classUsageBindingSource={currentRun.classUsageBindingSource || 'heuristic'}
          onLineFlash={onLineFlash}
        />
      </aside>
    </div>
  );
}
