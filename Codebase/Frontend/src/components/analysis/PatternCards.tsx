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
  retagCandidates: string[];
}

// Top 5 ranked candidate patternIds. Used as the picker's option set when the
// user retags a class outside the original ambiguity verdict.
function topRankedCandidates(ranking: AmbiguityRanking | null): string[] {
  return (ranking?.ranks || []).slice(0, 5).map(r => r.patternId);
}

function dispatchRetag(className: string, candidates: string[]): void {
  if (!className) return;
  window.dispatchEvent(new CustomEvent('pattern:retag-request', {
    detail: { className, candidates }
  }));
}

function RowButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" className="pattern-row" onClick={onClick}>{children}</button>;
}

// Expandable breakdown of how the score was derived. When lineEvidence is
// present, we show the Wilson score interval calculation with the actual
// trial counts and a citation footer so the user can audit the math.
function ScoringExplainer({ rank }: { rank: PatternRankEntry }) {
  const [open, setOpen] = useState(false);
  const conf = Math.round((rank.finalRank || 0) * 100);
  const fit  = Math.round((rank.implementationFit || 0) * 100);
  const le = rank.lineEvidence;
  return (
    <div className="scoring-explainer">
      <button type="button" className="scoring-explainer-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▾' : '▸'} How is this scored?
      </button>
      {open && (
        <div className="scoring-explainer-body">
          {le ? (
            <>
              <p>
                <strong>Score = Wilson score interval, lower bound at 95% confidence</strong>
                {' '}(<code>z = {le.z.toFixed(2)}</code>).
                Each non-blank line in the class scope is one Bernoulli trial:
                this pattern wins the line when its signal hits outweigh rival
                hits plus the catalog-authored weight of any negative-signal hits
                on the same line.
              </p>
              <p>
                <strong>Numbers for this class:</strong>{' '}
                <code>trials n = {le.trials}</code>,{' '}
                <code>successes k = {le.successes}</code>,{' '}
                <code>p̂ = k/n = {le.pHat.toFixed(3)}</code>,{' '}
                <code>z = {le.z.toFixed(2)}</code>,{' '}
                <code>Wilson lower bound = {(le.wilsonLowerBound * 100).toFixed(1)}%</code> →
                shown as <strong>usage match {fit}%</strong>.
              </p>
              <p>
                <strong>Why this formula.</strong> Wilson is the textbook
                conservative estimator for a yes/no proportion when the sample
                is small — wider margin of error when fewer lines have evidence,
                narrower as more lines confirm. The <code>z²/n</code> correction
                handles small samples automatically, so coverage and negative
                signals do not need a hand-tuned dampener. Informational counts:
                {' '}coverage <code>{(le.coverage * 100).toFixed(0)}%</code>,{' '}
                rival hits <code>{le.rivalHits}</code>,{' '}
                negative hits <code>{le.negativeHits}</code>,{' '}
                peak overlap <code>{le.hitsMax}</code>.
              </p>
              <p>
                <strong>confidence ({conf}%)</strong> blends class_fit (1.0 once
                the structural matcher confirms the shape) with usage match using
                the pattern&apos;s own ranking weights from the catalog.
              </p>
              <p className="scoring-citation">
                Wilson (1927), JASA 22(158); Agresti &amp; Coull (1998), Am. Stat
                52(2). 95% confidence is the standard reporting convention. The
                same lower-bound is widely cited as a ranking score — see Evan
                Miller, <em>How Not to Sort by Average Rating</em> (2009).
              </p>
            </>
          ) : (
            <>
              <p>
                <strong>confidence ({conf}%)</strong> blends a structural class-fit
                with the usage-match score using the pattern&apos;s ranking weights.
              </p>
              <p>
                <strong>structure only</strong> appears when the pattern has no
                implementation_template authored yet. The matcher can still see the
                class&apos;s shape, so confidence may be high — but we can&apos;t verify
                the pattern is actually <em>used</em>.
              </p>
            </>
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
  const { pattern: p, rank, rankVerdict, resolved, taggedUsages, classUsageBindingSource, onLineFlash, retagCandidates } = props;
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

  function onRetagClick(e: React.MouseEvent): void {
    e.stopPropagation();
    if (!p.className) return;
    dispatchRetag(p.className, retagCandidates);
  }

  return (
    <div
      className={`pattern-card ${expanded ? 'pattern-card--open' : 'pattern-card--collapsed'}`}
      data-resolved={resolved ? 'true' : undefined}
    >
      <div className="pattern-card-row">
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
        {p.className && (
          <button
            type="button"
            className="pattern-card-retag"
            title={`Open the verify-pattern picker for ${p.className}.`}
            onClick={onRetagClick}
          >
            Verify pattern
          </button>
        )}
      </div>

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
              <ScoringExplainer rank={rank} />
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
  const ranksById = new Map<string, PatternRankEntry>();
  (ranking?.ranks || []).forEach(r => ranksById.set(r.patternId, r));
  const retagCandidates = topRankedCandidates(ranking);
  return (
    <div id="pattern-cards" className="pattern-cards">
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
          retagCandidates={retagCandidates}
        />
      ))}
    </div>
  );
}
