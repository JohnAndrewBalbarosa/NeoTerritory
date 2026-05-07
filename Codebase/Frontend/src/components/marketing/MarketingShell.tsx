import { MotionConfig, motion, AnimatePresence } from 'motion/react';
import { useEffect } from 'react';
import { Surface } from '../../logic/router';
import { useLenis } from './effects/useLenis';
import MarketingNav from './MarketingNav';
import HeroLanding from './HeroLanding';
import LearningPage from './LearningPage';
import AboutPage from './AboutPage';

interface MarketingShellProps {
  surface: Exclude<Surface, 'studio'>;
}

export default function MarketingShell({ surface }: MarketingShellProps) {
  useLenis(true);

  useEffect(() => {
    document.body.dataset.surface = surface;
    window.scrollTo({ top: 0, behavior: 'auto' });
    return () => {
      delete document.body.dataset.surface;
    };
  }, [surface]);

  return (
    <MotionConfig reducedMotion="user">
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
        </motion.div>
      </AnimatePresence>
      <footer className="nt-mkt-footer" role="contentinfo">
        <p>NeoTerritory Studio · C++ pattern analysis & AI documentation pipeline</p>
        <p className="nt-mkt-footer__small">
          Marketing surface · public · the studio at <code>/app</code> still requires a tester
          seat.
        </p>
      </footer>
    </MotionConfig>
  );
}
