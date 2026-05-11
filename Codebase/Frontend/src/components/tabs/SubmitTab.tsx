import { useState } from 'react';
import AnalysisForm from '../analysis/AnalysisForm';
import RunList from '../runs/RunList';
import { useAppStore } from '../../store/appState';
import { AnalysisRun } from '../../types/api';
import { IconBook, IconCode, IconLayers, IconPlay } from '../icons/Icons';

interface SubmitTabProps {
  onAnalysisComplete: (run: AnalysisRun) => void;
  refreshSignal: number;
  beforeAnalyze?: (dispatch: () => void) => void;
}

const GUIDE_ITEMS = [
  {
    title: 'What should I paste?',
    icon: <IconCode size={22} />,
    content: (
      <>
        <p>Paste any C++ source code you want to analyze. You can paste a <strong>single file</strong> or multiple files together.</p>
        <p><small>We support .cpp, .h, and .hpp files.</small></p>
      </>
    ),
  },
  {
    title: 'How does analysis work?',
    icon: <IconLayers size={22} />,
    content: (
      <>
        <p>CodiNeo's microservice scans your code for <strong>design patterns</strong> using static analysis and pattern matching.</p>
        <p><small>Results include confidence scores and line-by-line annotations.</small></p>
      </>
    ),
  },
  {
    title: 'What results will I see?',
    icon: <IconPlay size={22} />,
    content: (
      <>
        <p>After analysis you'll see detected <strong>pattern names</strong>, annotated source lines, and a confidence ranking.</p>
        <p><small>Switch to the Patterns tab to explore full results.</small></p>
      </>
    ),
  },
  {
    title: 'Tips for beginners',
    icon: <IconBook size={22} />,
    content: (
      <>
        <p>Not sure where to start? Click <strong>Load sample</strong> to load an example file and see how the analysis works end-to-end.</p>
        <p><small>You can also upload .cpp or .h files directly using the Upload file button.</small></p>
      </>
    ),
  },
] as const;

export default function SubmitTab({ onAnalysisComplete, refreshSignal, beforeAnalyze }: SubmitTabProps) {
  const { currentRun, submissionFiles } = useAppStore();
  const [openGuideItem, setOpenGuideItem] = useState<number | null>(0);

  // Single-popup behavior: hand straight to MainLayout's beforeAnalyze, which
  // shows the discard-or-keep-editing prompt only when there is an existing
  // run to clobber. Per-run survey questions live in the Review tab now.
  function handleBeforeAnalyze(dispatch: () => void): void {
    if (beforeAnalyze) beforeAnalyze(dispatch);
    else dispatch();
  }

  // Derive step state
  const hasCode = (submissionFiles ?? []).some(f => f.text?.trim());
  const stepDone1 = hasCode;
  const stepDone2 = !!currentRun;
  const stepActive1 = !hasCode;
  const stepActive2 = hasCode && !currentRun;
  const stepActive3 = !!currentRun;

  return (
    <section className="tab-panel tab-submit">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="studio-page-header">
        <div className="studio-page-title-area">
          <div className="studio-page-icon" aria-hidden="true">&lt;/&gt;</div>
          <div>
            <h2 className="studio-page-title">Analyze C++ Code</h2>
            <p className="studio-page-desc">
              Paste your code or load a sample. CodiNeo will help you
              find patterns and explain them in simple terms.
            </p>
          </div>
        </div>
        <div className="studio-new-here-card" aria-label="Quick start tip">
          <div className="studio-new-here-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4" />
              <circle cx="12" cy="16" r="0.5" fill="currentColor" />
            </svg>
          </div>
          <div className="studio-new-here-copy">
            <p className="studio-new-here-title">New here?</p>
            <p className="studio-new-here-text">Start with <strong>Load sample.</strong></p>
          </div>
          <span className="studio-new-here-arrow" aria-hidden="true">›</span>
        </div>
      </div>

      {/* ── Step indicator ─────────────────────────────────────── */}
      <div className="studio-steps" role="list" aria-label="Progress steps">
        <div
          className={`studio-step${stepDone1 ? ' studio-step--done' : stepActive1 ? ' studio-step--active' : ''}`}
          role="listitem"
        >
          <span className="studio-step__num" aria-hidden="true">{stepDone1 ? '✓' : '1'}</span>
          <span className="studio-step__label">Add code</span>
        </div>
        <div className="studio-step-sep" aria-hidden="true" />
        <div
          className={`studio-step${stepDone2 ? ' studio-step--done' : stepActive2 ? ' studio-step--active' : ''}`}
          role="listitem"
        >
          <span className="studio-step__num" aria-hidden="true">{stepDone2 ? '✓' : '2'}</span>
          <span className="studio-step__label">Run analysis</span>
        </div>
        <div className="studio-step-sep" aria-hidden="true" />
        <div
          className={`studio-step${stepActive3 ? ' studio-step--active' : ''}`}
          role="listitem"
        >
          <span className="studio-step__num" aria-hidden="true">3</span>
          <span className="studio-step__label">View results</span>
        </div>
      </div>

      {/* ── Main dashboard: form + sidebar ─────────────────────── */}
      <div className="studio-dashboard">

        {/* Left: main analysis workspace */}
        <div className="studio-main">
          <AnalysisForm
            onAnalysisComplete={onAnalysisComplete}
            beforeSubmit={handleBeforeAnalyze}
          />
        </div>

        {/* Right: quick guide sidebar */}
        <aside className="studio-sidebar" aria-label="Quick guide">
          <div className="quick-guide">
            <h3 className="quick-guide__title">
              <span className="quick-guide__title-icon" aria-hidden="true">
                <IconBook size={18} />
              </span>
              Quick guide
            </h3>
            {GUIDE_ITEMS.map((item, i) => {
              const isOpen = openGuideItem === i;
              return (
                <div key={i} className={`quick-guide__item${isOpen ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="quick-guide__item-head"
                    aria-expanded={isOpen}
                    onClick={() => setOpenGuideItem(isOpen ? null : i)}
                  >
                    <span className="quick-guide__item-num" aria-hidden="true">{i + 1}</span>
                    <span>{item.title}</span>
                    <span className="quick-guide__item-chevron" aria-hidden="true">∨</span>
                  </button>
                  {isOpen && (
                    <div className="quick-guide__item-body">
                      <div className="quick-guide__item-icon-row">
                        <div className="quick-guide__item-icon" aria-hidden="true">
                          {item.icon}
                        </div>
                      </div>
                      {item.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

      </div>

      {/* ── Recent runs ────────────────────────────────────────── */}
      <div className="studio-runs-section">
        <RunList refreshSignal={refreshSignal} />
      </div>

    </section>
  );
}
