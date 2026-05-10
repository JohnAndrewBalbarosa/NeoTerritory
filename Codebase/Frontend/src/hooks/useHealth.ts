import { useEffect } from 'react';
import { useAppStore } from '../store/appState';
import { fetchHealth } from '../api/client';

// One-shot mount probe + retry-on-failure poll. Steady-state polling
// of microservice / docker / AI status now lives on the heartbeat
// (useHeartbeat.ts) so we don't run two competing timers. This hook
// only fires once on mount to seed the status card with data BEFORE
// the first heartbeat lands, and keeps a short retry loop alive while
// the backend is unreachable so the studio recovers without a reload.
export function useHealth() {
  const {
    setStatus, setMsStatus, setAiConfigured, setMaxFilesPerSubmission, setMaxTokensPerFile, setDockerStatus
  } = useAppStore();

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function probe(): void {
      fetchHealth()
        .then(h => {
          if (cancelled) return;
          const ms = h.microservice;
          if (ms.connected) {
            setMsStatus('online', 'online');
          } else {
            const reason = !ms.binaryFound ? 'binary missing'
                         : !ms.catalogFound ? 'catalog missing'
                         : 'unreachable';
            setMsStatus('offline', `offline (${reason})`);
          }
          if (h.docker) {
            if (!h.docker.enabled) {
              const reasonLabel =
                h.docker.reason === 'env_off'     ? 'disabled (env)' :
                h.docker.reason === 'no_binary'   ? 'disabled (docker not on PATH)' :
                h.docker.reason === 'daemon_down' ? 'disabled (start Docker Desktop)' :
                'disabled';
              setDockerStatus('offline', reasonLabel);
            } else if (!h.docker.imageReady) {
              setDockerStatus('checking', 'building image…');
            } else {
              const podSuffix = h.docker.livePods > 0
                ? ` (${h.docker.livePods} pod${h.docker.livePods === 1 ? '' : 's'})`
                : '';
              const mineSuffix = h.docker.mine ? ' (your pod active)' : '';
              setDockerStatus('online', `online${podSuffix}${mineSuffix}`);
            }
          } else {
            setDockerStatus('offline', 'unavailable');
          }
          setAiConfigured(h.aiProviderConfigured);
          if (typeof h.maxFilesPerSubmission === 'number') {
            setMaxFilesPerSubmission(h.maxFilesPerSubmission);
          }
          if (typeof h.maxTokensPerFile === 'number') {
            setMaxTokensPerFile(h.maxTokensPerFile);
          }
          setStatus({
            kind: 'ok',
            title: 'API ok',
            detail: `${h.service} • ${h.totalRuns} run(s)${h.aiProviderConfigured ? ' • AI on' : ' • AI off'}`
          });
          // Probe succeeded — heartbeat takes over from here.
        })
        .catch(err => {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : 'unreachable';
          setMsStatus('offline', err?.name === 'AbortError' ? 'offline (timeout)' : 'offline (unreachable)');
          setDockerStatus('offline', 'backend unreachable');
          setStatus({ kind: 'error', title: 'API offline', detail: msg });
          // Backend down — retry every 3s until it answers; once it does,
          // the heartbeat poll (every 30s) takes over.
          retryTimer = setTimeout(probe, 3000);
        });
    }

    probe();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
