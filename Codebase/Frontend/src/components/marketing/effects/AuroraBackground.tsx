import './auroraBackground.css';

interface AuroraBackgroundProps {
  variant?: 'default' | 'cool' | 'warm';
  className?: string;
}

// Per D41 (effects-budget rule): the previous three drifting blobs created
// distracting container movement and competed with foreground text. The
// component now renders a single static gradient panel — same visual identity
// role, no motion. The `is-static` class is kept so existing CSS selectors
// continue to apply, and the `useReducedMotion` hook is no longer needed
// because there is nothing to disable.
export default function AuroraBackground({
  variant = 'default',
  className = '',
}: AuroraBackgroundProps) {
  return (
    <div
      aria-hidden
      className={`nt-aurora nt-aurora--${variant} is-static nt-aurora--single ${className}`}
    >
      <span className="nt-aurora__blob nt-aurora__blob--single" />
    </div>
  );
}
