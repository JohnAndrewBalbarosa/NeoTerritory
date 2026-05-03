import React, { useState } from 'react';
import {
  DetectedPatternFull, AmbiguityRanking, PatternRankEntry,
  ClassUsageBinding, DocumentationTarget, UnitTestTarget, PatternEducation
} from '../../types/api';
import { colorFor, USAGE_KIND_LABEL, ensureReadableContrast } from '../../lib/patterns';
import { patternDefinitionFor, PatternDefinition } from '../../data/patternDefinitions';
import { TaggedClassEntry } from '../../lib/annotatedModel';

export interface RecomputedRank {
  k: number;
  n: number;
  finalRank: number;
}

interface PatternCardsProps {
  detectedPatterns: DetectedPatternFull[];
  ranking: AmbiguityRanking | null;
  userResolvedPattern?: string | null;
  classResolvedPatterns?: Record<string, string>;
  ambiguousClassNames?: Set<string>;
  recomputedRanksByClass?: Record<string, RecomputedRank>;
  classUsageBindings: Record<string, ClassUsageBinding[]>;
  classUsageBindingSource: 'heuristic' | 'microservice';
  // Tagged-class masterlist (per-class). When supplied alongside the
  // revert handlers below, each card grows a small "↺ Revert" chip
  // that toggles `revertedClasses` in the store. The card stays
  // visible regardless of revert state — revert affects the model's
  // resolved/cascade view, not whether a card renders.
  workingMasterlist?: Map<string, TaggedClassEntry>;
  originalMasterlist?: Map<string, TaggedClassEntry>;
  revertedClasses?: Set<string>;
  onToggleRevert?: (className: string) => void;
  onLineFlash?: (line: number) => void;
}

interface CardProps {
  pattern: DetectedPatternFull;
  rank?: PatternRankEntry;
  rankVerdict?: string;
  resolved: boolean;
  isAmbiguousUnresolved: boolean;
  // True when this class was originally ambiguous and the user has now
  // resolved it via the source-view rival picker. Drives whether the
  // accuracy rank-bar is shown — per the user's rule, accuracy is only
  // meaningful AFTER a human has committed to a tag for an ambiguous
  // class. Cards for never-ambiguous classes hide the bar entirely.
  wasAmbiguousNowResolved: boolean;
  recomputed?: RecomputedRank;
  taggedUsages: ClassUsageBinding[];
  classUsageBindingSource: 'heuristic' | 'microservice';
  // Per-class revert affordance. Provided when the parent component
  // wires the masterlist; absent in legacy callers. The chip in the
  // head reflects revert state and toggles via onToggleRevert.
  isReverted?: boolean;
  isDirty?: boolean;
  onToggleRevert?: () => void;
  onLineFlash?: (line: number) => void;
}

function RowButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" className="pattern-row" onClick={onClick}>{children}</button>;
}

// Top-of-list banner shown ONCE above all PatternCards. Holds the formula
// prose and citations so each card can stay terse and only show its own
// numbers. Defined in module scope so it does not re-mount per card.
function ScoringExplainerBanner() {
  const [open, setOpen] = useState(false);
  return (
    <div className="scoring-explainer-banner">
      <div className="scoring-explainer-banner-head">
        <strong>How is the accuracy calculated?</strong>
        <span className="scoring-explainer-banner-summary">
          Wilson 95%-confidence lower bound on per-line wins. Each non-blank
          line in a class is one Bernoulli trial; the pattern wins the line
          when its signal hits outweigh rival hits plus negative-signal weight.
        </span>
        <button
          type="button"
          className="scoring-explainer-toggle"
          onClick={() => setOpen(o => !o)}
        >
          {open ? '▾ Hide formula' : '▸ Show formula'}
        </button>
      </div>
      {open && (
        <div className="scoring-explainer-body">
          <p>
            <code>n</code> = number of non-blank, non-comment lines in the
            class&apos;s scope. <code>k</code> = how many of those lines this
            pattern won. <code>p̂ = k / n</code>. With <code>z = 1.96</code>
            (the 95% confidence z-score):
          </p>
          <p>
            <code>
              wilsonLower = ( p̂ + z²/(2n) − z·√(p̂(1−p̂)/n + z²/(4n²)) ) / (1 + z²/n)
            </code>
          </p>
          <p>
            Wilson is the textbook conservative estimator for a yes/no proportion
            when the sample is small — wider margin of error when fewer lines
            have evidence, narrower as more lines confirm.
            <strong> confidence</strong> blends class_fit (1.0 once the structural
            matcher confirms the shape) with this Wilson score using the
            pattern&apos;s authored ranking weights.
          </p>
          <p className="scoring-citation">
            Wilson (1927), JASA 22(158); Agresti &amp; Coull (1998), Am. Stat 52(2).
            95% confidence is the standard reporting convention. The same lower-bound
            is widely cited as a ranking score — see Evan Miller,{' '}
            <em>How Not to Sort by Average Rating</em> (2009).
          </p>
        </div>
      )}
    </div>
  );
}

