import { useReducedMotion } from 'motion/react';
import './shinyText.css';

interface ShinyTextProps {
  text: string;
  speed?: number;        // seconds per sweep
  intensity?: number;    // 0..1 alpha of sheen
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}

// Moving gradient sheen across text. Pure CSS animation; respects
// prefers-reduced-motion.
export default function ShinyText({
  text,
  speed = 4.5,
  intensity = 0.85,
  as: Tag = 'span',
  className = '',
}: ShinyTextProps) {
  const reduce = useReducedMotion();
  // Accept the JSX runtime polymorphism with an explicit cast.
  const Element = Tag as 'span';
  const style = reduce
    ? undefined
    : ({
        ['--shiny-duration' as string]: `${speed}s`,
        ['--shiny-alpha' as string]: String(intensity),
      } as React.CSSProperties);
  return (
    <Element className={`nt-shiny ${reduce ? 'is-static' : ''} ${className}`} style={style}>
      {text}
    </Element>
  );
}
