import LearningAssessmentPage from './LearningAssessmentPage';

export default function PreTestPage(): JSX.Element {
  // D93: redundant navigation effect removed. After a successful submission
  // LearningAssessmentPage shows the Pre-Test Summary (phase='done'); the
  // "Continue to Dashboard" button there navigates to meta.nextPath
  // (/intern-dashboard). The pre-test never redirects straight to the dashboard.
  return <LearningAssessmentPage assessmentType="pretest" />;
}
