import { useState } from 'react';
import { useAppStore } from '../../store/appState';
import { useAuth } from '../../hooks/useAuth';
import { submitConsent } from '../../api/client';
import { consentNotice, consentAcknowledgement, consentVersion } from '../../data/surveyQuestions';

function ConsentIcon({
  kind,
}: {
  kind: 'shield' | 'letter' | 'overview' | 'tasks' | 'voluntary' | 'privacy' | 'research' | 'check';
}) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };

  switch (kind) {
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 3l7 3v5c0 4.5-2.4 7.8-7 10-4.6-2.2-7-5.5-7-10V6l7-3z" />
          <path {...common} d="M9.7 12.1l1.7 1.7 3.3-4" />
        </svg>
      );
    case 'letter':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 6.5h7v11H4z" />
          <path {...common} d="M13 6.5h7v11h-7z" />
          <path {...common} d="M11 8.5l2 1.5" />
        </svg>
      );
    case 'overview':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 5h16v14H4z" />
          <path {...common} d="M8 9h8" />
          <path {...common} d="M8 13h5" />
        </svg>
      );
    case 'tasks':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M9 6h11" />
          <path {...common} d="M9 12h11" />
          <path {...common} d="M9 18h11" />
          <path {...common} d="M4.5 6.5l1.5 1.5 2.5-3" />
          <path {...common} d="M4.5 12.5l1.5 1.5 2.5-3" />
          <path {...common} d="M4.5 18.5l1.5 1.5 2.5-3" />
        </svg>
      );
    case 'voluntary':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            {...common}
            d="M12 20s-6.5-4.2-6.5-9.4A3.8 3.8 0 0 1 9.3 7c1.3 0 2.1.5 2.7 1.3.6-.8 1.4-1.3 2.7-1.3a3.8 3.8 0 0 1 3.8 3.6C18.5 15.8 12 20 12 20z"
          />
        </svg>
      );
    case 'privacy':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...common} x="6" y="10" width="12" height="10" rx="2" />
          <path {...common} d="M9 10V8a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case 'research':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M10 5h10v14H10z" />
          <path {...common} d="M6 9h8" />
          <path {...common} d="M6 13h8" />
          <path {...common} d="M6 17h6" />
        </svg>
      );
    case 'check':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...common} cx="12" cy="12" r="9" />
          <path {...common} d="M8.8 12.2l2.1 2.1 4.3-4.4" />
        </svg>
      );
    default:
      return null;
  }
}

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
        <header className="consent-header">
          <div className="consent-header__identity">
            <div className="consent-header__shield">
              <ConsentIcon kind="shield" />
            </div>
            <div className="consent-header__copy">
              <p className="consent-header__eyebrow">NeoTerritory Research Consent</p>
              <h2 id="consent-title">Informed Consent &amp; Data Privacy Notice</h2>
              <p className="consent-header__subtitle">
                <span>Tester Seat</span>
                <span aria-hidden="true">|</span>
                <span>NeoTerritory DEVCON Luzon</span>
                <span className="consent-header__subnote">Please read carefully before proceeding</span>
              </p>
            </div>
          </div>
          <div className="consent-header__badge">
            <ConsentIcon kind="privacy" />
            <span>Required</span>
          </div>
        </header>

        <div className="consent-scroll">
          <div className="consent-meta">
            <span className="consent-meta__chip">FEU Institute of Technology</span>
            <span className="consent-meta__chip">BS Computer Science - Software Engineering</span>
            <span className="consent-meta__chip">Academic research only</span>
          </div>

          <section className="consent-section">
            <div className="consent-section__head">
              <div className="consent-section__label consent-section__label--cyan">
                <ConsentIcon kind="letter" />
                <span>Letter to the Participants</span>
              </div>
            </div>
            <div className="consent-section__body">
              <p className="consent-section__salute">Dear Participants,</p>
              <p>
                We are{' '}
                <span className="consent-highlight consent-highlight--yellow">
                  3rd Year BS Computer Science students specializing in Software Engineering
                </span>{' '}
                from the <span className="consent-highlight consent-highlight--cyan">FEU Institute of Technology</span>. We are
                currently conducting our research study on NeoTerritory as a{' '}
                <span className="consent-highlight consent-highlight--purple">
                  graph-based and AST-centered documentation generation system
                </span>{' '}
                for internship onboarding and <span className="consent-highlight consent-highlight--green">design pattern learning</span>{' '}
                in <span className="consent-highlight consent-highlight--cyan">DEVCON Luzon</span>.
              </p>
              <p>
                We respectfully invite you to participate in this study, which evaluates a developer-facing system designed
                to transform source code into structure-aware documentation using graph-based and Abstract Syntax Tree
                representations. The goal is to support onboarding, code understanding, and pattern recognition within a
                real software engineering environment.
              </p>
            </div>
          </section>

          <section className="consent-section">
            <div className="consent-section__head">
              <div className="consent-section__label consent-section__label--purple">
                <ConsentIcon kind="overview" />
                <span>Study Overview</span>
              </div>
            </div>
            <div className="consent-section__body">
              <p>
                This research focuses on <span className="consent-highlight consent-highlight--purple">graph-based AST-centered documentation generation</span>,{' '}
                <span className="consent-highlight consent-highlight--green">design pattern learning</span>, and
                internship-oriented code understanding support. NeoTerritory presents structural documentation, developer
                guidance, and pattern-learning signals inside a single environment so researchers can evaluate how well the
                system supports first-contact onboarding tasks.
              </p>
              <p>
                As part of the testing phase, you are one of the selected participants. Your interaction with this system
                will help us evaluate clarity, usefulness, and practical onboarding value within the{' '}
                <span className="consent-highlight consent-highlight--cyan">DEVCON Luzon</span> research context.
              </p>
            </div>
          </section>

          <section className="consent-section">
            <div className="consent-section__head">
              <div className="consent-section__label consent-section__label--yellow">
                <ConsentIcon kind="tasks" />
                <span>Participant Responsibilities</span>
              </div>
            </div>
            <div className="consent-section__body">
              <p>If you agree to participate, you will be asked to:</p>
              <ul className="consent-task-list">
                <li>Interact with NeoTerritory and explore its features through guided tasks.</li>
                <li>Review generated documentation and design pattern learning outputs based on source code analysis.</li>
                <li>Perform short code-understanding activities using the research prototype.</li>
                <li>Answer a brief evaluation questionnaire regarding usability, clarity, and effectiveness.</li>
              </ul>
            </div>
          </section>

          <section className="consent-section consent-section--accent">
            <div className="consent-section__head">
              <div className="consent-section__label consent-section__label--green">
                <ConsentIcon kind="voluntary" />
                <span>Voluntary Participation</span>
              </div>
            </div>
            <div className="consent-section__body">
              <p>
                Your participation in this study is entirely{' '}
                <span className="consent-highlight consent-highlight--green">voluntary</span>. You have the right to
                decline participation, refuse to answer any question, or withdraw from the study at any time without
                penalty or negative consequences.
              </p>
            </div>
          </section>

          <section className="consent-section">
            <div className="consent-section__head">
              <div className="consent-section__label consent-section__label--purple">
                <ConsentIcon kind="privacy" />
                <span>Data Privacy Notice</span>
              </div>
              <span className="consent-section__badge">Republic Act No. 10173</span>
            </div>
            <div className="consent-section__body">
              <p>
                In accordance with the{' '}
                <span className="consent-highlight consent-highlight--purple">
                  Data Privacy Act of 2012 (Republic Act No. 10173)
                </span>
                , all information gathered from respondents shall be treated with strict confidentiality and used solely
                for academic and research purposes.
              </p>
              <p>{consentNotice}</p>
            </div>
          </section>

          <section className="consent-section">
            <div className="consent-section__head">
              <div className="consent-section__label consent-section__label--cyan">
                <ConsentIcon kind="research" />
                <span>Confidentiality &amp; Research Usage</span>
              </div>
            </div>
            <div className="consent-section__body">
              <p>
                Responses will be analyzed and presented only in summarized or aggregated form.{' '}
                <span className="consent-highlight consent-highlight--yellow">
                  No personally identifiable data will be publicly disclosed
                </span>{' '}
                in the final paper, presentation, or any related academic output.
              </p>
              <p>
                The collected data will <span className="consent-highlight consent-highlight--green">only be used for academic research purposes</span>{' '}
                by authorized members of the research team. Submitted responses will not be sold, shared, or disclosed to
                unauthorized persons or organizations.
              </p>
              <p>
                By proceeding, you acknowledge that this activity forms part of a structured evaluation involving selected
                participants and contributes to validating NeoTerritory&apos;s effectiveness in supporting documentation
                generation and onboarding workflows within{' '}
                <span className="consent-highlight consent-highlight--cyan">DEVCON Luzon</span>.
              </p>
            </div>
          </section>

          <label className={`consent-acknowledgement${agree ? ' is-checked' : ''}`}>
            <div className="consent-section__head">
              <div className="consent-section__label consent-section__label--green">
                <ConsentIcon kind="check" />
                <span>Consent Acknowledgement</span>
              </div>
            </div>
            <div className="consent-acknowledgement__body">
              <span className="consent-acknowledgement__checkwrap">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  aria-describedby="consent-acknowledgement-text"
                />
              </span>
              <span className="consent-acknowledgement__copy">
                <span className="consent-acknowledgement__title">Please confirm your acknowledgement</span>
                <span id="consent-acknowledgement-text" className="consent-acknowledgement__text">
                  {consentAcknowledgement}
                </span>
              </span>
            </div>
          </label>

          {error && <div className="error-banner consent-error" role="alert">{error}</div>}
        </div>

        <div className="modal-actions consent-actions">
          <button className="ghost-btn consent-actions__decline" type="button" onClick={onDecline} disabled={busy}>
            Decline
          </button>
          <button
            className="primary-btn consent-actions__continue"
            type="button"
            onClick={() => {
              void onAccept();
            }}
            disabled={!agree || busy}
          >
            <span className="consent-actions__continue-inner">
              <span className="consent-actions__continue-icon" aria-hidden="true">
                <ConsentIcon kind="check" />
              </span>
              <span>{busy ? 'Submitting...' : 'I Agree & Proceed to Testing'}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
