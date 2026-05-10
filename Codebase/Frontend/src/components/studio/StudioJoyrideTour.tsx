import { useEffect, useState } from 'react';
import { Joyride, EVENTS, type EventData, type Step } from 'react-joyride';
import { TOUR_STEPS } from '../marketing/tour/tourSteps';

// In-studio interactive tour using react-joyride v3.x. Per user direction:
// same content source as the public /tour page (TOUR_STEPS) so the two
// surfaces cannot drift. Triggered on first studio entry; replayable from
// the studio header's "? Tour" button via dispatchStudioTourOpen().

const COMPLETED_KEY = 'nt_studio_tour_completed';
const FORCE_OPEN_EVENT = 'nt:studio-tour:open';

export function dispatchStudioTourOpen(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FORCE_OPEN_EVENT));
}

function readCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COMPLETED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCompleted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COMPLETED_KEY, '1');
  } catch {
    /* storage blocked */
  }
}

const TARGET_BY_SLUG: Record<string, string | null> = {
  'sign-in': null,
  'land-on-submit': '#analysis-form',
  'load-a-sample': '#load-sample-btn',
  'click-analyze': '#analyze-btn',
  'read-the-card': '#analysis-form',
  'generate-docs': null,
  'save-the-run': null,
  'open-history': null,
};

function buildJoyrideSteps(): Step[] {
  return TOUR_STEPS.map((s) => {
    const target = TARGET_BY_SLUG[s.slug] ?? null;
    return {
      target: target ?? 'body',
      title: `${s.num.toString().padStart(2, '0')} · ${s.title}`,
      content: (
        <div>
          <p style={{ margin: '0 0 10px', lineHeight: 1.55 }}>{s.paragraph}</p>
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
      placement: target ? 'auto' : 'center',
      disableBeacon: true,
    } as Step;
  });
}

export default function StudioJoyrideTour() {
  const [run, setRun] = useState<boolean>(false);

  useEffect(() => {
    if (!readCompleted()) {
      const id = window.setTimeout(() => setRun(true), 600);
      return () => window.clearTimeout(id);
    }
  }, []);

  useEffect(() => {
    function handleForceOpen(): void {
      setRun(true);
    }
    window.addEventListener(FORCE_OPEN_EVENT, handleForceOpen);
    return () => window.removeEventListener(FORCE_OPEN_EVENT, handleForceOpen);
  }, []);

  function handleEvent(data: EventData): void {
    if (data.type === EVENTS.TOUR_END) {
      writeCompleted();
      setRun(false);
    }
  }

  return (
    <Joyride
      steps={buildJoyrideSteps()}
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
