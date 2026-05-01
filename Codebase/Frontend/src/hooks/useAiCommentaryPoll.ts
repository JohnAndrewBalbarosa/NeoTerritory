import { useEffect } from 'react';
import { useAppStore } from '../store/appState';
import { pollAiJob } from '../api/client';

const POLL_INTERVAL_MS = 1500;
const MAX_TRIES = 60;

export function useAiCommentaryPoll() {
  const { aiJobId, aiStatus, setAiStatus, mergeAiAnnotations, mergeAiEducation } = useAppStore();

  useEffect(() => {
    if (!aiJobId || aiStatus !== 'pending') return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick(): Promise<void> {
      if (cancelled || !aiJobId) return;
      tries += 1;
      try {
        const res = await pollAiJob(aiJobId);
        if (cancelled) return;
        if (res.status === 'ready') {
          if (res.annotations) mergeAiAnnotations(res.annotations);
          if (res.educationByPatternKey) mergeAiEducation(res.educationByPatternKey);
          setAiStatus('ready');
          return;
        }
        if (res.status === 'failed') {
          setAiStatus('failed');
          return;
        }
      } catch {
        // Ignore transient errors; continue polling until MAX_TRIES.
      }
      if (tries >= MAX_TRIES) {
        if (!cancelled) setAiStatus('failed');
        return;
      }
      timer = setTimeout(() => { void tick(); }, POLL_INTERVAL_MS);
    }

    timer = setTimeout(() => { void tick(); }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [aiJobId, aiStatus, setAiStatus, mergeAiAnnotations, mergeAiEducation]);
}
