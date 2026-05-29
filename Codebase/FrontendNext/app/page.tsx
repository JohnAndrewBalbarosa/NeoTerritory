'use client';

// Home surface (`/`). Reuses the existing HeroLanding verbatim from the shared Vite
// source (D89). Marked 'use client' because HeroLanding uses browser APIs and onClick
// navigation; Next still server-renders its initial HTML for first paint.
import HeroLanding from '@frontend/components/marketing/HeroLanding';

export default function HomePage() {
  return <HeroLanding />;
}
