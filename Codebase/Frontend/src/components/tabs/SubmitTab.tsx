import { ReactNode } from 'react';
import AnalysisForm from '../analysis/AnalysisForm';
import RunList from '../runs/RunList';
import StartHereRail from '../studio/StartHereRail';
import InBentoTabs, { InBentoTab } from '../ui/InBentoTabs';
import { IconBook, IconCode, IconLayers, IconPlay } from '../icons/Icons';
import { AnalysisRun } from '../../types/api';

interface SubmitTabProps {
  onAnalysisComplete: (run: AnalysisRun) => void;
  refreshSignal: number;
  beforeAnalyze?: (dispatch: () => void) => void;
}

interface HelpItem {
  title: string;
  icon: ReactNode;
  body: ReactNode;
}

const HELP_ITEMS: HelpItem[] = [
  {
    title: 'What should I paste?',
    icon: <IconCode size={22} />,
    body: (
      <>
        <p>Paste any C++ source code you want to analyze. You can paste a <strong>single file</strong> or multiple files together.</p>
        <p><small>We support .cpp, .h, and .hpp files.</small></p>
      </>
    ),
  },
  {
    title: 'How does analysis work?',
    icon: <IconLayers size={22} />,
    body: (
      <>
        <p>CodiNeo's microservice scans your code for <strong>design patterns</strong> using static analysis and pattern matching.</p>
        <p><small>Results include confidence scores and line-by-line annotations.</small></p>
      </>
    ),
  },
  {
    title: 'What results will I see?',
    icon: <IconPlay size={22} />,
    body: (
      <>
        <p>After analysis you'll see detected <strong>pattern names</strong>, annotated source lines, and a confidence ranking.</p>
        <p><small>Switch to the Patterns tab to explore full results.</small></p>
      </>
    ),
  },
  {
    title: 'Tips for beginners',
    icon: <IconBook size={22} />,
    body: (
      <>
        <p>Not sure where to start? Click <strong>Load sample</strong> to load an example file and see how the analysis works end-to-end.</p>
        <p><small>You can also upload .cpp or .h files directly using the Upload file button.</small></p>
      </>
    ),
  },
];

function HelpPanel() {
  return (
    <div className="submit-help">
      {HELP_ITEMS.map((item, i) => (
        <article key={i} className="submit-help__item">
          <div className="submit-help__item-icon" aria-hidden>{item.icon}</div>
          <div className="submit-help__item-body">
            <h4 className="submit-help__item-title">{item.title}</h4>
            {item.body}
          </div>
        </article>
      ))}
    </div>
  );
}

export default function SubmitTab({ onAnalysisComplete, refreshSignal, beforeAnalyze }: SubmitTabProps) {
  function handleBeforeAnalyze(dispatch: () => void): void {
    if (beforeAnalyze) beforeAnalyze(dispatch);
    else dispatch();
  }

  const tabs: InBentoTab[] = [
    {
      id: 'editor',
      label: 'Editor',
      icon: <IconCode size={14} />,
      content: (
        <AnalysisForm
          onAnalysisComplete={onAnalysisComplete}
          beforeSubmit={handleBeforeAnalyze}
        />
      ),
    },
    {
      id: 'help',
      label: 'Help',
      icon: <IconBook size={14} />,
      content: <HelpPanel />,
    },
    {
      id: 'runs',
      label: 'Recent runs',
      icon: <IconLayers size={14} />,
      content: <RunList refreshSignal={refreshSignal} />,
    },
  ];

  return (
    <section className="tab-panel tab-submit">
      {/* D45 first-run rail stays above the in-bento tab strip. */}
      <StartHereRail />
      <InBentoTabs tabs={tabs} ariaLabel="Submit workspace" />
    </section>
  );
}
