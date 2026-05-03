import { motion, useReducedMotion } from 'motion/react';
import React from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}

export default function ScrollReveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = 'div',
}: ScrollRevealProps) {
  const reduce = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </Tag>
  );
}
