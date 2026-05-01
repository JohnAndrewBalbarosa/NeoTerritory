import { useState } from 'react';
import { AmbiguityRanking, PatternRankEntry } from '../../types/api';

// Picker shown when the user clicks "Tag pattern…" on a card or class chip.
// The legacy auto-popping ambiguity modal is gone — this component now only
// renders inside the retag flow driven by the `pattern:retag-request` event.
//
// Props are kept similar to the old AmbiguityModal so the call site doesn't
// need to change shape, but the DOM ids/classes are renamed so any leftover
// CSS or QA hooks pointing at "ambiguity-*" disappear.

interface RetagPickerModalProps {
  ranking: AmbiguityRanking;
  sourceName: string;
  onConfirm: (patternId: string | null) => void;
  onSkip: () => void;
  candidatesOverride?: string[];
  title?: string;
  preselect?: string | null;
  detail?: string;
}

export default function RetagPickerModal({
  ranking, sourceName, onConfirm, onSkip,
  candidatesOverride, title, preselect, detail
}: RetagPickerModalProps) {
  const [chosen, setChosen] = useState<string | null>(preselect ?? null);
  const ranksById = new Map<string, PatternRankEntry>();
  (ranking.ranks || []).forEach(r => ranksById.set(r.patternId, r));

  // candidatesOverride is the call site's explicit list. Fall back to the
  // top 5 ranks so the picker always has options to show.
  const baseCandidates = candidatesOverride && candidatesOverride.length
    ? candidatesOverride
    : (ranking.ranks || []).slice(0, 5).map(r => r.patternId);
  const seen = new Set<string>();
  const candidates = baseCandidates.filter(c => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });

  const heading = title || 'Tag pattern';
  const detailText = detail
    || `Pick the pattern that best matches this class in ${sourceName}.`;

  return (
    <div className="modal retag-picker-modal">
      <div className="modal-card">
        <h3>{heading}</h3>
        <p className="modal-detail">{detailText}</p>
        <div className="retag-option-list">
          {candidates.map(pid => {
            const r = ranksById.get(pid) || { finalRank: 0, implementationFit: 0, patternId: pid };
            return (
              <button
                key={pid}
                type="button"
                className="retag-option"
                aria-pressed={chosen === pid}
                onClick={() => setChosen(pid)}
              >
                <span className="opt-name">{pid}</span>
                <span className="opt-rank">
                  confidence {Math.floor((r.finalRank || 0) * 100)}%
                  {typeof r.implementationFit === 'number' && r.implementationFit > 0
                    ? <> · usage match {Math.floor(r.implementationFit * 100)}%</>
                    : null}
                </span>
              </button>
            );
          })}
          {candidates.length === 0 && (
            <div className="modal-detail">No candidate patterns available.</div>
          )}
        </div>
        <div className="modal-actions">
          <button className="ghost-btn" type="button" onClick={onSkip}>Cancel</button>
          <button
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
