import { useEffect, useRef, useState } from 'react';
import {
  Joyride,
  EVENTS,
  ACTIONS,
  type EventData,
  type Step,
  type TooltipRenderProps,
} from 'react-joyride';
import { useAppStore, type StudioTab } from '../../store/appState';

// Per-tab auto-firing Joyride. Goals this turn:
//   - Auto-fire on EVERY tab the user hasn't completed yet. The popover
//     opens directly — no "click this" beacons / circles at any layer.
//   - Per-tab completion flag (nt_studio_tour_completed__<tab>). Finishing
//     or closing the tour for a tab silences that tab only; siblings keep
//     auto-firing on first visit.
//   - Global "don't show again" flag (nt_studio_tour_suppressed). The
//     tour's Skip button writes this — once set, no tab auto-fires ever
//     again for this user. Manual replay via "? Tour" still works.
//   - Manual replay button (dispatches FORCE_OPEN_EVENT) ignores both
//     flags and shows the tour for the current tab.
//   - Account users persist flags in localStorage keyed by user.id.
//     Guest/tester users (devconN) use sessionStorage so every new
//     tester session re-orients them.
//   - Before showing each step, the orchestrator waits up to a short
//     budget for the target DOM element to exist. Steps whose targets
//     never resolve are dropped from that run rather than rendering as
//     centered placeholders.

const COMPLETED_KEY_PREFIX = 'nt_studio_tour_completed__';
const SUPPRESSED_KEY = 'nt_studio_tour_suppressed';
const FORCE_OPEN_EVENT = 'nt:studio-tour:open';
const TARGET_WAIT_MS = 1500;
const TARGET_POLL_MS = 80;

export function dispatchStudioTourOpen(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FORCE_OPEN_EVENT));
}

interface ScopedKey {
  storage: Storage | null;
  key: string;
}

function getScopedKey(baseKey: string): ScopedKey {
  if (typeof window === 'undefined') {
    return { storage: null, key: baseKey };
  }
  const state = useAppStore.getState();
  const user = state.user;
  // Guest/tester usernames look like devcon1..devconN. Anyone with a
  // different username has signed in through the account flow.
  const isGuest = !user || /^devcon\d+$/i.test(user.username || '');
  const storage = isGuest ? window.sessionStorage : window.localStorage;
  const idPart = !isGuest && user ? `__${user.id ?? user.username}` : '';
  return { storage, key: `${baseKey}${idPart}` };
}

