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
        <div className="codineo-brand-header">
          <div className="codineo-brand-mark" aria-hidden>
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="16" height="11" rx="2" />
              <path d="M7 18h6M10 14v4" />
              <path d="M6 8l2 2-2 2M11 10h3" strokeWidth="1.5" />
            </svg>
          </div>
          <div>
            <div className="codineo-brand-name">CodiNeo</div>
            <div className="codineo-brand-sub">DEVCON 1 · Code Intelligence</div>
          </div>
        </div>
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
