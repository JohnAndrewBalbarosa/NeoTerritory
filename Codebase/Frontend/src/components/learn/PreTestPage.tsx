import LearningAssessmentPage from './LearningAssessmentPage';

export default function PreTestPage(): JSX.Element {
  // D93: redundant navigation effect removed. LearningAssessmentPage handles
  // navigation to meta.nextPath (/patterns/learn) via its own handleContinue / 
  // autoAdvance logic once finalizeAssessment completes.
  return <LearningAssessmentPage assessmentType="pretest" />;
}