function readTabCompleted(tab: StudioTab): boolean {
  try {
    const { storage, key } = getScopedKey(`${COMPLETED_KEY_PREFIX}${tab}`);
    if (!storage) return false;
    return storage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeTabCompleted(tab: StudioTab): void {
  try {
    const { storage, key } = getScopedKey(`${COMPLETED_KEY_PREFIX}${tab}`);
    if (!storage) return;
    storage.setItem(key, '1');
  } catch {
    /* storage blocked */
  }
}

function readSuppressed(): boolean {
  try {
    const { storage, key } = getScopedKey(SUPPRESSED_KEY);
    if (!storage) return false;
    return storage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeSuppressed(): void {
  try {
    const { storage, key } = getScopedKey(SUPPRESSED_KEY);
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
      // The content here is body + takeaway. The "Don't show again" checkbox
      // lives in the custom tooltipComponent (TourTooltip below), not inside
      // each step's content, so it stays consistent across every step and
      // its state isn't recreated each time the step re-renders.
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
      skipBeacon: true,
    } as Step);
  }
  return resolved;
}

// Custom tooltip with an explicit "Don't show again" checkbox in the footer.
// The checkbox state is hoisted into the parent component via a ref-based
// setter so handleEvent can read it on TOUR_END to decide whether to fire
// the global suppression flag.
interface TourTooltipProps extends TooltipRenderProps {
  dontShowAgain: boolean;
  setDontShowAgain: (v: boolean) => void;
}

function TourTooltip(props: TourTooltipProps): JSX.Element {
  const {
    backProps,
    closeProps,
    index,
    isLastStep,
    primaryProps,
    skipProps,
    step,
    tooltipProps,
    size,
    dontShowAgain,
    setDontShowAgain,
  } = props;

  return (
    <div
      {...tooltipProps}
      style={{
        background: '#13141a',
        color: '#e2e4f0',
        borderRadius: 12,
        padding: '14px 16px 12px',
        maxWidth: 360,
        boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45)',
        border: '1px solid rgba(0, 209, 216, 0.22)',
      }}
    >
      <button
        {...closeProps}
        aria-label="Close tour"
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          background: 'transparent',
          border: 0,
          color: 'rgba(226, 228, 240, 0.7)',
          fontSize: 18,
          cursor: 'pointer',
          padding: 4,
          lineHeight: 1,
        }}
      >
        ×
      </button>

      {step.title ? (
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700 }}>
          {step.title}
        </h3>
      ) : null}

      <div style={{ fontSize: '0.92rem', lineHeight: 1.55 }}>{step.content}</div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.82rem',
          color: 'rgba(226, 228, 240, 0.78)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={dontShowAgain}
          onChange={(e) => setDontShowAgain(e.target.checked)}
          aria-label="Do not show this tour again"
          style={{ cursor: 'pointer' }}
        />
        Don&rsquo;t show this tour again
      </label>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 10,
          gap: 8,
        }}
      >
        <button
          {...skipProps}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'rgba(226, 228, 240, 0.7)',
            borderRadius: 999,
            padding: '6px 12px',
            fontSize: '0.78rem',
            cursor: 'pointer',
          }}
        >
          Skip
        </button>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.74rem',
              color: 'rgba(226, 228, 240, 0.55)',
            }}
            aria-hidden="true"
          >
            {index + 1}/{size}
          </span>

          {index > 0 ? (
            <button
              {...backProps}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#e2e4f0',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          ) : null}

          <button
            {...primaryProps}
            style={{
              background: 'rgb(0, 209, 216)',
              border: 0,
              color: '#0a0c12',
              fontWeight: 700,
              borderRadius: 999,
              padding: '7px 14px',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {isLastStep ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StudioJoyrideTour() {
  const activeTab = useAppStore((state) => state.activeTab);
  const user = useAppStore((state) => state.user);
  const [run, setRun] = useState<boolean>(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [tourTab, setTourTab] = useState<StudioTab>(activeTab);
  // runId is bumped every time a tour starts, used as the React key on the
  // Joyride component so a stale run is fully unmounted before the new one
  // mounts. Without this, re-clicking "? Tour" on the same tab the user just
  // finished did nothing (Joyride state was stale).
  const [runId, setRunId] = useState<number>(0);
  // Checkbox state for the in-tooltip "Don't show again" toggle. Reset to
  // false whenever a fresh tour starts so each replay decides for itself.
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);
  // Refs so handleEvent can read the latest values without re-binding on
  // every Joyride callback.
  const dontShowAgainRef = useRef<boolean>(false);
  dontShowAgainRef.current = dontShowAgain;
  const tourTabRef = useRef<StudioTab>(tourTab);
  tourTabRef.current = tourTab;

  function startTour(forTab: StudioTab, newSteps: Step[]): void {
    setTourTab(forTab);
    setSteps(newSteps);
    setDontShowAgain(false);
    setRunId((id) => id + 1);
    setRun(true);
  }

  // Auto-fire on every tab change where:
  //   - global suppression is NOT set (user hasn't ticked "Don't show again")
  //   - this specific tab hasn't been completed yet
  // The effect re-runs on activeTab so siblings get their own popover the
  // first time the user lands on them, instead of one global one-shot.
  useEffect(() => {
    if (readSuppressed()) {
      setRun(false);
      return;
    }
    if (readTabCompleted(activeTab)) {
      setRun(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const resolved = await resolveStepsForTab(activeTab);
      if (cancelled || resolved.length === 0) return;
      startTour(activeTab, resolved);
    })();
    return () => {
      cancelled = true;
    };
    // user is included so a sign-in/sign-out (which changes which storage
    // scope holds the flags) re-evaluates auto-fire eligibility.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user]);

  // Manual replay event from the studio header "? Tour" button. This path
  // ignores both the per-tab and global suppression flags — the user
  // explicitly asked to see the tour again, for whichever tab they are on
  // right now. Bumping runId via startTour forces a fresh Joyride mount
  // even when the user replays the same tab they just finished.
  useEffect(() => {
    function handleForceOpen(): void {
      void (async () => {
        const resolved = await resolveStepsForTab(activeTab);
        if (resolved.length === 0) return;
        startTour(activeTab, resolved);
      })();
    }
    window.addEventListener(FORCE_OPEN_EVENT, handleForceOpen);
    return () => window.removeEventListener(FORCE_OPEN_EVENT, handleForceOpen);
  }, [activeTab]);

  function handleEvent(data: EventData): void {
    // Two terminating intents:
    //   - SKIP (action === 'skip') OR dontShowAgain checkbox ticked at the
    //     time TOUR_END fires → global suppression. No tab auto-fires for
    //     this user from now on (manual replay via "? Tour" still works).
    //   - Anything else that ends the tour (finished walk-through, closed
    //     via X) → mark this tab complete only. Sibling tabs keep firing.
    if (data.type === EVENTS.TOUR_END) {
      const skip = data.action === ACTIONS.SKIP;
      if (skip || dontShowAgainRef.current) {
        writeSuppressed();
      } else {
        writeTabCompleted(tourTabRef.current);
      }
      setRun(false);
    }
  }

  if (steps.length === 0) return null;

  return (
    <Joyride
      key={`${tourTab}-${runId}`}
      steps={steps}
      run={run}
      continuous
      onEvent={handleEvent}
      tooltipComponent={(p: TooltipRenderProps) => (
        <TourTooltip
          {...p}
          dontShowAgain={dontShowAgain}
          setDontShowAgain={setDontShowAgain}
        />
      )}
      options={{
        // skipBeacon kills the pulsing circle at every step — the tooltip
        // opens directly, no "click this dot" affordance ever.
        skipBeacon: true,
        // Render the Skip button so the in-tooltip Skip handler (which also
        // routes through ACTIONS.SKIP in handleEvent) has a backing trigger
        // for keyboard / accessibility paths.
        buttons: ['back', 'skip', 'close', 'primary'],
        showProgress: true,
        primaryColor: 'rgb(0, 209, 216)',
        textColor: '#e2e4f0',
        backgroundColor: '#13141a',
        arrowColor: '#13141a',
        overlayColor: 'rgba(0, 0, 0, 0.55)',
        zIndex: 10000,
        closeButtonAction: 'close',
      }}
    />
  );
}
