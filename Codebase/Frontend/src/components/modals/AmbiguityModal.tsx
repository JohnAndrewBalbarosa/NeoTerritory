import { useState } from 'react';
import { AmbiguityRanking, PatternRankEntry } from '../../types/api';

interface AmbiguityModalProps {
  ranking: AmbiguityRanking;
  sourceName: string;
  onConfirm: (patternId: string | null) => void;
  onSkip: () => void;
}

export default function AmbiguityModal({ ranking, sourceName, onConfirm, onSkip }: AmbiguityModalProps) {
  const [chosen, setChosen] = useState<string | null>(null);
  const ranksById = new Map<string, PatternRankEntry>();
  (ranking.ranks || []).forEach(r => ranksById.set(r.patternId, r));
  const candidates = ranking.ambiguousCandidates || [];

  return (
    <div id="ambiguity-modal" className="modal">
      <div className="modal-card">
        <h3>Choose a pattern</h3>
        <p id="ambiguity-detail" className="modal-detail">
          {sourceName}: top {candidates.length} patterns scored within tolerance.
          You can keep reviewing the code while choosing; skip keeps all.
        </p>
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
