import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { Surface } from '../../lib/router';
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
      {surface === 'hero' && <HeroLanding />}
      {surface === 'learn' && <LearningPage />}
      {surface === 'about' && <AboutPage />}
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
