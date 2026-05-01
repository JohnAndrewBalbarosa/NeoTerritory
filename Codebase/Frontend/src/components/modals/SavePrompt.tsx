import { useState } from 'react';
import { saveRun } from '../../api/client';
import { useAppStore } from '../../store/appState';

interface SavePromptProps {
  pendingId: string;
  sourceName: string;
  patternCount: number;
  commentCount: number;
  userResolvedPattern?: string | null;
  ambiguousVerdict?: boolean;
  onSaved: (runId: number) => void;
  onDiscard: () => void;
}

export default function SavePrompt(props: SavePromptProps) {
  const {
    pendingId, sourceName, patternCount, commentCount,
    userResolvedPattern, ambiguousVerdict, onSaved, onDiscard
  } = props;
  const { setStatus } = useAppStore();
  const [busy, setBusy] = useState(false);

  // Pull the latest per-class picks from the store at save time so anything
  // tagged via the cards/popout while this prompt was open is included.
  const classResolvedPatterns = useAppStore(s => s.currentRun?.classResolvedPatterns);
  const tagged = classResolvedPatterns ? Object.keys(classResolvedPatterns) : [];
  const choiceLine = userResolvedPattern
    ? ` Choice: ${userResolvedPattern}.`
    : (tagged.length ? ` Tagged: ${tagged.length} class(es).` : '');

  async function onConfirm() {
    setBusy(true);
    try {
      const result = await saveRun(
        pendingId,
        userResolvedPattern || undefined,
        classResolvedPatterns && Object.keys(classResolvedPatterns).length
          ? classResolvedPatterns
          : undefined
      );
      setStatus({ kind: 'ok', title: 'Run saved', detail: `Saved as run #${result.runId}.` });
      onSaved(result.runId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setStatus({ kind: 'error', title: 'Save failed', detail: msg });
    } finally {
      setBusy(false);
    }
  }

  function onCancel() {
    setStatus({ kind: 'idle', title: 'Discarded', detail: 'Run was not saved.' });
    onDiscard();
  }

  return (
    <div id="save-prompt" className="modal">
      <div className="modal-card">
        <h3>Save this run?</h3>
        <p id="save-prompt-detail" className="modal-detail">
          {sourceName}: {patternCount} pattern(s), {commentCount} comment(s).{choiceLine} Save to your folder?
        </p>
        {ambiguousVerdict && tagged.length === 0 && !userResolvedPattern && (
          <p className="modal-hint">
            Tip: tag patterns from the cards before saving for clearer history.
          </p>
        )}
        <div className="modal-actions">
          <button id="save-discard-btn" className="ghost-btn" type="button" onClick={onCancel} disabled={busy}>
            Discard
          </button>
          <button id="save-confirm-btn" className="primary-btn" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
