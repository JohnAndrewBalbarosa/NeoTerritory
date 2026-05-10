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
        // Top-level progress strip.
        target: '.tag-progress',
        title: 'Tag progress',
        body: 'This strip shows how many classes are still ambiguous and how many you have already tagged. The count drops as you resolve each one.',
        takeaway: 'Resolve classes left-to-right, top-to-bottom.',
      },
      {
        // The Class Tree sidebar — root resolution lives here.
        target: '.class-tree-view',
        title: 'Class tree',
        body: 'Every detected class lands here with its pattern verdict. A class marked "review" has two or more competing candidates and is waiting for your call.',
        takeaway: 'Scan the tree to see which classes still need attention.',
      },
      {
        // The per-class "(review - N patterns)" button opens the root picker.
        target: '.class-tree-review-cta',
        title: 'Resolve a class root',
        body: 'Click the "(review - N patterns)" button on a class. A picker opens with each candidate; choose the pattern that fits. Your verdict propagates to every line under that class.',
        takeaway: 'One click clears every ambiguous line under the class.',
      },
      {
        // Per-line ambiguity: highlight an actual ambiguous source line.
        target: '.src-line.has-ambiguous',
        title: 'Or resolve line-by-line',
        body: 'Each line with multiple candidate patterns shows a popover badge (".src-popover-ambiguous-badge"). Click the line to open the picker and disambiguate that line specifically — useful when one class hosts more than one pattern role.',
        takeaway: 'Class-level OR line-level. Both feed the same review tally.',
      },
      {
        // Jump-to-next-ambiguous control.
        target: '.class-nav-corner--right',
        title: 'Walk to the next ambiguity',
        body: 'This arrow jumps to the next class whose ambiguity is unresolved. Combined with the resolution buttons above, you can clear an entire run in one pass.',
        takeaway: 'Use the arrow to keep moving; the badge counter updates live.',
      },
    ],
  },
  gdb: {
    intro: {
      title: 'Tests',
      body: 'Pre-templated tests for each detected pattern, following the Testing Trophy strategy.',
      takeaway: 'Pass = green. Fail = red. The trophy banner explains each layer.',
    },
    steps: [
      {
        target: '.gdb-trophy-banner',
        title: 'Testing Trophy strategy',
        body: 'NeoTerritory tests in five layers (Kent C. Dodds Trophy). Today, Compile-and-run and Unit-test execute live; Integration, E2E, and Static analysis are planned and shown here so you know the full strategy.',
        takeaway: 'Integration tests are the meat — they catch what unit tests cannot.',
      },
      {
        target: '.gdb-trophy-phase[data-phase="compile_run"]',
        title: 'Phase 1 — Compile & run',
        body: 'This phase confirms your sample compiles cleanly and produces output. A green pill means the C++ compiler accepted it; a red pill means there was a compile error or the binary did not run.',
        takeaway: 'Green here = your code is syntactically + runnably correct.',
      },
      {
        target: '.gdb-trophy-phase[data-phase="unit_test"]',
        title: 'Phase 2 — Unit test',
        body: 'Per-pattern scaffolds. For each detected pattern (Builder, Singleton, etc.), a generated test verifies the specific functions the detector flagged. Pass = the function meets the contract the pattern implies.',
        takeaway: 'Targets single classes / functions. Fast and surgical.',
      },
      {
        target: '.gdb-trophy-phase[data-phase="integration"]',
        title: 'Phase 3 — Integration test (planned)',
        body: 'Exercises the FULL pipeline: real microservice + backend route + AI fallback path against curated samples. This is the bulk of the Trophy — the bugs that hurt users live at the seams between these processes.',
        takeaway: 'Tests the seams. Not yet wired; UI labelled "planned".',
      },
      {
        target: '.gdb-trophy-phase[data-phase="e2e"]',
        title: 'Phase 4 — End-to-end (planned)',
        body: 'Playwright drives the actual studio from sign-in through analyze to docs. Catches UI regressions and route changes that integration tests miss.',
        takeaway: 'Tests what the user sees. Planned. CI workflow is ready.',
      },
      {
        target: '.gdb-trophy-phase[data-phase="static"]',
        title: 'Phase 5 — Static analysis (planned)',
        body: 'The broad base of the Trophy: clang-tidy / cppcheck / ESLint scan every file every build. Catches style violations and unsafe patterns before runtime.',
        takeaway: 'Cheapest tier. Runs on every commit.',
      },
      {
        target: '.gdb-phase-pill',
        title: 'Reading verdicts',
        body: 'Green pill (or "pass") = the phase succeeded. Red pill (or "fail") = the phase rejected the code. The duration in milliseconds appears next to the pill so you can see slow tests.',
        takeaway: 'Color tells the result at a glance.',
      },
      {
        target: 'button:has-text("Run all tests")',
        title: 'Re-run everything',
        body: 'Click here to re-run all live phases (compile_run + unit_test) against the current submission. Cooldowns appear if you re-run too fast; the studio enforces a per-minute budget.',
        takeaway: 'Re-run after edits to confirm the pattern still holds.',
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
