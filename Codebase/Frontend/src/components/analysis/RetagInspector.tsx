import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { PatternRankEntry } from '../../types/api';

// Floating top-right inspector that replaces the old centered RetagPickerModal.
// Listens for `pattern:retag-request` events emitted by PatternCards' "Verify
// pattern" button (and the ClassBindings popout). Renders a compact, non-
// blocking panel pinned to the upper-right corner so the source view stays
// visible while the user picks. Confirming a choice patches
// currentRun.classResolvedPatterns and the panel closes itself.

interface RetagState {
  className: string;
  candidates: string[];
}

export default function RetagInspector() {
  const [state, setState] = useState<RetagState | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    function onRetag(e: Event) {
      const detail = (e as CustomEvent<RetagState>).detail || ({} as RetagState);
      if (!detail.className) return;
      const run = useAppStore.getState().currentRun;
      const preselect = run?.classResolvedPatterns?.[detail.className]
        ?? run?.userResolvedPattern
        ?? null;
      setChosen(preselect);
      setState({ className: detail.className, candidates: detail.candidates || [] });
    }
    window.addEventListener('pattern:retag-request', onRetag);
    return () => window.removeEventListener('pattern:retag-request', onRetag);
  }, []);

  if (!state) return null;
  const run = useAppStore.getState().currentRun;
  if (!run?.ranking) return null;

  // Normalize candidate list. If the dispatcher passed an empty array, fall
  // back to the top 5 ranked patterns so the user always has options.
  const ranksById = new Map<string, PatternRankEntry>();
  (run.ranking.ranks || []).forEach(r => ranksById.set(r.patternId, r));
  const baseCandidates = state.candidates.length
    ? state.candidates
    : (run.ranking.ranks || []).slice(0, 5).map(r => r.patternId);
  const seen = new Set<string>();
  const candidates = baseCandidates.filter(c => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });

  function close() {
    setState(null);
    setChosen(null);
  }

  function confirm() {
    if (!state || !chosen) return;
    const prev = useAppStore.getState().currentRun?.classResolvedPatterns || {};
    useAppStore.getState().patchCurrentRun({
      classResolvedPatterns: { ...prev, [state.className]: chosen },
      userResolvedPattern: chosen
    });
    close();
  }

  return (
    <aside className="retag-inspector" role="dialog" aria-label={`Verify pattern for ${state.className}`}>
      <header className="retag-inspector-head">
        <span className="retag-inspector-eyebrow">Verify pattern</span>
        <strong className="retag-inspector-class">{state.className}</strong>
        <button
          type="button"
          className="retag-inspector-close"
          aria-label="Close"
          onClick={close}
        >×</button>
      </header>
      <div className="retag-inspector-list">
        {candidates.map(pid => {
          const r = ranksById.get(pid) || { finalRank: 0, implementationFit: 0, patternId: pid };
          const isChosen = chosen === pid;
          return (
            <button
              key={pid}
              type="button"
              className="retag-inspector-option"
              aria-pressed={isChosen}
              onClick={() => setChosen(pid)}
            >
              <span className="opt-name">{pid}</span>
              <span className="opt-rank">
                {Math.floor((r.finalRank || 0) * 100)}%
                {typeof r.implementationFit === 'number' && r.implementationFit > 0
                  ? <> · usage {Math.floor(r.implementationFit * 100)}%</>
                  : null}
              </span>
            </button>
          );
        })}
        {candidates.length === 0 && (
          <p className="retag-inspector-empty">No candidate patterns available.</p>
        )}
      </div>
      <footer className="retag-inspector-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={!chosen}
          onClick={confirm}
        >Apply</button>
      </footer>
    </aside>
  );
}
