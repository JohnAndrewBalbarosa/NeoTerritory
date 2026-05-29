'use client';
// Client wrapper for the student learning hub. Used by /patterns/learn (category list)
// and /patterns/learn/<moduleId> (one module).
//
// ssr:false — StudentLearningShell requires the localStorage JWT and reads the path
// client-side, so it is a browser-only island (no SSR value). Per D89.
import dynamic from 'next/dynamic';

const StudentLearningShell = dynamic(
  () => import('@frontend/components/learn/StudentLearningShell'),
  { ssr: false },
);

export default function LearnHubSurface() {
  return <StudentLearningShell />;
}
