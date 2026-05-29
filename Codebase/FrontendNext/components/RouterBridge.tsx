'use client';

// Compat bridge (D89): wires the shared custom router's navigate()/replaceUrl() to Next's
// App Router. Without this, the shared components' pushState-based navigation would change
// the URL without loading the matching Next route segment. Registers Next's router.push/
// replace as the external navigator on mount; clears it on unmount. Renders nothing.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setExternalNavigator } from '@frontend/logic/router';

export default function RouterBridge() {
  const router = useRouter();
  useEffect(() => {
    setExternalNavigator((path, opts) => {
      if (opts?.replace) router.replace(path);
      else router.push(path);
    });
    return () => setExternalNavigator(null);
  }, [router]);
  return null;
}
