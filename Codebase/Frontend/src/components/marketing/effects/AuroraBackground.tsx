import { useReducedMotion } from 'motion/react';
import './auroraBackground.css';

interface AuroraBackgroundProps {
  variant?: 'default' | 'cool' | 'warm';
  className?: string;
}

// Slowly drifting radial-gradient blobs behind content. Blurred + soft so
// it never competes with foreground text. Pure CSS animation; no canvas.
export default function AuroraBackground({
  variant = 'default',
  className = '',
}: AuroraBackgroundProps) {
  const reduce = useReducedMotion();
  return (
    <div
      aria-hidden
      className={`nt-aurora nt-aurora--${variant} ${reduce ? 'is-static' : ''} ${className}`}
    >
      <span className="nt-aurora__blob nt-aurora__blob--a" />
      <span className="nt-aurora__blob nt-aurora__blob--b" />
      <span className="nt-aurora__blob nt-aurora__blob--c" />
      <span className="nt-aurora__grain" />
    </div>
  );
}
