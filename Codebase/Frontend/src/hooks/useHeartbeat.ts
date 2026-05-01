import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appState';
import { sendHeartbeat, sendDisconnectBeacon } from '../api/client';

// Beat once every 30s. Backend grace window is 90s, so even one missed beat
// is fine, but two in a row will free the seat.
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

// Fired immediately on mount once authenticated; not waited on so the UI
// renders without a roundtrip.
export function useHeartbeat() {
  const token = useAppStore(s => s.token);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!token) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    function beat() {
      // Beat even when tab is hidden: a backgrounded tab keeps its seat as
      // long as the browser keeps the timer alive.
      void sendHeartbeat();
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
  }, [token]);
}
