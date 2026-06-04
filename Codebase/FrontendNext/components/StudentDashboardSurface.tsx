'use client';
// Client wrapper for the student dashboard. Used by /student-dashboard.
//
// ssr:false — StudentDashboard is a browser-only surface that reads the signed-in
// learner session and localStorage unlock override. It has no SSR value.
import dynamic from 'next/dynamic';

const StudentDashboard = dynamic(
  () => import('@frontend/components/learn/StudentDashboard'),
  { ssr: false },
);

export default function StudentDashboardSurface() {
  return <StudentDashboard />;
}
