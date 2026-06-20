'use client';
// Client wrapper for the read-only assessment results view. Used by
// /assessment-results.
//
// ssr:false — AssessmentResultsPage is browser-only: it reads the signed-in
// learner session and re-grades stored answers client-side. No SSR value.
import dynamic from 'next/dynamic';

const AssessmentResultsPage = dynamic(
  () => import('@frontend/components/learn/AssessmentResultsPage'),
  { ssr: false },
);

export default function AssessmentResultsSurface() {
  return <AssessmentResultsPage />;
}
