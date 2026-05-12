import { useEffect, useRef, useState } from 'react';
import { Joyride, EVENTS, type EventData, type Step } from 'react-joyride';
import { useAppStore, type StudioTab } from '../../store/appState';

// Session-aware Joyride. Goals this turn:
//   - First-session ONLY auto-fire. The tour appears once on the user's
//     first studio entry and never auto-opens again. No "click this"
//     circles, no per-tab beacons — the dialog opens itself directly.
//   - One completion flag per user, NOT per tab. Previously the tour
//     re-fired every time the user landed on a new tab; that turned the
//     orientation into noise. Now: complete it (or close it) once and
//     it's done.
//   - Manual replay still works via the "? Tour" button in the studio
//     header (dispatches FORCE_OPEN_EVENT). The button shows the tour
//     for whichever tab the user is currently on.
//   - Account users (any non-devcon username) persist completion in
//     localStorage keyed by user.id. Guest/tester users (devconN) use
//     sessionStorage so every new tester session re-orients them.
//   - Before showing each step, the orchestrator waits up to a short
//     budget for the target DOM element to exist. Steps whose targets
//     never resolve are dropped from that run rather than rendering as
//     centered placeholders.

const COMPLETED_KEY = 'nt_studio_tour_completed';
const FORCE_OPEN_EVENT = 'nt:studio-tour:open';
const TARGET_WAIT_MS = 1500;
const TARGET_POLL_MS = 80;

export function dispatchStudioTourOpen(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FORCE_OPEN_EVENT));
}

interface CompletionScope {
  storage: Storage | null;
  key: string;
}

function getCompletionScope(): CompletionScope {
  if (typeof window === 'undefined') {
    return { storage: null, key: COMPLETED_KEY };
  }
  const state = useAppStore.getState();
  const user = state.user;
  // Guest/tester usernames look like devcon1..devconN. Anyone with a
  // different username has signed in through the account flow.
  const isGuest = !user || /^devcon\d+$/i.test(user.username || '');
  const storage = isGuest ? window.sessionStorage : window.localStorage;
  const idPart = !isGuest && user ? `__${user.id ?? user.username}` : '';
  return {
    storage,
    key: `${COMPLETED_KEY}${idPart}`,
  };
}

function readCompleted(): boolean {
  try {
    const { storage, key } = getCompletionScope();
    if (!storage) return false;
    return storage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeCompleted(): void {
  try {
    const { storage, key } = getCompletionScope();
    if (!storage) return;
    storage.setItem(key, '1');
  } catch {
    /* storage blocked */
  }
}

interface TabStepDef {
  target: string | null;
  title: string;
  body: string;
  takeaway: string;
}

interface TabSteps {
  steps: ReadonlyArray<TabStepDef>;
}

const STEPS_BY_TAB: Record<StudioTab, TabSteps> = {
  submit: {
    steps: [
      {
        target: '#load-sample-btn',
        title: 'Load a sample',
        body: 'Pick a real-world C++ file from the picker. Samples are grouped by family (Creational, Structural, Behavioural, Idioms).',
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
    steps: [
      {
        target: '.tag-progress',
        title: 'Tag progress',
        body: 'This strip shows how many classes are still ambiguous and how many you have already tagged. The count drops as you resolve each one.',
        takeaway: 'Resolve classes top-to-bottom; the badge updates live.',
      },
      {
        target: '.class-tree-view',
        title: 'Class tree',
        body: 'Every detected class lands here with its pattern verdict. A class marked "review" has two or more competing candidates and is waiting for your call.',
        takeaway: 'Scan the tree to see which classes still need attention.',
      },
      {
        target: '.class-tree-review-cta',
        title: 'Resolve a class root',
        body: 'Click the "(review - N patterns)" button on a class. A picker opens with each candidate; choose the pattern that fits. Your verdict propagates to every line under that class.',
        takeaway: 'One click clears every ambiguous line under the class.',
      },
      {
        target: '.src-line.has-ambiguous',
        title: 'Or resolve line-by-line',
        body: 'Each line with multiple candidate patterns shows a popover badge. Click the line to disambiguate that specific line - useful when one class hosts more than one pattern role.',
        takeaway: 'Class-level OR line-level. Both feed the same review tally.',
      },
      {
        target: '.class-nav-corner--right',
        title: 'Walk to the next ambiguity',
        body: 'This arrow jumps to the next class whose ambiguity is unresolved. Combined with the resolution buttons above, you can clear an entire run in one pass.',
        takeaway: 'Use the arrow to keep moving; the badge counter updates live.',
      },
    ],
  },
  gdb: {
    steps: [
      {
        target: '.gdb-trophy-banner',
        title: 'Testing Trophy strategy',
        body: 'NeoTerritory tests in five layers (Kent C. Dodds Trophy). Today Compile-and-run and Unit-test execute live; Integration, E2E, and Static analysis are planned and shown here so you know the full strategy.',
        takeaway: 'Integration tests are the meat - they catch what unit tests cannot.',
      },
      {
        target: '.gdb-trophy-phase[data-phase="compile_run"]',
        title: 'Phase 1 - Compile & run',
        body: 'This phase confirms your sample compiles cleanly and produces output. A green pill means the C++ compiler accepted it; a red pill means there was a compile error or the binary did not run.',
        takeaway: 'Green here = your code is syntactically and runnably correct.',
      },
      {
        target: '.gdb-trophy-phase[data-phase="unit_test"]',
        title: 'Phase 2 - Unit test',
        body: 'Per-pattern scaffolds. For each detected pattern (Builder, Singleton, etc.) a generated test verifies the specific functions the detector flagged.',
        takeaway: 'Targets single classes / functions. Fast and surgical.',
      },
      {
        target: '.gdb-phase-pill',
        title: 'Reading verdicts',
        body: 'Green pill (or "pass") = the phase succeeded. Red pill (or "fail") = the phase rejected the code. Duration in milliseconds appears next to the pill.',
        takeaway: 'Color tells the result at a glance.',
      },
    ],
  },
  docs: {
    steps: [
      {
        target: '.docs-read-guide',
        title: 'How to read the docs page',
        body: 'The guide at the top of this tab explains each section of the generated documentation - pattern definitions, code annotations, and where AI commentary lands when present.',
        takeaway: 'Open this once; it stays out of the way after.',
      },
    ],
  },
  ambiguous: {
    steps: [
      {
        target: '#root',
        title: 'Self-check',
        body: 'When the detector emits two or more candidates for the same class, this tab lets you pick the one that fits. Your choice is saved with the run and forwarded to the AI doc layer.',
        takeaway: 'You disambiguate once; the rest of the pipeline trusts it.',
      },
    ],
  },
};

function waitForElement(selector: string, timeoutMs: number): Promise<Element | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  const immediate = document.querySelector(selector);
  if (immediate) return Promise.resolve(immediate);
  return new Promise((resolve) => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        window.clearInterval(id);
        resolve(el);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        window.clearInterval(id);
        resolve(null);
      }
    }, TARGET_POLL_MS);
  });
}

