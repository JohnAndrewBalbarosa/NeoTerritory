import { useState } from 'react';
import { useAppStore } from '../../store/appState';
import { useAuth } from '../../hooks/useAuth';
import { submitConsent } from '../../api/client';
import { consentNotice, consentAcknowledgement, consentVersion } from '../../data/surveyQuestions';

export default function ConsentGate() {
  const { setConsentAccepted } = useAppStore();
  const { signOut } = useAuth();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAccept(): Promise<void> {
    if (!agree || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitConsent(consentVersion);
      setConsentAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record consent.');
    } finally {
      setBusy(false);
    }
  }

  function onDecline(): void {
    signOut();
  }

  return (
    <div className="modal-overlay consent-gate" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="modal-card consent-card">
        <h2 id="consent-title">Data Privacy Notice</h2>
        <p className="consent-body">{consentNotice}</p>
        <label className="consent-check">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <span>{consentAcknowledgement}</span>
        </label>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <div className="modal-actions">
          <button className="ghost-btn" type="button" onClick={onDecline} disabled={busy}>
            Decline & sign out
          </button>
          <button
            className="primary-btn"
            type="button"
            onClick={() => { void onAccept(); }}
            disabled={!agree || busy}
          >
            {busy ? 'Submitting…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
