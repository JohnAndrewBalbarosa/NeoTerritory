import React, { useState } from 'react';
import {
  DetectedPatternFull, AmbiguityRanking, PatternRankEntry,
  ClassUsageBinding, DocumentationTarget, UnitTestTarget, PatternEducation
} from '../../types/api';
import { colorFor, USAGE_KIND_LABEL, ensureReadableContrast } from '../../lib/patterns';
import { patternDefinitionFor, PatternDefinition } from '../../data/patternDefinitions';

interface PatternCardsProps {
  detectedPatterns: DetectedPatternFull[];
  ranking: AmbiguityRanking | null;
  userResolvedPattern?: string | null;
  classUsageBindings: Record<string, ClassUsageBinding[]>;
  classUsageBindingSource: 'heuristic' | 'microservice';
  onLineFlash?: (line: number) => void;
}

interface CardProps {
  pattern: DetectedPatternFull;
  rank?: PatternRankEntry;
  rankVerdict?: string;
  resolved: boolean;
  taggedUsages: ClassUsageBinding[];
  classUsageBindingSource: 'heuristic' | 'microservice';
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
  const { pattern: p, rank, rankVerdict, resolved, taggedUsages, classUsageBindingSource, onLineFlash } = props;
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
          {rank && (
            <>
              <div className="rank-bar" data-verdict={rankVerdict || 'no_clear_pattern'}>
                <span title="How sure the matcher is that this class is this pattern">confidence</span>
                <div className="rank-bar-track">
                  <div className="rank-bar-fill" style={{ width: `${Math.round((rank.finalRank || 0) * 100)}%` }} />
                </div>
                <span>{Math.round((rank.finalRank || 0) * 100)}%</span>
                {rank.hasImplementationTemplate
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

export default function PatternCards(props: PatternCardsProps) {
  const { detectedPatterns, ranking, userResolvedPattern, classUsageBindings, classUsageBindingSource, onLineFlash } = props;
  if (!detectedPatterns.length) return <div id="pattern-cards" />;
  // Banner explanation rendered once, before any cards.
  const ranksById = new Map<string, PatternRankEntry>();
  (ranking?.ranks || []).forEach(r => ranksById.set(r.patternId, r));
  return (
    <div id="pattern-cards" className="pattern-cards">
      <ScoringExplainerBanner />
      {detectedPatterns.map(p => (
        <PatternCard
          key={p.patternId + (p.className || '')}
          pattern={p}
          rank={ranksById.get(p.patternId)}
          rankVerdict={ranking?.verdict}
          resolved={!!(userResolvedPattern && userResolvedPattern === p.patternId)}
          taggedUsages={(p.className && classUsageBindings[p.className]) || []}
          classUsageBindingSource={classUsageBindingSource}
          onLineFlash={onLineFlash}
        />
      ))}
    </div>
  );
}
