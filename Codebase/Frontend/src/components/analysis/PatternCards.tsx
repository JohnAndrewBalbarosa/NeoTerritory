import React, { useState } from 'react';
import {
  DetectedPatternFull, AmbiguityRanking, PatternRankEntry,
  ClassUsageBinding, DocumentationTarget, UnitTestTarget, PatternEducation
} from '../../types/api';
import { colorFor, USAGE_KIND_LABEL, ensureReadableContrast } from '../../logic/patterns';
import { patternDefinitionFor, PatternDefinition } from '../../data/patternDefinitions';

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
  onLineFlash?: (line: number) => void;
}

function RowButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" className="pattern-row" onClick={onClick}>{children}</button>;
}

// Confidence-level banner removed: per project owner, the percentage was
// "pampalubag-loob" and not actionable for students. The matcher still
// computes Wilson lower-bound and class_fit internally for ranking — only
// the user-facing display is gone.

// Per-card numeric explainer removed alongside the banner — the
// underlying lineEvidence / Wilson computation still ships in the
// API payload, so a future developer-facing diagnostic surface can
// be reintroduced without backend changes if needed.

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
    classUsageBindingSource, onLineFlash,
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
        </div>
        <span className="pattern-card-chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="pattern-card-body">
          {/* Confidence rank-bar + numeric explainer removed (project owner
              decision: percentage was "pampalubag-loob" and not actionable
              for students). Ambiguity state is still surfaced as a single
              chip so the user knows when a pick is required. */}
          {!showAccuracy ? null : isAmbiguousUnresolved ? (
            <div className="pattern-status-chip pattern-status-chip--awaiting" data-verdict="unknown">
              awaiting your tag — pick a pattern in the source view
            </div>
          ) : rank ? (
            recomputed ? (
              <div className="pattern-status-chip pattern-status-chip--resolved" data-verdict={rankVerdict || 'resolved'}>
                tagged by you
              </div>
            ) : null
          ) : null}
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

export default function PatternCards(props: PatternCardsProps) {
  const {
    detectedPatterns, ranking, userResolvedPattern, classResolvedPatterns,
    ambiguousClassNames, recomputedRanksByClass,
    classUsageBindings, classUsageBindingSource, onLineFlash
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
        onLineFlash={onLineFlash}
      />
    );
  }

  const reviewClasses = Array.from(ambiguousReviewByClass.keys());
  const totalAmbiguous = reviewClasses.length + ambiguousResolvedCards.length;

  return (
    <div id="pattern-cards" className="pattern-cards">
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
