import { MotionConfig, motion, AnimatePresence } from 'motion/react';
import { useCallback, useEffect } from 'react';
import { Surface } from '../../logic/router';
import { useLenis } from './effects/useLenis';
import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';
import HeroLanding from './HeroLanding';
import LearningPage from './LearningPage';
import AboutPage from './AboutPage';
import NotFoundPage from './NotFoundPage';
import StudentLearningHub from './StudentLearningHub';
import MechanicsPage from './mechanics/MechanicsPage';
import PatternsPage from './patterns/PatternsPage';
import PatternDetailPage from './patterns/PatternDetailPage';
import TourPage from './tour/TourPage';
import DocsPage from './docs/DocsPage';
import DocsFullPage from './docs/DocsFullPage';
import { TRY_IT_OPEN_EVENT } from './TryItChooser';
import { navigate } from '../../logic/router';

interface MarketingShellProps {
  surface: Exclude<Surface, 'studio'>;
}

export default function MarketingShell({ surface }: MarketingShellProps) {
  useLenis(true);

  // D77: redirect legacy /student-learning to /patterns/learn so old
  // bookmarks keep working. This runs in an effect so the redirect
  // happens after first paint (preventing a blank flash).
  useEffect(() => {
    if (surface === 'studentLearning') {
      navigate('/patterns/learn');
    }
  }, [surface]);

  // Learner-merge: the 4-card chooser is retired. Every "Try it now" CTA
  // (and the legacy /auth/choose, /auth bookmarks) now goes straight to the
  // unified learner sign-in page, which offers Google sign-in plus a
  // "Use guest only" button. Role selection no longer happens up front.
  const goToLearnerSignIn = useCallback(() => {
    navigate('/student-learning/login');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path === '/auth/choose' || path === '/auth') {
      goToLearnerSignIn();
    }
  }, [goToLearnerSignIn]);

  useEffect(() => {
    window.addEventListener(TRY_IT_OPEN_EVENT, goToLearnerSignIn);
    return () => window.removeEventListener(TRY_IT_OPEN_EVENT, goToLearnerSignIn);
  }, [goToLearnerSignIn]);

  useEffect(() => {
    document.body.dataset.surface = surface;
    window.scrollTo({ top: 0, behavior: 'auto' });
    return () => {
      delete document.body.dataset.surface;
    };
  }, [surface]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="nt-marketing-surface" data-marketing-surface>
      <a href="#main" className="nt-skip-link">
        Skip to main content
      </a>
      <MarketingNav current={surface} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={surface}
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
          transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.8 }}
        >
          {surface === 'hero' && <HeroLanding />}
          {surface === 'learn' && <LearningPage />}
          {surface === 'about' && <AboutPage />}
          {surface === 'notFound' && <NotFoundPage />}
          {surface === 'studentLearning' && <StudentLearningHub />}
          {surface === 'mechanics' && <MechanicsPage />}
          {surface === 'patterns' && <PatternsPage />}
          {surface === 'patternDetail' && <PatternDetailPage />}
          {surface === 'tour' && <TourPage />}
          {surface === 'docs' && <DocsPage />}
          {surface === 'docsFull' && <DocsFullPage />}
        </motion.div>
      </AnimatePresence>
      <MarketingFooter />
      </div>
    </MotionConfig>
  );
}
