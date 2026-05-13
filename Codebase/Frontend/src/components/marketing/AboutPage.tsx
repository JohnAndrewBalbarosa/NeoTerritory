import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';

// Slim /about. Project intro only — no author / adviser / panel bios.

export default function AboutPage() {
  return (
    <main className="nt-about" id="main">
      <header className="nt-about__head">
        <p className="nt-section-eyebrow">About</p>
        <h1 className="nt-about__title">About NeoTerritory</h1>
        <p className="nt-about__subtitle">
          NeoTerritory is a C++ design-pattern learning tool. It detects Creational,
          Structural, and Behavioral patterns in your source, explains why each was
          flagged, and walks you through a guided self-check.
        </p>
      </header>

      <section className="nt-about__cta-band">
        <MagneticButton variant="primary" onClick={() => navigate('/student-studio')}>
          Try it now
        </MagneticButton>
      </section>
    </main>
  );
}
