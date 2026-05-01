import { useState } from 'react';
import { AmbiguityRanking, PatternRankEntry } from '../../types/api';

interface AmbiguityModalProps {
  ranking: AmbiguityRanking;
  sourceName: string;
  onConfirm: (patternId: string | null) => void;
  onSkip: () => void;
  candidatesOverride?: string[];
  title?: string;
  preselect?: string | null;
  detail?: string;
}

export default function AmbiguityModal({
  ranking, sourceName, onConfirm, onSkip,
  candidatesOverride, title, preselect, detail
}: AmbiguityModalProps) {
  const [chosen, setChosen] = useState<string | null>(preselect ?? null);
  const ranksById = new Map<string, PatternRankEntry>();
  (ranking.ranks || []).forEach(r => ranksById.set(r.patternId, r));

  // In retag mode, candidatesOverride is the explicit list. In ambiguity mode,
  // fall back to the ranking's flagged candidates. If both are empty, surface
  // the top 5 ranks so the picker still has something to choose from.
  const baseCandidates = candidatesOverride && candidatesOverride.length
    ? candidatesOverride
    : (ranking.ambiguousCandidates || []);
  const candidates = baseCandidates.length
    ? baseCandidates
    : (ranking.ranks || []).slice(0, 5).map(r => r.patternId);

  const heading = title || 'Choose a pattern';
  const detailText = detail
    || `${sourceName}: top ${candidates.length} patterns scored within tolerance. ` +
       `You can keep reviewing the code while choosing; skip keeps all.`;

  return (
    <div id="ambiguity-modal" className="modal">
      <div className="modal-card">
        <h3>{heading}</h3>
        <p id="ambiguity-detail" className="modal-detail">{detailText}</p>
        <div id="ambiguity-list" className="ambiguity-list">
          {candidates.map(pid => {
            const r = ranksById.get(pid) || { finalRank: 0, implementationFit: 0, patternId: pid };
            return (
              <button
                key={pid}
                type="button"
                className="ambiguity-option"
                aria-pressed={chosen === pid}
                onClick={() => setChosen(pid)}
              >
                <span className="opt-name">{pid}</span>
                <span className="opt-rank">
                  rank {Math.floor((r.finalRank || 0) * 100)}% • impl {Math.floor((r.implementationFit || 0) * 100)}%
                </span>
              </button>
            );
          })}
          {candidates.length === 0 && (
            <div className="modal-detail">No candidate patterns available.</div>
          )}
        </div>
        <div className="modal-actions">
          <button id="ambiguity-skip-btn" className="ghost-btn" type="button" onClick={onSkip}>Skip</button>
          <button
            id="ambiguity-confirm-btn"
            className="primary-btn"
            type="button"
            disabled={!chosen}
            onClick={() => onConfirm(chosen)}
          >Confirm</button>
        </div>
      </div>
    </div>
  );
}