async function resolveStepsForTab(tab: StudioTab): Promise<Step[]> {
  const tabConfig = STEPS_BY_TAB[tab];
  const resolved: Step[] = [];
  for (const s of tabConfig.steps) {
    if (s.target) {
      const el = await waitForElement(s.target, TARGET_WAIT_MS);
      if (!el) continue; // skip steps whose target never appeared
    }
    resolved.push({
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
    } as Step);
  }
  return resolved;
}

export default function StudioJoyrideTour() {
  const activeTab = useAppStore((state) => state.activeTab);
  const user = useAppStore((state) => state.user);
  const [run, setRun] = useState<boolean>(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [tourTab, setTourTab] = useState<StudioTab>(activeTab);
  // Track whether we have already considered auto-firing for this user
  // session. Without this, the effect re-evaluates on every render and a
  // closed tour would re-open itself.
  const autoFireConsidered = useRef<boolean>(false);

  // Auto-trigger ONCE per user session. The trigger fires on the first
  // render where the studio is visible. After that — whether the user
  // completes the tour, skips it, or closes it — the completion flag is
  // written and the tour never auto-opens again for this user.
  useEffect(() => {
    if (autoFireConsidered.current) return;
    autoFireConsidered.current = true;
    if (readCompleted()) {
      setRun(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const resolved = await resolveStepsForTab(activeTab);
      if (cancelled || resolved.length === 0) return;
      setTourTab(activeTab);
      setSteps(resolved);
      setRun(true);
    })();
    return () => {
      cancelled = true;
    };
    // user is the only dep that legitimately changes auto-fire scope
    // (guest vs account storage), and reset_autoFireConsidered triggers
    // a fresh evaluation when the user logs in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Reset auto-fire consideration when the user logs in / out — that
  // changes which storage scope holds the completion flag.
  useEffect(() => {
    autoFireConsidered.current = false;
  }, [user]);

  // Manual replay event from the studio header "? Tour" button. This
  // path ignores the completion flag — the user explicitly asked to see
  // the tour again, for whichever tab they are currently on.
  useEffect(() => {
    function handleForceOpen(): void {
      void (async () => {
        const resolved = await resolveStepsForTab(activeTab);
        if (resolved.length === 0) return;
        setTourTab(activeTab);
        setSteps(resolved);
        setRun(true);
      })();
    }
    window.addEventListener(FORCE_OPEN_EVENT, handleForceOpen);
    return () => window.removeEventListener(FORCE_OPEN_EVENT, handleForceOpen);
  }, [activeTab]);

  function handleEvent(data: EventData): void {
    // Mark the tour completed on any terminating event — finished, skipped,
    // closed via the X. The flag is global per user, not per tab, so
    // ANY terminating event silences future auto-fires.
    if (data.type === EVENTS.TOUR_END) {
      writeCompleted();
      setRun(false);
    }
  }

  if (steps.length === 0) return null;

  return (
    <Joyride
      key={tourTab}
      steps={steps}
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