// Per-card numeric trace. Shows the live n/k/p̂/Wilson values, names the
// class, and lists the winning lines as clickable chips that flash to the
// matched source line through the existing onLineFlash callback. No formula
// prose here — that lives in the banner above.
function ScoringExplainer({
  rank, pattern, onLineFlash
}: {
  rank: PatternRankEntry;
  pattern: DetectedPatternFull;
  onLineFlash?: (line: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const conf = Math.round((rank.finalRank || 0) * 100);
  const fit  = Math.round((rank.implementationFit || 0) * 100);
  const le = rank.lineEvidence;
  const className = pattern.className || 'this class';
  const docLines = (pattern.documentationTargets || [])
    .map(t => t.line)
    .filter((l): l is number => typeof l === 'number');
  const minLine = docLines.length ? Math.min(...docLines) : null;
  const maxLine = docLines.length ? Math.max(...docLines) : null;
  const wins = (le?.byLine || []).filter(b => b.win);
  return (
    <div className="scoring-explainer">
      <button type="button" className="scoring-explainer-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▾' : '▸'} Show numbers
      </button>
      {open && (
        <div className="scoring-explainer-body scoring-explainer-body--compact">
          {le ? (
            <>
              <p>
                <strong>For {className}</strong>
                {minLine && maxLine ? (minLine === maxLine
                  ? <> on line {minLine}</>
                  : <> across lines {minLine}–{maxLine}</>) : null}:
                {' '}<code>n = {le.trials}</code> non-blank lines,{' '}
                <code>k = {le.successes}</code> won by this pattern,{' '}
                <code>p̂ = {le.pHat.toFixed(3)}</code>,{' '}
                <code>z = {le.z.toFixed(2)}</code>,{' '}
                <code>Wilson = {(le.wilsonLowerBound * 100).toFixed(1)}%</code>{' '}
                → shown as <strong>usage match {fit}%</strong>.{' '}
                <strong>confidence {conf}%</strong> blends Wilson with class_fit
                under the pattern&apos;s authored weights.
              </p>
              {wins.length > 0 && (
                <p className="scoring-explainer-wins">
                  Winning lines (own / rival / opposing weight):{' '}
                  {wins.map((b, i) => (
                    <button
                      key={b.line}
                      type="button"
                      className="scoring-explainer-line-chip"
                      onClick={() => onLineFlash?.(b.line)}
                      title={`Line ${b.line} — ownHits ${b.ownHits} / rival ${b.rivalHits} / negW ${b.opposingWeight.toFixed(2)}`}
                    >
                      L{b.line}
                      {i < wins.length - 1 ? '' : ''}
                    </button>
                  ))}
                </p>
              )}
              {le.negativeHits > 0 && (
                <p className="scoring-explainer-meta">
                  Negative signals fired: {le.negativeHits} (catalog-authored opposing weight reduced k by that line count).
                </p>
              )}
            </>
          ) : (
            <p>
              <strong>structure only</strong> — the pattern has no
              implementation_template authored yet, so we matched on class
              shape without per-line wins. <strong>confidence {conf}%</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ExplainSection({
  patternName, education, definition
}: {
  patternName: string;
  education?: PatternEducation;
  definition: PatternDefinition | null;
}) {
  // AI explanation wins over the static table when present. Static is the
  // offline/fallback layer so cards always have something to teach.
  const useAi = !!education;
  if (!useAi && !definition) return null;
  return (
    <div className="pattern-card-section pattern-card-explain">
      <h4>
        What is {patternName}?
        <span className={`explain-source-pill ${useAi ? 'is-ai' : 'is-static'}`}>
          {useAi ? 'AI explanation' : 'Built-in guide'}
        </span>
      </h4>
      {useAi ? (
        <div className="explain-body">
          <p>{education!.explanation}</p>
          {education!.whyThisFired && (
            <p><strong>Why this fired here:</strong> {education!.whyThisFired}</p>
          )}
          {education!.studyHint && (
            <p><strong>Where to look first:</strong> {education!.studyHint}</p>
          )}
        </div>
      ) : (
        <div className="explain-body">
          <p>{definition!.oneLiner}</p>
          {definition!.whenToUse && (
            <p><strong>When to use it:</strong> {definition!.whenToUse}</p>
          )}
          {definition!.realWorldAnalogy && (
            <p><strong>Everyday analogy:</strong> {definition!.realWorldAnalogy}</p>
          )}
          {definition!.watchOuts && (
            <p><strong>Watch out:</strong> {definition!.watchOuts}</p>
          )}
        </div>
      )}
    </div>
  );
}

function FunctionsSection({ fns, onLineFlash }: { fns: UnitTestTarget[]; onLineFlash?: (l: number) => void }) {
  if (!fns.length) return null;
  return (
    <div className="pattern-card-section">
      <h4 title="Methods worth covering with unit tests">Methods to test</h4>
      <div className="pattern-row-list">
        {fns.map((t, i) => (
          <RowButton key={i} onClick={() => onLineFlash?.(t.line)}>
            <code>{t.function_name || '?'}</code>
            <span className="row-kind">{t.branch_kind || 'fn'}</span>
            <span className="row-line">line {t.line || '?'}</span>
          </RowButton>
        ))}
      </div>
    </div>
  );
}

function AnchorsSection({ docs, onLineFlash }: { docs: DocumentationTarget[]; onLineFlash?: (l: number) => void }) {
  if (!docs.length) return null;
  return (
    <div className="pattern-card-section">
      <h4 title="Specific code shapes that signaled this pattern">Key landmarks in the code</h4>
      <div className="pattern-row-list">
        {docs.map((d, i) => (
          <RowButton key={i} onClick={() => onLineFlash?.(d.line)}>
            <code>{d.label || '?'}</code>
            <span className="row-kind">{d.lexeme || ''}</span>
            <span className="row-line">line {d.line || '?'}</span>
          </RowButton>
        ))}
      </div>
    </div>
  );
}

function UsagesSection({ rank, onLineFlash }: { rank?: PatternRankEntry; onLineFlash?: (l: number) => void }) {
  const cs = rank?.evidence?.callsites || [];
  return (
    <div className="pattern-card-section">
      <h4 title="Lines where the class is actually used like this pattern">Where the pattern actually fires</h4>
      {cs.length ? (
        <div className="pattern-row-list">
          {cs.map((hit, i) => (
            <RowButton key={i} onClick={() => onLineFlash?.(hit.line)}>
              <code>{hit.snippet || ''}</code>
              <span className="row-line">line {hit.line || '?'}</span>
            </RowButton>
          ))}
        </div>
      ) : (
        <div className="pattern-card-pending">
          {rank?.hasImplementationTemplate
            ? 'We can see the shape of the pattern in this class, but no usage of it in this file yet.'
            : 'No usage examples are catalogued for this pattern yet — we matched it on structure only.'}
        </div>
      )}
    </div>
  );
}

function TaggedUsagesSection({
  className, taggedUsages, sourceTag, onLineFlash
}: {
  className: string;
  taggedUsages: ClassUsageBinding[];
  sourceTag: string;
  onLineFlash?: (l: number) => void;
}) {
  const sourceTitle = sourceTag === 'microservice'
    ? 'Found by the structural matcher service'
    : 'Found by the lightweight built-in matcher';
  return (
    <div className="pattern-card-section">
      <h4>
        Where this class shows up in the code
        <span className="usage-source-icon" title={sourceTitle} aria-label={sourceTitle}>i</span>
      </h4>
      {taggedUsages.length ? (
        <div className="pattern-row-list">
          {taggedUsages.map((u, i) => {
            const label = USAGE_KIND_LABEL[u.kind] || u.kind;
            const target = u.varName
              ? `${u.varName}${u.methodName ? '.' + u.methodName : ''}`
              : (u.methodName ? `${u.boundClass}::${u.methodName}` : (u.boundClass || ''));
            return (
              <RowButton key={i} onClick={() => onLineFlash?.(u.line)}>
                <span className="row-kind">{label}</span>
                <code>{target}</code>
                {u.evidence && <span className="row-kind" title={u.evidence}>{u.evidence}</span>}
                <span className="row-line">line {u.line || '?'}</span>
              </RowButton>
            );
          })}
        </div>
      ) : (
        <div className="pattern-card-pending">{className} is not used anywhere else in this file.</div>
      )}
    </div>
  );
}

function PatternCard(props: CardProps) {
  const {
    pattern: p, rank, rankVerdict, resolved, isAmbiguousUnresolved,
    wasAmbiguousNowResolved, recomputed, taggedUsages,
    classUsageBindingSource, isReverted, isDirty, onToggleRevert, onLineFlash,
  } = props;
  // Accuracy rank-bar only renders when the class is genuinely
  // ambiguous (waiting for a pick) or has been resolved-after-ambiguity.
  // Never-ambiguous classes were locked in by the matcher from the start
  // — there is nothing to score against, so we hide the bar entirely.
  const showAccuracy = isAmbiguousUnresolved || wasAmbiguousNowResolved;
  const baseColour = colorFor(p.patternName || 'default');
  // Lift the badge text against the current surface so the label stays
  // readable in dark mode without re-authoring the palette per theme.
  const colour = {
    ...baseColour,
    text: ensureReadableContrast(baseColour.text, 4.5)
  };
  const declarationLine = p.documentationTargets?.[0]?.line || null;
  const sourceTag = classUsageBindingSource === 'microservice' ? 'microservice-bound' : 'heuristic';
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`pattern-card ${expanded ? 'pattern-card--open' : 'pattern-card--collapsed'}`}
      data-resolved={resolved ? 'true' : undefined}
    >
      <button
        type="button"
        className="pattern-card-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="pattern-card-head">
          <span className="pattern-badge" style={{ borderColor: colour.border, background: colour.bg, color: colour.text }}>
            {p.patternName || p.patternId}
          </span>
          <span className="pattern-card-class"><code>{p.className || 'unknown'}</code></span>
          {declarationLine && <span className="pattern-card-line">line {declarationLine}</span>}
          {onToggleRevert && (isReverted || isDirty) && (
            <span
              role="button"
              tabIndex={0}
              className={`pattern-card-revert${isReverted ? ' pattern-card-revert--on' : ''}`}
              title={
                isReverted
                  ? 'This class is currently reverted to its original masterlist entry. Click to remove the revert and follow the live cascade again.'
                  : 'Restore this class to its original masterlist entry (cancels picks and cascade-driven changes for this one class only).'
              }
              onClick={(e) => { e.stopPropagation(); onToggleRevert(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleRevert();
                }
              }}
            >
              {isReverted ? '↺ Reverted' : '↺ Revert'}
            </span>
          )}
        </div>
        <span className="pattern-card-chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="pattern-card-body">
          {!showAccuracy ? null : isAmbiguousUnresolved ? (
            <div className="rank-bar rank-bar--unknown" data-verdict="unknown">
              <span title="The user has not yet picked a pattern for this class — the popover on the class declaration line offers the options">confidence</span>
              <div className="rank-bar-track">
                <div className="rank-bar-fill rank-bar-fill--unknown" style={{ width: '100%' }} />
              </div>
              <span>?%</span>
              <span title="Pick a pattern in the source view to see numbers">awaiting pick</span>
            </div>
          ) : rank ? (
            <>
              <div className="rank-bar" data-verdict={rankVerdict || 'no_clear_pattern'}>
                <span title="How sure the matcher is that this class is this pattern">confidence</span>
                <div className="rank-bar-track">
                  <div className="rank-bar-fill" style={{ width: `${Math.round(((recomputed?.finalRank ?? rank.finalRank) || 0) * 100)}%` }} />
                </div>
                <span>{Math.round(((recomputed?.finalRank ?? rank.finalRank) || 0) * 100)}%</span>
                {recomputed
                  ? (
                    <span title="Recomputed from your pick: k = lines inside the class declaration that match the chosen pattern, n = total lines in the class">
                      k = {recomputed.k} / n = {recomputed.n}
                    </span>
                  )
                  : rank.hasImplementationTemplate
                    ? (
                      <span title="How well the class is actually used like this pattern, not just shaped like one">
                        usage match {Math.floor((rank.implementationFit || 0) * 100)}%
                      </span>
                    )
                    : (
                      <span title="We can see the shape, but no usage examples are catalogued for this pattern yet">
                        structure only
                      </span>
                    )}
              </div>
              <ScoringExplainer rank={rank} pattern={p} onLineFlash={onLineFlash} />
            </>
          ) : (
            <div className="rank-bar" data-verdict="confident">
              <span>confidence</span>
              <div className="rank-bar-track">
                <div className="rank-bar-fill" style={{ width: '100%' }} />
              </div>
              <span>100%</span>
              <span title="No rival patterns were offered for this class — automatic 100%">unambiguous</span>
            </div>
          )}
          <ExplainSection
            patternName={p.patternName || p.patternId || 'this pattern'}
            education={p.patternEducation}
            definition={patternDefinitionFor(p.patternName || p.patternId || '')}
          />
          <FunctionsSection fns={p.unitTestTargets || []} onLineFlash={onLineFlash} />
          <AnchorsSection docs={p.documentationTargets || []} onLineFlash={onLineFlash} />
          <UsagesSection rank={rank} onLineFlash={onLineFlash} />
          <TaggedUsagesSection
            className={p.className || 'unknown'}
            taggedUsages={taggedUsages}
            sourceTag={sourceTag}
            onLineFlash={onLineFlash}
          />
        </div>
      )}
    </div>
  );
}

// Compare two masterlist entries to decide whether the working entry
// has diverged from original — drives whether the per-class Revert
// chip is shown for non-reverted classes.
function entriesDiffer(a: TaggedClassEntry | undefined, b: TaggedClassEntry | undefined): boolean {
  if (!a || !b) return !!a !== !!b;
  if (a.parent !== b.parent) return true;
  if (a.patterns.length !== b.patterns.length) return true;
  for (let i = 0; i < a.patterns.length; i += 1) if (a.patterns[i] !== b.patterns[i]) return true;
  if (a.subclasses.length !== b.subclasses.length) return true;
  for (let i = 0; i < a.subclasses.length; i += 1) if (a.subclasses[i] !== b.subclasses[i]) return true;
  return false;
}

export default function PatternCards(props: PatternCardsProps) {
  const {
    detectedPatterns, ranking, userResolvedPattern, classResolvedPatterns,
    ambiguousClassNames, recomputedRanksByClass,
    classUsageBindings, classUsageBindingSource,
    workingMasterlist, originalMasterlist, revertedClasses, onToggleRevert,
    onLineFlash
  } = props;
  if (!detectedPatterns.length) return <div id="pattern-cards" />;
  const ranksById = new Map<string, PatternRankEntry>();
  (ranking?.ranks || []).forEach(r => ranksById.set(r.patternId, r));
  const ambiguous = ambiguousClassNames || new Set<string>();
  const resolvedClasses = classResolvedPatterns || {};
  const recomputed = recomputedRanksByClass || {};

  // Two stacks under a single pattern-cards-decided section:
  //   - ambiguous: classes whose scope holds rival patterns. Includes
  //     both "still awaiting a pick" and "already resolved by user".
  //     The accuracy bar appears for every card here, but only carries
  //     a real number AFTER the user has resolved (recomputed Wilson
  //     rank from the chosen pattern vs per-line evidence). Until then
  //     the bar reads "?% awaiting pick".
  //   - unambiguous: classes the matcher locked in from the start. No
  //     rivals, no accuracy bar — there's nothing to score against.
  //
  // Membership in the ambiguous stack uses the broad ambiguousClassNames
  // set (directAmbiguous || bodyAmbiguous || scopeAmbiguous) UNION the
  // resolved set, since resolution removes a class from
  // ambiguousClassNames but the card should still live alongside the
  // other ambiguous cards (now showing its real accuracy).
  // Collapse ambiguous-pending classes into a SINGLE "Review" card per
  // class instead of one card per rival tag. The user has not committed
  // to any of them, so showing N cards (one per pattern) creates
  // duplicate-looking entries. Resolved classes still show one card —
  // the chosen pattern. Unambiguous classes still show one card per
  // distinct (className, patternId) tuple.
  const ambiguousReviewByClass = new Map<string, DetectedPatternFull[]>();
  const ambiguousResolvedCards: DetectedPatternFull[] = [];
  const unambiguousCards: DetectedPatternFull[] = [];
  for (const p of detectedPatterns) {
    const cls = p.className || '';
    const isAmbiguousNow     = !!cls && ambiguous.has(cls);
    const resolvedChoice     = cls ? resolvedClasses[cls] : undefined;
    const wasResolvedFromAmb = !!resolvedChoice;
    if (wasResolvedFromAmb) {
      const matchesPick =
        p.patternId === resolvedChoice ||
        p.patternName === resolvedChoice;
      if (!matchesPick) continue;
      ambiguousResolvedCards.push(p);
      continue;
    }
    if (isAmbiguousNow) {
      if (!ambiguousReviewByClass.has(cls)) ambiguousReviewByClass.set(cls, []);
      ambiguousReviewByClass.get(cls)!.push(p);
      continue;
    }
    unambiguousCards.push(p);
  }

  function renderCard(p: DetectedPatternFull, opts: { isAmbiguousUnresolved: boolean; wasAmbiguousNowResolved: boolean }) {
    const cls = p.className || '';
    const recomputedRank = cls ? recomputed[cls] : undefined;
    const isReverted = !!(cls && revertedClasses?.has(cls));
    const isDirty = !!(
      cls
      && workingMasterlist
      && originalMasterlist
      && entriesDiffer(workingMasterlist.get(cls), originalMasterlist.get(cls))
    );
    return (
      <PatternCard
        key={p.patternId + cls}
        pattern={p}
        rank={ranksById.get(p.patternId)}
        rankVerdict={ranking?.verdict}
        resolved={!!(userResolvedPattern && userResolvedPattern === p.patternId)}
        isAmbiguousUnresolved={opts.isAmbiguousUnresolved}
        wasAmbiguousNowResolved={opts.wasAmbiguousNowResolved}
        recomputed={recomputedRank}
        taggedUsages={(p.className && classUsageBindings[p.className]) || []}
        classUsageBindingSource={classUsageBindingSource}
        isReverted={isReverted}
        isDirty={isDirty}
        onToggleRevert={cls && onToggleRevert ? () => onToggleRevert(cls) : undefined}
        onLineFlash={onLineFlash}
      />
    );
  }

  const reviewClasses = Array.from(ambiguousReviewByClass.keys());
  const totalAmbiguous = reviewClasses.length + ambiguousResolvedCards.length;

  return (
    <div id="pattern-cards" className="pattern-cards">
      <ScoringExplainerBanner />
      <section className="pattern-cards-decided">
        {totalAmbiguous > 0 && (
          <>
            <h3 className="pattern-cards-section-head" title="Classes the matcher saw rival patterns for. Pick a pattern in the source view to surface a real accuracy number; until then the bar reads '?% awaiting pick'.">
              Ambiguous — {reviewClasses.length} awaiting your tag
            </h3>
            {reviewClasses.map(cls => {
              const rivals = ambiguousReviewByClass.get(cls) || [];
              return (
                <ReviewCard
                  key={`review-${cls}`}
                  className={cls}
                  rivals={rivals}
                />
              );
            })}
            {ambiguousResolvedCards.map(p =>
              renderCard(p, {
                isAmbiguousUnresolved: false,
                wasAmbiguousNowResolved: true,
              }),
            )}
          </>
        )}
        {unambiguousCards.length > 0 && (
          <>
            <h3 className="pattern-cards-section-head" title="Classes the matcher locked in from the start — no rival patterns were detected, so there's nothing to score against.">
              Unambiguous
            </h3>
            {unambiguousCards.map(p => renderCard(p, { isAmbiguousUnresolved: false, wasAmbiguousNowResolved: false }))}
          </>
        )}
      </section>
    </div>
  );
}

// Single "Review" card per ambiguous-pending class. Replaces what used
// to be N rival cards (one per tag) with a single placeholder until the
// user picks. Lists the rivals so the user knows what they're choosing
// between.
function ReviewCard({ className, rivals }: { className: string; rivals: DetectedPatternFull[] }) {
  const declarationLine = rivals[0]?.documentationTargets?.[0]?.line || null;
  const rivalNames = Array.from(new Set(
    rivals.map(p => p.patternName || p.patternId).filter(Boolean),
  ));
  return (
    <div className="pattern-card pattern-card--review">
      <div className="pattern-card-head">
        <span
          className="pattern-badge pattern-badge--review"
          title="No pick yet — open the source view and choose a pattern on this class's declaration line"
        >
          Review
        </span>
        <span className="pattern-card-class"><code>{className}</code></span>
        {declarationLine && <span className="pattern-card-line">line {declarationLine}</span>}
      </div>
      <div className="pattern-card-review-body">
        <p className="pattern-card-review-hint">
          Awaiting your pick. Open the source view and choose a pattern on this
          class's declaration line.
        </p>
        <div className="pattern-card-review-rivals">
          {rivalNames.map(name => {
            const c = colorFor(name);
            return (
              <span
                key={name}
                className="pattern-card-review-rival"
                style={{ borderColor: c.border, color: c.text, background: c.bg }}
              >
                {name}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
