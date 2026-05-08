// Fire-and-forget frontend event logger. The backend stores the event in
// the same `logs` table backend services write to; the admin LogsView
// separates them by namespace prefix (`frontend.*`).
//
// Failures are silent on purpose: telemetry must never break the app.

import { apiFetch } from '../api/client';

export type FrontendEventType =
  | 'frontend.run_dispatch'
  | 'frontend.run_complete'
  | 'frontend.run_failed'
  | 'frontend.sample_load'
  | 'frontend.clear'
  | 'frontend.discard_run'
  | 'frontend.sign_in'
  | 'frontend.sign_out'
  | 'frontend.tab_change'
  | 'frontend.gdb_test'
  | 'frontend.error';

export function logFrontendEvent(eventType: FrontendEventType, message?: string): void {
  void apiFetch('/api/log/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, message: message ?? '' }),
  }).catch(() => {});
}
