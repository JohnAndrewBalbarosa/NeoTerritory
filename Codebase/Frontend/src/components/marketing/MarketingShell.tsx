import { MotionConfig, motion, AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { Surface } from '../../logic/router';
import { useLenis } from './effects/useLenis';
import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';
import HeroLanding from './HeroLanding';
import LearningPage from './LearningPage';
import AboutPage from './AboutPage';
import EntryChoice from './EntryChoice';
import StudentLearningHub from './StudentLearningHub';
import WhyPage from './why/WhyPage';
import MechanicsPage from './mechanics/MechanicsPage';
import PatternsPage from './patterns/PatternsPage';
import PatternDetailPage from './patterns/PatternDetailPage';
import PatternsLearnPage from './patterns/PatternsLearnPage';
import TourPage from './tour/TourPage';
import DocsPage from './docs/DocsPage';
import TryItChooser, { TRY_IT_OPEN_EVENT } from './TryItChooser';
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

  // Try-it chooser hoisted to the shell so MarketingNav, WhyPage, TourPage,
  // HeroLanding feature tiles, etc. all open the SAME modal instead of each
  // navigating directly to /student-studio (which would land on the tester
  // seat picker and skip the path-choice screen).
  const [chooserOpen, setChooserOpen] = useState<boolean>(false);
  const closeChooser = useCallback(() => setChooserOpen(false), []);

  useEffect(() => {
    function onOpen(): void {
      setChooserOpen(true);
    }
    window.addEventListener(TRY_IT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(TRY_IT_OPEN_EVENT, onOpen);
  }, []);

  // Close the chooser on a real route change so it never lingers across
  // surfaces (e.g., user opens it on /why, hits Back, lands on /).
  useEffect(() => {
    setChooserOpen(false);
  }, [surface]);

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
          {surface === 'choose' && <EntryChoice />}
          {surface === 'studentLearning' && <StudentLearningHub />}
          {surface === 'why' && <WhyPage />}
          {surface === 'mechanics' && <MechanicsPage />}
          {surface === 'patterns' && <PatternsPage />}
          {surface === 'patternDetail' && <PatternDetailPage />}
          {surface === 'patternsLearn' && <PatternsLearnPage />}
          {surface === 'patternsLearnModule' && <PatternsLearnPage />}
          {surface === 'tour' && <TourPage />}
          {surface === 'docs' && <DocsPage />}
        </motion.div>
      </AnimatePresence>
      <MarketingFooter />
      <TryItChooser open={chooserOpen} onClose={closeChooser} />
      </div>
    </MotionConfig>
  );
}
