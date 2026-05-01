import React, { useState } from 'react';
import {
  DetectedPatternFull, AmbiguityRanking, PatternRankEntry,
  ClassUsageBinding, DocumentationTarget, UnitTestTarget
} from '../../types/api';
import { colorFor, USAGE_KIND_LABEL } from '../../lib/patterns';

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

function FunctionsSection({ fns, onLineFlash }: { fns: UnitTestTarget[]; onLineFlash?: (l: number) => void }) {
  if (!fns.length) return null;
  return (
    <div className="pattern-card-section">
      <h4>Functions</h4>
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
      <h4>Anchors</h4>
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
      <h4>Where it's used</h4>
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
            ? 'No call-sites matched the implementation template in this source.'
            : 'Pending: implementation template not yet authored for this pattern.'}
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
  return (
    <div className="pattern-card-section">
      <h4>Tagged usages <span className="usage-source">[{sourceTag}]</span></h4>
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
        <div className="pattern-card-pending">No tagged usages of {className} found in this source.</div>
      )}
    </div>
  );
}

function PatternCard(props: CardProps) {
  const { pattern: p, rank, rankVerdict, resolved, taggedUsages, classUsageBindingSource, onLineFlash } = props;
  const colour = colorFor(p.patternName || 'default');
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
            <div className="rank-bar" data-verdict={rankVerdict || 'no_clear_pattern'}>
              <span>rank</span>
              <div className="rank-bar-track">
                <div className="rank-bar-fill" style={{ width: `${Math.round((rank.finalRank || 0) * 100)}%` }} />
              </div>
              <span>{Math.round((rank.finalRank || 0) * 100)}%</span>
              {rank.hasImplementationTemplate
                ? <span title="implementation_fit">impl {Math.floor((rank.implementationFit || 0) * 100)}%</span>
                : <span title="no implementation_template authored yet">class-only</span>}
            </div>
          )}
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
        />
      ))}
    </div>
  );
}
