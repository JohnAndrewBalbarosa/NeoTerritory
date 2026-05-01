import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appState';
import { fetchHealth } from '../api/client';

const POLL_INTERVAL_MS = 15000;

export function useHealth() {
  const { setStatus, setMsStatus, setAiConfigured } = useAppStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function poll() {
    fetchHealth()
      .then(h => {
        const ms = h.microservice;
        if (ms.connected) {
          setMsStatus('online', 'online');
        } else {
          const reason = !ms.binaryFound ? 'binary missing' : !ms.catalogFound ? 'catalog missing' : 'unreachable';
          setMsStatus('offline', `offline (${reason})`);
        }
        setAiConfigured(h.aiProviderConfigured);
        setStatus({
          kind: 'ok',
          title: 'API ok',
          detail: `${h.service} • ${h.totalRuns} run(s)${h.aiProviderConfigured ? ' • AI on' : ' • AI off'}`
        });
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : 'unreachable';
        setMsStatus('offline', err?.name === 'AbortError' ? 'offline (timeout)' : 'offline (unreachable)');
        setStatus({ kind: 'error', title: 'API offline', detail: msg });
        timerRef.current = setTimeout(poll, 3000);
      });
  }

  useEffect(() => {
    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
