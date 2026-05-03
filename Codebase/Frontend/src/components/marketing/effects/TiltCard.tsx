import { useRef, ReactNode, MouseEvent } from 'react';
import { useReducedMotion } from 'motion/react';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;     // degrees
  scale?: number;       // 1.0 = no scale, 1.04 = subtle pop
  glare?: boolean;      // moving highlight
}

// Lightweight 3D tilt wrapper. Tracks pointer position and rotates the
// card on X/Y. Pure rAF + transform — no library, no re-renders.
export default function TiltCard({
  children,
  className = '',
  maxTilt = 8,
  scale = 1.02,
  glare = true,
}: TiltCardProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number>(0);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (reduce) return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * (maxTilt * 2);
    const ry = (px - 0.5) * (maxTilt * 2);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      node.style.transform =
        `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale})`;
      if (glare && glareRef.current) {
        // Glare colour comes from a CSS var so light/dark themes can
        // each pick a tint that reads against their surface (white sheen
        // on dark cards, soft purple wash on light cards).
        glareRef.current.style.background =
          `radial-gradient(circle at ${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%, var(--nt-tilt-glare, rgba(255,255,255,0.18)), transparent 55%)`;
      }
    });
  }

  function onLeave() {
    const node = ref.current;
    if (!node) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    node.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)';
    if (glareRef.current) glareRef.current.style.background = 'transparent';
  }

  return (
    <div
      ref={ref}
      className={`nt-tilt ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        transition: reduce ? undefined : 'transform 240ms cubic-bezier(0.16,1,0.3,1)',
        willChange: 'transform',
        transformStyle: 'preserve-3d',
        position: 'relative',
      }}
    >
      {children}
      {glare && !reduce && (
        <span
          ref={glareRef}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: 'inherit',
            transition: 'background 200ms ease-out',
          }}
        />
      )}
    </div>
  );
}
