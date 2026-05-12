import { MotionConfig, motion, AnimatePresence } from 'motion/react';
import { useEffect } from 'react';
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
import TourPage from './tour/TourPage';
import DocsPage from './docs/DocsPage';

interface MarketingShellProps {
  surface: Exclude<Surface, 'studio'>;
}

export default function MarketingShell({ surface }: MarketingShellProps) {
  useLenis(true);

  // Marketing pages are permanently dark — force the attribute so light-mode
  // CSS variables never bleed through even if the user toggled light in studio.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

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
          {surface === 'tour' && <TourPage />}
          {surface === 'docs' && <DocsPage />}
        </motion.div>
      </AnimatePresence>
      <MarketingFooter />
      </div>
    </MotionConfig>
  );
}
