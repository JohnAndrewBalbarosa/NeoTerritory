import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appState';
import { sendHeartbeat, sendDisconnectBeacon, fetchHealth, refreshGuest } from '../api/client';

// Beat once every 60s. Backend grace window is 600s, so even one missed beat
// is fine, but two in a row will free the seat.
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
// Refresh guest token every 15 minutes to maintain the 30-minute rolling session.
const GUEST_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

// Fired immediately on mount once authenticated; not waited on so the UI
// renders without a roundtrip.
export function useHeartbeat() {
  const token = useAppStore(s => s.token);
  const user = useAppStore(s => s.user);
  const tokenRef = useRef(token);
  const lastGuestRefreshRef = useRef(0);
  tokenRef.current = token;

  useEffect(() => {
    if (!token) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    function beat() {
      // Beat even when tab is hidden: a backgrounded tab keeps its seat as
      // long as the browser keeps the timer alive.
      void sendHeartbeat();

      // Guest Refresh Logic: keep the 10m rolling session alive every 2m.
      if (user?.role === 'guest' && Date.now() - lastGuestRefreshRef.current > GUEST_REFRESH_INTERVAL_MS) {
        lastGuestRefreshRef.current = Date.now();
        void refreshGuest().then(({ token, user }) => {
          useAppStore.getState().setAuth(token, user);
        }).catch(err => {
          console.error('Guest session refresh failed:', err);
          // If refresh fails (e.g. 401), apiFetch already clears auth/redirects.
        });
      }

      // Piggy-back the health probe onto every heartbeat so the studio's
      // status card (microservice / docker / livePods) stays fresh
      // without a second polling timer. Errors are swallowed — the status
      // card already handles offline states gracefully.
      void fetchHealth().then(h => {
        const s = useAppStore.getState();

        // ── 1. Microservice — flip BOTH directions, not just online.
        const ms = h.microservice;
        if (ms?.connected) {
          s.setMsStatus('online', 'online');
        } else if (ms) {
          const reason = !ms.binaryFound  ? 'binary missing'
                       : !ms.catalogFound ? 'catalog missing'
                       : 'unreachable';
          s.setMsStatus('offline', `offline (${reason})`);
        }

        // ── 2. Docker service — pod count + per-user mine suffix.
        if (h.docker) {
          if (!h.docker.enabled) {
            const reasonLabel =
              h.docker.reason === 'env_off'     ? 'disabled (env)' :
              h.docker.reason === 'no_binary'   ? 'disabled (docker not on PATH)' :
              h.docker.reason === 'daemon_down' ? 'disabled (start Docker Desktop)' :
              'disabled';
            s.setDockerStatus('offline', reasonLabel);
          } else if (!h.docker.imageReady) {
            s.setDockerStatus('checking', 'building image…');
          } else {
            const podSuffix = h.docker.livePods > 0
              ? ` (${h.docker.livePods} pod${h.docker.livePods === 1 ? '' : 's'})`
              : '';
            const mineSuffix = h.docker.mine ? ' (your pod active)' : '';
            s.setDockerStatus('online', `online${podSuffix}${mineSuffix}`);
          }
        }

        // ── 3. AI configured — flip the chip when the operator sets the
        //      key without restarting the studio.
        s.setAiConfigured(h.aiProviderConfigured === true);
      }).catch(() => { /* ignore — useHealth's mount probe surfaces backend-unreachable */ });
    }

    void sendHeartbeat();
    timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);

    function onPageHide() {
      sendDisconnectBeacon(tokenRef.current);
    }
    function onVisibilityChange() {
      // Some mobile browsers fire visibilitychange + 'hidden' before pagehide
      // when the user navigates away. Send the beacon proactively; it's idempotent.
      if (document.visibilityState === 'hidden') {
        // Don't fire the disconnect on every backgrounding — we still want the
        // seat held while the tab is alive. Only beat to keep it warm.
        beat();
      }
    }

    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [token, user?.role]);
}
