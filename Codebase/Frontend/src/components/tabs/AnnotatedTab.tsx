import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appState';
import SourceView from '../analysis/SourceView';
import PatternLegend from '../analysis/PatternLegend';
import PatternCards from '../analysis/PatternCards';
import ClassBindings from '../analysis/ClassBindings';
import ClassTreeView from '../analysis/ClassTreeView';
import InBentoTabs from '../ui/InBentoTabs';
import { synthesizeUsageAnnotations } from '../../logic/usageAnnotations';
import { deriveAnnotatedModel } from '../../logic/annotatedModel';
import { buildClassTree } from '../../logic/classTreeModel';
import { canonicalPatternName } from '../../logic/patterns';
import { buildHierarchyMap, applyPatternTag } from '../../logic/patternPropagation';
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
  const {
    currentRun,
    aiStatus,
    gdbAllPassedForRun,
    setActiveTab,
    setPendingGdbAutoRun,
  } = useAppStore();
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

  // Single derivation surface. Everything below reads from `model` so all
  // UIs stay in lockstep when the user picks a pattern. The model is pure
  // and re-derived whenever currentRun's identity changes (the store
  // already produces a new currentRun reference on every patch via
  // patchCurrentRun's spread, so picks propagate automatically).
  const model = useMemo(
    () => deriveAnnotatedModel({ run: currentRun }),
    [currentRun],
  );

  // Single class-rooted tree — one row per tagged class, status drives the
  // click affordance (only review rows are clickable). Reads the same
  // model so it stays in lockstep with SourceView, PatternCards, etc.
  const classTree = useMemo(
    () => buildClassTree({ model, run: currentRun }),
    [model, currentRun],
  );

  // Observability: log the full class→candidates tree.
  // First log per run: BEFORE label. Subsequent logs (after each pick): AFTER label.
  const isFirstLog = useRef(true);
  // Reset BEFORE-state every time a fresh run lands so each run gets its own first log.
  useEffect(() => {
    isFirstLog.current = true;
  }, [currentRun?.pendingId, currentRun?.runId]);

  useEffect(() => {
    if (model.classes.size === 0) return;
    const label = isFirstLog.current
      ? '[NT] tree BEFORE user picks'
      : '[NT] tree AFTER user pick';
    console.group(label);
    for (const [cls, node] of model.classes) {
      const resolvedSuffix = node.resolved ? `  resolved=${node.resolved}` : '';
      console.log(`  ${cls}  candidates=[${node.candidates.join(', ')}]  status=${node.status}${resolvedSuffix}`);
    }
    console.groupEnd();
    isFirstLog.current = false;
  }, [model]);

  const handlePickClass = (className: string, patternKey: string): void => {
    const run = useAppStore.getState().currentRun;
    if (!run) return;

    // Verification: warn if the picked pattern has no structural detection for this class.
    const node = model.classes.get(className);
    if (node && !node.candidates.includes(patternKey)) {
      console.warn(`[NT] verification failed: ${className} has no structural match for "${patternKey}". Candidates: [${node.candidates.join(', ')}]`);
    }

    // Build hierarchy from the current memoised model so propagation
    // operates on the live (post-cascade) class tree, not the raw API shape.
    const hierarchy = buildHierarchyMap(model.workingMasterlist.values());
    const updatedChosenPatterns = applyPatternTag(
      className,
      patternKey,
      hierarchy,
      run.classChosenPatterns ?? {},
    );
    useAppStore.getState().patchCurrentRun({
      classResolvedPatterns: {
        ...(run.classResolvedPatterns || {}),
        [className]: patternKey,
      },
      classChosenPatterns: updatedChosenPatterns,
    });
    console.log(`[NT] user tagged  class=${className}  pattern=${patternKey}`);
  };

  const allAnnotations = useMemo(() => {
    if (!currentRun) return [];
    // Synthesize usage annotations against the LIVE pattern set so cascade
    // drops also strip the synthesized usage colours of the dropped class.
    const usage = synthesizeUsageAnnotations(
      currentRun.classUsageBindings || {},
      model.activePatterns,
      currentRun.classResolvedPatterns,
      currentRun.classUsageBindingSource || 'heuristic'
    );
    // Per-(className, canonical-pattern) strip: lifted from
    // model.workingMasterlist so PARTIAL cascade strips also flow into
    // the source view. Without this, a sibling-promoted subclass like
    // Truck (lost Strategy via cascade, kept Factory) would still
    // paint its strategy_concrete docTargets (override method,
    // inheritance colon, etc.) because the class itself isn't dropped.
    // Classes absent from working fall through to the legacy
    // droppedClassNames check so untagged-but-annotated edge cases
    // keep working.
    const survivingByClass = new Map<string, Set<string>>();
    for (const entry of model.workingMasterlist.values()) {
      const canon = new Set<string>();
      for (const p of entry.patterns) canon.add(canonicalPatternName(p));
      survivingByClass.set(entry.className, canon);
    }
    const direct = (currentRun.annotations || []).filter(a => {
      if (!a.className) return true;
      if (model.droppedClassNames.has(a.className)) return false;
      const surviving = survivingByClass.get(a.className);
      if (!surviving) return true;
      // Commentary-only annotations (no patternKey) ride along on the
      // class's living state — they survive as long as the class does.
      if (!a.patternKey) return true;
      return surviving.has(canonicalPatternName(a.patternKey));
    });
    return [...direct, ...usage];
  }, [currentRun, model]);

  if (!currentRun) {
    return (
      <section className="tab-panel tab-annotated tab-empty">
        <p>Run an analysis to see annotated source.</p>
      </section>
    );
  }

  // The microservice runs synchronously inside /api/analyze, so by the
  // time `currentRun` is set the tags are already on the run object.
  // We do NOT gate the tab on detectedPatterns.length here — a legitimate
  // empty verdict (code with no design patterns) would otherwise stay
  // stuck behind a spinner until AI commentary finished, which the user
  // experienced as "the tab is broken". The aiStatus pill in the header
  // already communicates that AI is still loading without blocking the
  // source view.

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
  // All derivation now lives in `model` (deriveAnnotatedModel). The locals
  // below are thin views onto it so the JSX further down keeps reading
  // familiar names. classDerivation also rebuilds firstLineByClass for the
  // class navigator since the model doesn't track navigation-only data.
  const classLocations = model.classLocations;
  const ambiguousLines = model.ambiguousLines;
  const pickerEligibleClassNames = model.pickerEligibleClassNames;

  const classDerivation = useMemo(() => {
    const firstLineByClass = new Map<string, number>();
    const patternCountByClass = new Map<string, number>();
    for (const p of currentRun?.detectedPatterns || []) {
      if (!p.className) continue;
      patternCountByClass.set(
        p.className,
        (patternCountByClass.get(p.className) || 0) + 1,
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
    return {
      patternCountByClass,
      firstLineByClass,
      inScopePatterns: model.inScopePatterns,
    };
  }, [currentRun, model]);

  const classNav = useMemo(() => {
    const run = currentRun;
    if (!run) return [];
    const { firstLineByClass, inScopePatterns } = classDerivation;
    void inScopePatterns; // retained for shape parity; classNav now uses ambiguousLines
    const out: Array<{ className: string; line: number; fileIdx: number }> = [];
    const considered = new Set<string>([
      ...firstLineByClass.keys(),
      ...inScopePatterns.keys(),
      ...classLocations.keys()
    ]);
    // Same own-pattern set the missing-pill memo computes; rebuilt here so
    // the navigator can compare in-scope patterns against the class's own.
    const ownPatternsByClass = new Map<string, Set<string>>();
    for (const p of run.detectedPatterns || []) {
      if (!p.className) continue;
      if (!ownPatternsByClass.has(p.className)) ownPatternsByClass.set(p.className, new Set());
      ownPatternsByClass.get(p.className)!.add(p.patternId);
    }
    for (const className of considered) {
      if (resolvedMap[className]) continue;
      // Class must be a microservice-tagged design pattern first.
      if (!detectedClassNames.has(className)) continue;
      const ownSet = ownPatternsByClass.get(className) || new Set<string>();
      const directAmbiguous = ownSet.size > 1;
      // Body ambiguity uses the SAME per-line popover-ambiguity signal
      // ("N possible patterns at this line"). If any line inside the
      // class scope would prompt the popover for a pick, the class is
      // ambiguous as a whole.
      const loc = classLocations.get(className);
      let bodyAmbiguous = false;
      if (loc) {
        for (const ln of ambiguousLines) {
          if (ln >= loc.line && ln <= loc.endLine) { bodyAmbiguous = true; break; }
        }
      }
      if (!directAmbiguous && !bodyAmbiguous) continue;
      const fallbackLine = firstLineByClass.get(className) ?? 1;
      out.push({
        className,
        line: loc?.line ?? fallbackLine,
        fileIdx: loc?.fileIdx ?? activeFileIdx,
      });
    }
    return out.sort((a, b) => (a.fileIdx - b.fileIdx) || (a.line - b.line));
  }, [currentRun, classDerivation, classLocations, resolvedMap, detectedClassNames, ambiguousLines, activeFileIdx]);

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
    const { inScopePatterns } = classDerivation;
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
    // Two-step ambiguity rule, gated on the microservice having actually
    // tagged the class as a design pattern (it must own a detection with
    // its className). Only THEN is in-scope evidence considered:
    //   1) the matcher attached >1 distinct patternIds to the class itself
    //      (same-structure conflict on the head), OR
    //   2) some OTHER pattern's detection landed inside the class's
    //      declaration scope (another design pattern living inside this
    //      one's body).
    // Classes the microservice never tagged as a design pattern are
    // ineligible for ambiguity entirely — they go straight to untagged.
    const ownPatternsByClass = new Map<string, Set<string>>();
    if (currentRun) {
      for (const p of currentRun.detectedPatterns || []) {
        if (!p.className) continue;
        if (!ownPatternsByClass.has(p.className)) ownPatternsByClass.set(p.className, new Set());
        ownPatternsByClass.get(p.className)!.add(p.patternId);
      }
    }
    // Pre-compute per-class "has any popover-ambiguous line inside scope".
    // This is the same signal the LinePopover uses to render its
    // "N possible patterns at this line" badge — applied class-wide.
    const classHasPopoverAmbiguousLine = new Map<string, boolean>();
    for (const [name, loc] of classLocations.entries()) {
      let hit = false;
      for (const ln of ambiguousLines) {
        if (ln >= loc.line && ln <= loc.endLine) { hit = true; break; }
      }
      classHasPopoverAmbiguousLine.set(name, hit);
    }
    for (const c of all) {
      const isTaggedByMicroservice = detectedClassNames.has(c);
      const isResolved = !!resolvedMap[c];
      if (!isTaggedByMicroservice && !isResolved) {
        untagged.push(c);
        continue;
      }
      const ownSet = ownPatternsByClass.get(c) || new Set<string>();
      // Step 1 — direct: matcher attached >1 distinct patterns to this
      // class's head. (e.g. CachedRepository tagged Adapter + Decorator
      // both at the decl line.)
      const directAmbiguous = ownSet.size > 1;
      // Step 2 — popover-ambiguous body: any line inside the class scope
      // has the same popover badge the user sees ("N possible patterns at
      // this line"). Catches the case where one specific line has rival
      // tags side-by-side.
      const bodyAmbiguous = !!classHasPopoverAmbiguousLine.get(c);
      // Step 3 — scope-union ambiguity: distinct pattern keys across ALL
      // annotations in the class's declaration scope > 1. Catches the
      // ShapeFactory shape: Factory hit at the class decl line, Strategy
      // hit at a method line — no single line is "ambiguous" but the
      // class itself spans multiple patterns. Strict superset of step 2;
      // needed because the matcher often spreads diversity across lines
      // rather than stacking it on one line.
      const scopeAmbiguous = (classDerivation.inScopePatterns.get(c)?.size || 0) > 1;
      const isAmbiguous = isTaggedByMicroservice
                       && (directAmbiguous || bodyAmbiguous || scopeAmbiguous)
                       && !isResolved;
      if (isAmbiguous) {
        ambiguous.add(c);
        missing.push(c);
      } else {
        tagged.push(c);
      }
    }
    return {
      ambiguousClassNames: ambiguous,
      taggedClassNames:    tagged,
      missingClassNames:   missing,
      untaggedClassNames:  untagged,
      allClassNames:       all
    };
  }, [classDerivation, detectedClassNames, bindingClassNames, resolvedMap, classLocations, ambiguousLines, currentRun]);

  // Reverse index keyed by line number — sourced directly from the model.
  const usageLinesByAmbiguousClass = model.usageLinesByAmbiguousClass;

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

  // CTA state machine. tag → gdb → submit (validation+save) → review.
  // Submit-and-save replaces the old separate "Save run" flow: the
  // single button collects validation + persistence into one API call,
  // and only Review unblocks afterwards.
  const ctaPhase: 'tag' | 'gdb' | 'submit' | 'review' =
    !allTagged ? 'tag'
    : !gdbAllPassedForRun ? 'gdb'
    : !currentRun.runId ? 'submit'
    : 'review';

  const [submitting, setSubmitting] = useState(false);

  async function onCtaClick() {
    if (!currentRun) return;
    if (ctaPhase === 'gdb') {
      setPendingGdbAutoRun(true);
      setActiveTab('gdb');
      return;
    }
    const pendingId = currentRun.pendingId;
    if (ctaPhase === 'submit' && pendingId) {
      setSubmitting(true);
      try {
        const { submitAndSaveRun } = await import('../../api/client');
        const out = await submitAndSaveRun(
          pendingId,
          currentRun.userResolvedPattern || undefined,
          currentRun.classResolvedPatterns || undefined
        );
        // Re-stamp the current run with the new server-side runId so
        // the next CTA click goes straight to Review and the GDB tab's
        // session lock pins to a saved-run identity.
        useAppStore.getState().patchCurrentRun({ runId: out.runId });
      } catch (err) {
        const e = err as Error & { detail?: string };
        alert(`Submit & save failed: ${e.detail || e.message}`);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (ctaPhase === 'review' && onGoToReview) onGoToReview();
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
          <PatternLegend legendPatterns={model.legendPatterns} />
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
                disabled={(ctaPhase === 'review' && !onGoToReview) || submitting}
              >
                {submitting
                  ? 'Submitting…'
                  : ctaPhase === 'gdb'
                    ? 'Next: Run unit tests →'
                    : ctaPhase === 'submit'
                      ? 'Submit validation & save →'
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
        <InBentoTabs
          ariaLabel="Annotated source views"
          className="annotated-bento"
          tabs={[
            {
              id: 'review',
              label: 'Review',
              content: (
                <div className="annotated-review-pane">
                  <div className="results-body">
                    <SourceView
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
                    />
                  </div>
                  <ClassBindings
                    bindings={currentRun.classUsageBindings || {}}
                    detectedPatterns={model.activePatterns}
                    classResolvedPatterns={currentRun.classResolvedPatterns}
                    ambiguousClassNames={model.greyClassNames}
                    subclassPendingClassNames={model.subclassPendingClassNames}
                    droppedClassNames={model.droppedClassNames}
                    onLineFlash={onLineFlash}
                  />
                </div>
              ),
            },
            {
              id: 'patterns',
              label: 'Patterns',
              content: (
                <PatternCards
                  detectedPatterns={model.activePatterns.filter(p =>
                    !p.className || !model.subclassPendingClassNames.has(p.className)
                  )}
                  ranking={currentRun.ranking}
                  userResolvedPattern={currentRun.userResolvedPattern}
                  classResolvedPatterns={currentRun.classResolvedPatterns}
                  ambiguousClassNames={pickerEligibleClassNames}
                  classUsageBindings={currentRun.classUsageBindings || {}}
                  classUsageBindingSource={currentRun.classUsageBindingSource || 'heuristic'}
                  onLineFlash={onLineFlash}
                />
              ),
            },
            {
              id: 'classtree',
              label: 'Class tree',
              content: (
                <ClassTreeView
                  nodes={classTree}
                  pickerCandidatesByClass={model.inScopePatterns}
                  onPickClass={handlePickClass}
                  onLineFlash={onLineFlash}
                />
              ),
            },
          ]}
        />
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
    </div>
  );
}
