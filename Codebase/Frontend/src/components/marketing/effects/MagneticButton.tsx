import React from 'react';

interface MagneticButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'ghost';
  className?: string;
  ariaLabel?: string;
}

// Per D41 (effects-budget rule): magnetic cursor-tracking is removed from
// public marketing surfaces. The component name and prop surface are preserved
// so existing callsites continue to work, but the underlying element is now a
// plain button/anchor with focus styling carried by `nt-magnetic--<variant>`.
// To re-enable cursor magnetism in the future for a non-marketing surface,
// branch on a dedicated prop (e.g. `magnetic={true}`) — never reintroduce the
// global behaviour without a new D-decision.
export default function MagneticButton({
  children,
  onClick,
  href,
  variant = 'primary',
  className,
  ariaLabel,
}: MagneticButtonProps) {
  const classes = `nt-magnetic nt-magnetic--${variant} ${className ?? ''}`.trim();

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        onClick={(e) => {
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={ariaLabel}
      >
        <span className="nt-magnetic__inner">{children}</span>
      </a>
    );
  }

  return (
    <button type="button" className={classes} onClick={onClick} aria-label={ariaLabel}>
      <span className="nt-magnetic__inner">{children}</span>
    </button>
  );
}
