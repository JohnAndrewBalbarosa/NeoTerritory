import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';
import React, { useCallback, useRef } from 'react';

interface MagneticButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'ghost';
  className?: string;
  ariaLabel?: string;
}

export default function MagneticButton({
  children,
  onClick,
  href,
  variant = 'primary',
  className,
  ariaLabel,
}: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (reduce || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      x.set(dx * 0.25);
      y.set(dy * 0.35);
    },
    [reduce, x, y]
  );

  const handleLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  const classes = `nt-magnetic nt-magnetic--${variant} ${className ?? ''}`.trim();

  if (href) {
    return (
      <motion.a
        ref={(el) => {
          ref.current = el;
        }}
        href={href}
        className={classes}
        style={{ x: sx, y: sy }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onClick={(e) => {
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={ariaLabel}
      >
        <span className="nt-magnetic__inner">{children}</span>
      </motion.a>
    );
  }

  return (
    <motion.button
      ref={(el) => {
        ref.current = el;
      }}
      type="button"
      className={classes}
      style={{ x: sx, y: sy }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className="nt-magnetic__inner">{children}</span>
    </motion.button>
  );
}
