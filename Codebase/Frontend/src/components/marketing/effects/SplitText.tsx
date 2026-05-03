import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

interface SplitTextProps {
  text: string;
  delay?: number;
  stagger?: number;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

export default function SplitText({
  text,
  delay = 0,
  stagger = 0.04,
  className,
  as = 'span',
}: SplitTextProps) {
  const reduce = useReducedMotion();
  const words = useMemo(() => text.split(' '), [text]);
  const Tag = motion[as];

  if (reduce) {
    const StaticTag = as as keyof JSX.IntrinsicElements;
    return <StaticTag className={className}>{text}</StaticTag>;
  }

  return (
    <Tag
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      aria-label={text}
    >
      {words.map((word, wi) => (
        <span
          key={wi}
          aria-hidden
          style={{ display: 'inline-block', whiteSpace: 'nowrap', marginRight: '0.25em' }}
        >
          {word.split('').map((ch, ci) => (
            <motion.span
              key={ci}
              style={{ display: 'inline-block' }}
              variants={{
                hidden: { y: '110%', opacity: 0 },
                visible: {
                  y: 0,
                  opacity: 1,
                  transition: { type: 'spring', damping: 18, stiffness: 220 },
                },
              }}
            >
              {ch}
            </motion.span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
