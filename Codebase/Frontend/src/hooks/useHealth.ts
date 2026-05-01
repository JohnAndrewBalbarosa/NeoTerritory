import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appState';
import { fetchHealth } from '../api/client';

const POLL_INTERVAL_MS = 15000;

export function useHealth() {
  const { setStatus, setMsStatus, setAiConfigured, setMaxFilesPerSubmission, setDockerStatus } = useAppStore();
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
        // Docker pod isolation status. "online" requires the env flag,
        // Docker on PATH, AND the cpp-pod image to be built. Anything else
        // resolves to a useful "offline (...)" reason on the status card.
        if (h.docker) {
          if (!h.docker.enabled) {
            setDockerStatus('offline', 'disabled');
          } else if (!h.docker.imageReady) {
            setDockerStatus('checking', 'building image…');
          } else {
            setDockerStatus(
              'online',
              h.docker.livePods > 0 ? `online (${h.docker.livePods} pod${h.docker.livePods === 1 ? '' : 's'})` : 'online'
            );
          }
        } else {
          setDockerStatus('offline', 'unavailable');
        }
        setAiConfigured(h.aiProviderConfigured);
        if (typeof h.maxFilesPerSubmission === 'number') {
          setMaxFilesPerSubmission(h.maxFilesPerSubmission);
        }
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
        setDockerStatus('offline', 'backend unreachable');
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
