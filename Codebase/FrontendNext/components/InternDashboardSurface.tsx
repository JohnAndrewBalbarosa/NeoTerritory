'use client';
// Client wrapper for the Intern Dashboard. Used by /intern-dashboard.
//
// ssr:false — InternDashboard is a browser-only surface that reads the signed-in
// learner session and localStorage unlock override. It has no SSR value.
import dynamic from 'next/dynamic';

const InternDashboard = dynamic(
  () => import('@frontend/components/learn/InternDashboard'),
  { ssr: false },
);

export default function InternDashboardSurface() {
  return <InternDashboard />;
}
