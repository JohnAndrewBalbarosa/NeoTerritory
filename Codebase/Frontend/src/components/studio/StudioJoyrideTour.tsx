import { useEffect, useRef, useState } from 'react';
import { Joyride, EVENTS, type EventData, type Step } from 'react-joyride';
import { useAppStore, type StudioTab } from '../../store/appState';

// Per D54 (this turn): the in-studio walkthrough is tab-aware. Each studio
// tab has its OWN short tour. The tour only runs while the user is on the
// matching tab; switching tabs resets the tour and starts the new tab's set
// from the beginning. The earlier 8-step monolithic tour was too long and
// included a "Sign in" step the user had already cleared by the time they
// landed in the studio.
//
// Tabs (from appState.ts): 'submit' | 'annotated' | 'gdb' | 'docs' | 'ambiguous'
// User-visible labels per MainLayout: Submit / Patterns / Tests / Docs / Self-check
//
// Targets:
//   submit:    #load-sample-btn, #analyze-btn, #analysis-form
//   annotated: pattern card containers (.pattern-card or fallback body)
//   gdb:       gdb runner pane
//   docs:      documentation tab
//   ambiguous: self-check tab

const COMPLETED_KEY_PREFIX = 'nt_studio_tour_completed';
const FORCE_OPEN_EVENT = 'nt:studio-tour:open';

export function dispatchStudioTourOpen(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FORCE_OPEN_EVENT));
}

function readCompleted(tab: StudioTab): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(`${COMPLETED_KEY_PREFIX}__${tab}`) === '1';
  } catch {
    return false;
  }
}

