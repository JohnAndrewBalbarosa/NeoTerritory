'use client';
// Client wrapper for the Studio app (the analysis IDE). Used by the studio alias routes
// (/studio, /app, /developer, /student-studio).
//
// ssr:false — StudioApp is a large browser-only surface (localStorage JWT, EventSource
// SSE, editor, GDB runner) with no SSR value. Rendering it client-only avoids window/
// localStorage access during server render and keeps the heavy bundle off the server
// path. Per D89, auth-gated surfaces are browser-only islands.
import dynamic from 'next/dynamic';

const StudioApp = dynamic(() => import('@frontend/components/studio/StudioApp'), {
  ssr: false,
});

export default function StudioSurface() {
  return <StudioApp />;
}
