import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAppStore } from '../../store/appState';
import SourceView from '../analysis/SourceView';
import PatternLegend from '../analysis/PatternLegend';
import { synthesizeUsageAnnotations } from '../../logic/usageAnnotations';
import { deriveAnnotatedModel } from '../../logic/annotatedModel';
import { buildClassTree } from '../../logic/classTreeModel';
import { canonicalPatternName, colorFor } from '../../logic/patterns';
import { buildHierarchyMap, applyPatternTag } from '../../logic/patternPropagation';
import { AnalysisRunFile } from '../../types/api';
import { patternDefinitionFor } from '../../data/patternDefinitions';
import { IconCheck, IconCode, IconBook, IconLayers } from '../icons/Icons';

interface AnnotatedTabProps {
  onLineFlash: (line: number) => void;
  onCommentFlash: (id: string) => void;
  pendingSave?: boolean;
  onDiscard?: () => void;
  onGoToReview?: () => void;
  stepNavigation?: ReactNode;
}

export default function AnnotatedTab({
  onLineFlash, onCommentFlash, pendingSave, onDiscard, onGoToReview, stepNavigation
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
  const [quickGuideOpen, setQuickGuideOpen] = useState('pattern');
  const [sidePanelTab, setSidePanelTab] = useState<'summary' | 'structure' | 'help'>('summary');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showOtherChoices, setShowOtherChoices] = useState(false);
  const [reviewHelpOpen, setReviewHelpOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    setShowOtherChoices(false);
    setReviewHelpOpen(false);
  }, [reviewIdx]);

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

  const reviewPatternNames = ['Singleton', 'Factory', 'Builder', 'Adapter', 'Proxy', 'Decorator'];
  const detectedPatternNames = new Set(
    (model.activePatterns || []).map(p => canonicalPatternName(p.patternName || p.patternId))
  );
  const topPatternNames = reviewPatternNames.filter(name => detectedPatternNames.has(name));
  const summaryPatternNames = topPatternNames.length > 0 ? topPatternNames : reviewPatternNames;
  const reviewItems = useMemo(() => {
    const names = new Set<string>([
      ...missingClassNames,
      ...Array.from(model.pickerEligibleClassNames),
      ...classNav.map(item => item.className),
    ]);
    for (const [className, node] of model.classes) {
      if (node.candidates.length > 1) names.add(className);
      if ((model.inScopePatterns.get(className)?.size || 0) > 1) names.add(className);
    }
    return Array.from(names).sort().map(className => {
      const node = model.classes.get(className);
      const scopePatterns = model.inScopePatterns.get(className);
      const candidates = Array.from(new Set([
        ...(node?.candidates || []),
        ...(scopePatterns ? Array.from(scopePatterns) : []),
      ])).filter(Boolean);
      const treeNode = classTree.find(item => item.className === className);
      const evidence = (treeNode?.children || [])
        .slice(0, 5)
        .map(child => ({
          line: child.line,
          text: child.rawText.trim() || 'Highlighted evidence line',
          patterns: child.taggedPatterns,
        }));
      const loc = model.classLocations.get(className);
      return {
        className,
        candidates: candidates.length > 0 ? candidates : ['Review'],
        resolved: resolvedMap[className] || node?.resolved || null,
        evidence,
        line: loc?.line || evidence[0]?.line || 1,
      };
    });
  }, [missingClassNames, model, classNav, classTree, resolvedMap]);
  const unresolvedReviewCount = reviewItems.filter(item => !item.resolved).length;
  const ambiguityCount = reviewItems.length || Math.max(missingCount, model.ambiguousLines.size);
  const reviewComplete = reviewItems.length > 0 && unresolvedReviewCount === 0;
  const verdictLabel = ambiguityCount > 0 && !reviewComplete ? 'Needs review' : 'Ready to continue';
  const resultSummary = ambiguityCount > 0 && !reviewComplete
    ? 'Some classes may match more than one pattern. Review them one by one before continuing.'
    : 'The main pattern evidence is ready. You can still inspect highlights, or continue to the next step.';
  const structureRows = Array.from(model.classes.values()).map(node => {
    const patterns = Array.from(new Set([
      ...node.candidates,
      ...(model.inScopePatterns.get(node.className) ? Array.from(model.inScopePatterns.get(node.className)!) : []),
    ])).filter(Boolean);
    const needsReview = reviewItems.some(item => item.className === node.className && !item.resolved);
    const loc = model.classLocations.get(node.className);
    return {
      className: node.className,
      patterns: patterns.length > 0 ? patterns : ['Review'],
      status: needsReview ? 'Needs review' : node.resolved ? 'Reviewed' : 'Matched',
      line: loc?.line || 1,
      evidence: classTree.find(item => item.className === node.className)?.children.slice(0, 4) || [],
    };
  }).sort((a, b) => a.className.localeCompare(b.className));
  const quickGuideItems = [
    {
      id: 'pattern',
      title: 'What is a design pattern?',
      body: 'A design pattern is a common way to organize code. It gives a name to a structure programmers use again and again.'
    },
    {
      id: 'ambiguous',
      title: 'What does ambiguous mean?',
      body: 'Ambiguous means the code has structure that could fit more than one pattern. Choose the pattern that best explains the class responsibility.'
    },
    {
      id: 'choose',
      title: 'How do I choose the best match?',
      body: 'Look at what the class is responsible for. A Proxy controls access, a Decorator adds behavior, and a Strategy swaps an algorithm or behavior.'
    },
    {
      id: 'next',
      title: 'What happens next?',
      body: 'After review, continue to Tests. The test step checks the submitted code using the existing validation flow.'
    }
  ];

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

  function openReviewForClass(className?: string): void {
    const targetIdx = className
      ? Math.max(0, reviewItems.findIndex(item => item.className === className))
      : Math.max(0, reviewItems.findIndex(item => !item.resolved));
    setReviewIdx(targetIdx < 0 ? 0 : targetIdx);
    setReviewOpen(true);
  }

  function moveReview(delta: number): void {
    if (reviewItems.length === 0) return;
    const next = ((reviewIdx + delta) % reviewItems.length + reviewItems.length) % reviewItems.length;
    setReviewIdx(next);
  }

  function chooseReviewPattern(className: string, patternKey: string): void {
    handlePickClass(className, patternKey);
  }

  function skipReviewItem(): void {
    if (reviewIdx < reviewItems.length - 1) {
      setReviewIdx(reviewIdx + 1);
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

  async function onCtaClick() {
    if (!currentRun) return;
    if (!reviewComplete && reviewItems.length > 0) {
      openReviewForClass();
      return;
    }
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

  const currentReviewItem = reviewItems[reviewIdx] || reviewItems[0] || null;
  const selectedReviewPattern = currentReviewItem
    ? (resolvedMap[currentReviewItem.className] || currentReviewItem.resolved || null)
    : null;
  const visibleReviewChoices = currentReviewItem
    ? currentReviewItem.candidates.slice(0, 4)
    : [];
  const hiddenReviewChoices = currentReviewItem
    ? currentReviewItem.candidates.slice(4)
    : [];
  const reviewEvidenceLines = currentReviewItem?.evidence.length
    ? currentReviewItem.evidence
    : currentReviewItem
      ? [{ line: currentReviewItem.line, text: `class ${currentReviewItem.className}`, patterns: currentReviewItem.candidates }]
      : [];
  const firstEvidenceLine = reviewEvidenceLines[0]?.line;
  const lastEvidenceLine = reviewEvidenceLines[reviewEvidenceLines.length - 1]?.line;
  const reviewEvidenceRange = firstEvidenceLine && lastEvidenceLine && firstEvidenceLine !== lastEvidenceLine
    ? `Lines ${firstEvidenceLine}-${lastEvidenceLine}`
    : firstEvidenceLine
      ? `Line ${firstEvidenceLine}`
      : 'Evidence lines';
  const suggestedPattern = currentReviewItem?.candidates[0] || null;
  function whyPatternMightMatch(patternName: string, className: string): string {
    const evidenceText = reviewEvidenceLines.map(item => item.text).join(' ').toLowerCase();
    const pattern = canonicalPatternName(patternName);
    if (pattern === 'Singleton') return evidenceText.includes('getinstance') || evidenceText.includes('delete')
      ? 'This class appears to expose shared access and limit copying.'
      : 'This may fit if the class controls one shared instance.';
    if (pattern === 'Factory') return 'This may fit if the class creates or chooses other objects for callers.';
    if (pattern === 'Builder') return 'This may fit if the class builds an object step by step before returning it.';
    if (pattern === 'Proxy') return 'This may fit if the class stands in front of another object and controls access.';
    if (pattern === 'Decorator') return 'This may fit if the class wraps another object to add behavior while keeping a similar interface.';
    if (pattern === 'Strategy') return 'This may fit if the class represents interchangeable behavior or an algorithm choice.';
    if (pattern === 'Adapter') return 'This may fit if the class makes one interface look like another interface.';
    return `${className} has structure that can be read as ${pattern}. Compare it with the code evidence before choosing.`;
  }
  const evidenceSummary = suggestedPattern
    ? `${currentReviewItem?.className || 'This class'} has evidence that could fit ${suggestedPattern}. Compare the class responsibility with each pattern meaning before choosing.`
    : 'Compare the class responsibility with the possible patterns before choosing.';
  const mainCtaLabel = reviewItems.length > 0 && !reviewComplete
    ? 'Review ambiguous matches'
    : ctaPhase === 'gdb'
      ? 'Continue to Tests'
      : ctaPhase === 'submit'
        ? 'Submit validation & save'
        : ctaPhase === 'review'
          ? 'Review before submission'
          : 'Continue';

  return (
    <div className="pattern-review-page">
      <section className="analysis-result-card" aria-label="Analysis result summary">
        <div className="analysis-result-card__status">
          <span className="analysis-result-card__icon" aria-hidden="true"><IconCheck size={24} /></span>
          <div>
            <p className="results-kicker">NeoTerritory Studio</p>
            <h3>Pattern Detection Result</h3>
            <p className="analysis-result-subtitle">
              NeoTerritory found possible design-pattern evidence in your C++ code.
            </p>
          </div>
          <span className={reviewComplete ? 'result-pill result-pill--matched' : 'result-pill result-pill--warning'}>
            {verdictLabel}
          </span>
        </div>
        <div className="analysis-result-card__body">
          <div>
            <span className="summary-label">File analyzed</span>
            <strong className="summary-file">{activeFile?.name || currentRun.sourceName || 'snippet.cpp'}</strong>
          </div>
          <div className="summary-metrics">
            <span><strong>{patternCount}</strong> possible patterns found</span>
            <span><strong>{commentCount}</strong> code comments/highlights</span>
            <span><strong>{ambiguityCount}</strong> ambiguous matches</span>
          </div>
          <p>{resultSummary}</p>
          <div className="summary-chip-row">
            <span className="summary-pattern-chip summary-pattern-chip--detected">Patterns detected</span>
            <span className="tag-progress-pill tag-progress-pill--tagged">{taggedCount || totalClasses} classes tagged</span>
            <span className="tag-progress-pill tag-progress-pill--missing">{ambiguityCount} ambiguous matches</span>
            {!reviewComplete && <span className="tag-progress-pill tag-progress-pill--missing">Needs review</span>}
            {reviewComplete && <span className="tag-progress-pill tag-progress-pill--tagged">Ready to continue</span>}
          </div>
        </div>
      </section>

      {stepNavigation}

      {reviewItems.length > 0 && !reviewComplete && (
        <section className="ambiguous-cta-card" aria-label="Ambiguous review">
          <div>
            <p className="results-kicker">Needs your review</p>
            <h3>Ambiguous matches need review</h3>
            <p>
              Some classes match more than one possible design pattern. Review them one by one and choose the best match.
            </p>
            <strong>{unresolvedReviewCount} item{unresolvedReviewCount === 1 ? '' : 's'} to review</strong>
          </div>
          <div className="ambiguous-cta-card__actions">
            <button type="button" className="primary-btn" onClick={() => openReviewForClass()}>
              Review ambiguous matches
            </button>
          </div>
        </section>
      )}

      <div className="tab-annotated-shell">
        <section className="tab-panel tab-annotated">
          <header className="results-header">
            <div>
              <p className="results-kicker">Evidence</p>
              <h3>Code Highlights</h3>
              <p className="results-summary">
                Highlighted lines show the code evidence used for possible pattern detection.
              </p>
            </div>
          {aiStatus === 'pending' && (
            <span className="ai-pill ai-pill-pending" aria-live="polite">
              AI commentary loading…
            </span>
          )}
          {aiStatus === 'failed' && (
            <span className="ai-pill ai-pill-failed">AI commentary failed</span>
          )}
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
            onReviewAmbiguousLine={(className) => openReviewForClass(className)}
          />
        </div>
        <div className="review-code-legend">
          <PatternLegend legendPatterns={summaryPatternNames} />
          <span className="legend-chip legend-chip--ambiguous">
            <span className="legend-dot" />
            Ambiguous
          </span>
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
        <section className="review-side-card beginner-side-panel">
          <div className="side-tabs" role="tablist" aria-label="Pattern review details">
            {[
              ['summary', 'Summary'],
              ['structure', 'Code Structure'],
              ['help', 'Help'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={sidePanelTab === id}
                className={`side-tab ${sidePanelTab === id ? 'is-active' : ''}`}
                onClick={() => setSidePanelTab(id as 'summary' | 'structure' | 'help')}
              >
                {label}
              </button>
            ))}
          </div>

          {sidePanelTab === 'summary' && (
            <div className="side-panel-body">
              <div className="review-side-card__head">
                <span className="review-side-icon" aria-hidden="true"><IconLayers size={18} /></span>
                <div>
                  <p className="results-kicker">Quick Summary</p>
                  <h3>What NeoTerritory found</h3>
                </div>
              </div>
              <div className="summary-chip-row">
                {summaryPatternNames.slice(0, 6).map(name => {
                  const c = colorFor(name);
                  return (
                    <span key={name} className="summary-pattern-chip" style={{ borderColor: c.border, color: c.text, background: c.bg }}>
                      {name}
                    </span>
                  );
                })}
              </div>
              <p className="side-next-step">
                Next step: {reviewComplete || reviewItems.length === 0 ? 'Continue to Tests.' : 'Review ambiguous matches before moving to Tests.'}
              </p>
              <button type="button" className="primary-btn" onClick={onCtaClick}>
                {mainCtaLabel}
              </button>
            </div>
          )}

          {sidePanelTab === 'structure' && (
            <div className="side-panel-body">
              <div className="review-side-card__head">
                <span className="review-side-icon" aria-hidden="true"><IconCode size={18} /></span>
                <div>
                  <p className="results-kicker">Optional Details</p>
                  <h3>Code Structure</h3>
                </div>
              </div>
              <div className="structure-list">
                {structureRows.map(item => (
                  <details key={item.className} className={`structure-item-detail ${item.status === 'Needs review' ? 'structure-item-detail--warning' : ''}`}>
                    <summary>
                      <span className="structure-item__abbr">{item.className.slice(0, 2)}</span>
                      <span>
                        <strong>{item.className}</strong>
                        <small>Possible pattern{item.patterns.length === 1 ? '' : 's'}: {item.patterns.join(', ')}</small>
                      </span>
                      <span className={`result-pill ${item.status === 'Needs review' ? 'result-pill--warning' : 'result-pill--matched'}`}>
                        {item.status}
                      </span>
                    </summary>
                    <div className="structure-detail-body">
                      {item.evidence.length > 0 ? item.evidence.map(child => (
                        <button key={`${item.className}-${child.line}`} type="button" onClick={() => onLineFlash(child.line)}>
                          Line {child.line}: {child.rawText.trim() || 'Evidence line'}
                        </button>
                      )) : (
                        <button type="button" onClick={() => onLineFlash(item.line)}>View evidence</button>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {sidePanelTab === 'help' && (
            <div className="side-panel-body">
              <h3 className="quick-guide__title">
                <span className="quick-guide__title-icon" aria-hidden="true"><IconBook size={18} /></span>
                Help
              </h3>
              {quickGuideItems.map((item, index) => {
                const open = quickGuideOpen === item.id;
                return (
                  <div key={item.id} className={`quick-guide__item ${open ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="quick-guide__item-head"
                      aria-expanded={open}
                      onClick={() => setQuickGuideOpen(item.id)}
                    >
                      <span className="quick-guide__item-num">{index + 1}</span>
                      {item.title}
                      <span className="quick-guide__item-chevron" aria-hidden="true">⌄</span>
                    </button>
                    {open && (
                      <div className="quick-guide__item-body">
                        <p>{item.body}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </aside>
      </div>

      {reviewOpen && currentReviewItem && (
        <div className="review-drawer-backdrop" role="dialog" aria-modal="true" aria-label="Review ambiguous match">
          <section className="review-drawer">
            <header className="review-drawer__head">
              <div>
                <p className="results-kicker">Review match {reviewIdx + 1} of {reviewItems.length}</p>
                <h3>{currentReviewItem.className}</h3>
                <p>
                  Choose the pattern that best explains this code.
                </p>
              </div>
              <button type="button" className="ghost-btn" onClick={() => setReviewOpen(false)}>Close</button>
            </header>
            <div className="review-drawer__grid">
              <section className="review-evidence-panel">
                <div className="review-column-head">
                  <p className="results-kicker">Code evidence</p>
                  <h4>Code evidence</h4>
                  <p>These lines are why NeoTerritory marked this class as ambiguous.</p>
                </div>
                <p className="review-evidence-summary">{evidenceSummary}</p>
                <div className="review-code-frame" aria-label={`Code evidence for ${currentReviewItem.className}`}>
                  <div className="review-code-frame__range">{reviewEvidenceRange}</div>
                  <pre>
                    {reviewEvidenceLines.map(item => (
                      <button
                        key={`${currentReviewItem.className}-${item.line}`}
                        type="button"
                        className="review-code-line"
                        onClick={() => onLineFlash(item.line)}
                      >
                        <span>{String(item.line).padStart(4, ' ')}</span>
                        <code>{item.text || 'Highlighted evidence line'}</code>
                      </button>
                    ))}
                  </pre>
                </div>
                <div className="review-evidence-notes">
                  <h5>Evidence notes</h5>
                  <ul>
                    {reviewEvidenceLines.slice(0, 4).map(item => (
                      <li key={`note-${item.line}`}>
                        Line {item.line}: {item.patterns.length > 0 ? item.patterns.join(' or ') : 'possible pattern evidence'}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="review-choice-panel">
                <div className="review-column-head">
                  <p className="results-kicker">Pattern choices</p>
                  <h4>Choose the best pattern</h4>
                  <p>Pick the pattern that best describes what this class is doing.</p>
                </div>

                {suggestedPattern && (
                  <span className="review-recommended-label">Suggested by current evidence</span>
                )}

                <div className="review-choice-list">
                  {[...visibleReviewChoices, ...(showOtherChoices ? hiddenReviewChoices : [])].map((candidate, index) => {
                    const def = patternDefinitionFor(candidate);
                    const selected = selectedReviewPattern === candidate;
                    const recommended = candidate === suggestedPattern && index === 0;
                    return (
                      <article
                        key={candidate}
                        className={`review-choice ${selected ? 'is-selected' : ''}`}
                      >
                        <div className="review-choice__topline">
                          <strong>{candidate}</strong>
                          {recommended && <span>Recommended</span>}
                          {selected && <span className="review-choice__selected">Selected</span>}
                        </div>
                        <p><b>Meaning:</b> {def?.oneLiner || 'A possible pattern match found in this class.'}</p>
                        <p><b>Why it might match:</b> {whyPatternMightMatch(candidate, currentReviewItem.className)}</p>
                        <button
                          type="button"
                          className={selected ? 'primary-btn' : 'ghost-btn'}
                          onClick={() => chooseReviewPattern(currentReviewItem.className, candidate)}
                        >
                          {selected ? 'Selected' : `Choose ${candidate}`}
                        </button>
                      </article>
                    );
                  })}
                </div>

                {hiddenReviewChoices.length > 0 && (
                  <button
                    type="button"
                    className="review-show-other"
                    onClick={() => setShowOtherChoices(value => !value)}
                  >
                    {showOtherChoices ? 'Hide other possible patterns' : `Show ${hiddenReviewChoices.length} other possible pattern${hiddenReviewChoices.length === 1 ? '' : 's'}`}
                  </button>
                )}

                <details className="review-help-note" open={reviewHelpOpen} onToggle={(event) => setReviewHelpOpen(event.currentTarget.open)}>
                  <summary>How do I choose?</summary>
                  <p>
                    Look at the class responsibility. If it creates objects, it may be Factory or Builder.
                    If it controls one shared instance, it may be Singleton. If it wraps another object, it may be Proxy or Decorator.
                  </p>
                </details>
              </section>
            </div>
            <footer className="review-drawer__actions">
              <button type="button" className="ghost-btn" onClick={() => moveReview(-1)}>Previous</button>
              <button type="button" className="ghost-btn" onClick={() => skipReviewItem()}>Skip this item</button>
              <button type="button" className="ghost-btn" onClick={() => moveReview(1)}>
                {selectedReviewPattern ? 'Next match' : 'Skip and continue'}
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  if (unresolvedReviewCount === 0 || reviewIdx >= reviewItems.length - 1) setReviewOpen(false);
                  else moveReview(1);
                }}
              >
                {reviewIdx >= reviewItems.length - 1 ? 'Finish review' : selectedReviewPattern ? 'Next match' : 'Finish review'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
