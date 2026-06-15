import { useEffect, useMemo, useRef } from 'react';
import { navigate } from '../../logic/router';
import { resolvePreTestNext } from '../../logic/learnerRouting';
import { useAppStore } from '../../store/appState';
import LearningAssessmentPage from './LearningAssessmentPage';

export default function PreTestPage(): JSX.Element {
  const preTestCompleted = useAppStore((s) => s.preTestCompleted);
  const wasCompletedRef = useRef(preTestCompleted);
  const nextPath = useMemo(() => {
    if (typeof window === 'undefined') return '/patterns/learn';
    return resolvePreTestNext(new URL(window.location.href).searchParams.get('next'));
  }, []);

  useEffect(() => {
    if (!wasCompletedRef.current && preTestCompleted) {
      navigate(nextPath);
    }
    wasCompletedRef.current = preTestCompleted;
  }, [nextPath, preTestCompleted]);

  return <LearningAssessmentPage assessmentType="pretest" />;
}