function writeCompleted(tab: StudioTab): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${COMPLETED_KEY_PREFIX}__${tab}`, '1');
  } catch {
    /* storage blocked */
  }
}

interface TabSteps {
  intro: { title: string; body: string; takeaway: string };
  steps: Array<{
    target: string | null; // null -> centered
    title: string;
    body: string;
    takeaway: string;
  }>;
}

const STEPS_BY_TAB: Record<StudioTab, TabSteps> = {
  submit: {
    intro: {
      title: 'Submit',
      body: 'This is where every analysis starts.',
      takeaway: 'Load a sample, click Analyze, watch the result.',
    },
    steps: [
      {
        target: '#load-sample-btn',
        title: 'Load a sample',
        body: 'Pick a real-world C++ file from the picker. Samples are grouped by family — Creational, Structural, Behavioural, Idioms.',
        takeaway: 'No need to write C++ from scratch.',
      },
      {
        target: '#analyze-btn',
        title: 'Click Analyze',
        body: 'The C++ microservice reads your file, builds a virtual parse tree, and runs every pattern detector in the catalog.',
        takeaway: 'A single click drives the full pipeline.',
      },
      {
        target: '#analysis-form',
        title: 'Read the result',
        body: 'When the run finishes, the pattern cards appear above and the run is added to the saved runs list below.',
        takeaway: 'Detection lands in under a second for typical files.',
      },
    ],
  },
  annotated: {
    intro: {
      title: 'Patterns',
      body: 'Detected patterns and their evidence live here.',
      takeaway: 'Each card names a pattern and points at the lines that triggered it.',
    },
    steps: [
      {
        target: null,
        title: 'Pattern cards',
        body: 'Each card shows the pattern name, the class it was found in, the line range, and the evidence anchors. Cards are independent — read them in any order.',
        takeaway: 'Read pattern by pattern, not file by file.',
      },
      {
        target: null,
        title: 'Co-emit and ambiguity',
        body: 'When two patterns share the same shape — Adapter, Proxy, Decorator — both cards appear. The ambiguous flag marks them so you know neither won outright.',
        takeaway: 'Multiple verdicts on the same class are honest, not noisy.',
      },
    ],
  },
  gdb: {
    intro: {
      title: 'Tests',
      body: 'Unit-test scaffolds for the detected patterns.',
      takeaway: 'The detector knows which functions matter; the test scaffold runs them.',
    },
    steps: [
      {
        target: null,
        title: 'Generated test scaffolds',
        body: 'Per detected pattern, the system emits a test scaffold targeting the unit-test points the detector found. You fill in expected values; the harness runs them.',
        takeaway: 'Tests are pre-templated to the pattern.',
      },
    ],
  },
  docs: {
    intro: {
      title: 'Docs',
      body: 'AI-assisted documentation grounded on the detector’s evidence.',
      takeaway: 'The AI never re-derives structure; it explains what was already detected.',
    },
    steps: [
      {
        target: null,
        title: 'Per-line explanations',
        body: 'The AI annotates the lines the detector flagged as load-bearing — typically up to about eight per class. Salient, not exhaustive.',
        takeaway: 'Reads like a senior dev highlighting what matters.',
      },
      {
        target: null,
        title: 'Static fallback',
        body: 'If the AI is offline or times out, NeoTerritory falls back to a deterministic per-pattern template so you never end up with no documentation.',
        takeaway: 'Documentation always lands.',
      },
    ],
  },
  ambiguous: {
    intro: {
      title: 'Self-check',
      body: 'Review and resolve ambiguous matches.',
      takeaway: 'You confirm or reclassify; the AI takes your verdict as ground truth.',
    },
    steps: [
      {
        target: null,
        title: 'Resolve the ambiguity',
        body: 'When the detector emits two or more candidates for the same class, you pick the one that fits. Your choice is saved with the run and forwarded to the AI doc layer.',
        takeaway: 'You disambiguate once; the rest of the pipeline trusts it.',
      },
    ],
  },
};

function buildJoyrideSteps(tab: StudioTab): Step[] {
  const tabConfig = STEPS_BY_TAB[tab];
  return tabConfig.steps.map((s) => ({
    target: s.target ?? 'body',
    title: s.title,
    content: (
      <div>
        <p style={{ margin: '0 0 10px', lineHeight: 1.55 }}>{s.body}</p>
        <p
          style={{
            margin: 0,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.8rem',
            color: 'rgb(0, 209, 216)',
          }}
        >
          → {s.takeaway}
        </p>
      </div>
    ),
    placement: s.target ? 'auto' : 'center',
    disableBeacon: true,
  }));
}

export default function StudioJoyrideTour() {
  const activeTab = useAppStore((state) => state.activeTab);
  const [run, setRun] = useState<boolean>(false);
  const [tourTab, setTourTab] = useState<StudioTab>(activeTab);
  const lastAutoTab = useRef<StudioTab | null>(null);

  // Auto-trigger on first entry to a tab the user hasn't completed yet.
  useEffect(() => {
    if (lastAutoTab.current === activeTab) return;
    lastAutoTab.current = activeTab;
    if (!readCompleted(activeTab)) {
      const id = window.setTimeout(() => {
        setTourTab(activeTab);
        setRun(true);
      }, 600);
      return () => window.clearTimeout(id);
    } else {
      // Switching to a tab whose tour is done -> stop any running tour.
      setRun(false);
    }
  }, [activeTab]);

  // Manual replay event from the studio header "? Tour" button: re-run the
  // current tab's tour from the start regardless of completion flag.
  useEffect(() => {
    function handleForceOpen(): void {
      setTourTab(activeTab);
      setRun(true);
    }
    window.addEventListener(FORCE_OPEN_EVENT, handleForceOpen);
    return () => window.removeEventListener(FORCE_OPEN_EVENT, handleForceOpen);
  }, [activeTab]);

  function handleEvent(data: EventData): void {
    if (data.type === EVENTS.TOUR_END) {
      writeCompleted(tourTab);
      setRun(false);
    }
  }

  return (
    <Joyride
      key={tourTab}
      steps={buildJoyrideSteps(tourTab)}
      run={run}
      continuous
      onEvent={handleEvent}
      options={{
        primaryColor: 'rgb(0, 209, 216)',
        textColor: '#e2e4f0',
        backgroundColor: '#13141a',
        arrowColor: '#13141a',
        overlayColor: 'rgba(0, 0, 0, 0.55)',
        zIndex: 10000,
        showProgress: true,
        closeButtonAction: 'skip',
      }}
    />
  );
}
