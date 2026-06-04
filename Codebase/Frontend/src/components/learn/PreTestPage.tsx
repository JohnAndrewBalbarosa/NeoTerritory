import { useEffect } from 'react';
import { navigate } from '../../logic/router';
import { useAppStore } from '../../store/appState';
import LearningAssessmentPage from './LearningAssessmentPage';

export default function PreTestPage(): JSX.Element {
  const preTestCompleted = useAppStore((s) => s.preTestCompleted);

  useEffect(() => {
    if (preTestCompleted) {
      navigate('/patterns/learn');
    }
  }, [preTestCompleted]);

  return <LearningAssessmentPage assessmentType="pretest" autoAdvance />;
}
