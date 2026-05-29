'use client';
// Client wrapper for the role-based onboarding flow. ssr:false — OnboardingFlow checks the
// localStorage JWT and routes by role in the browser; no SSR value. Per D89.
import dynamic from 'next/dynamic';

const OnboardingFlow = dynamic(
  () => import('@frontend/components/auth/OnboardingFlow'),
  { ssr: false },
);

export default function OnboardingSurface() {
  return <OnboardingFlow />;
}
