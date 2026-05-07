import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

const STAGES = [
  {
    id: 'analysis',
    name: 'Read the Code',
    blurb: 'The system receives the submitted C++ source and prepares it for checking.',
    icon: '∑',
  },
  {
    id: 'trees',
    name: 'Organize the Structure',
    blurb: 'It groups tokens, classes, and structural parts so the code can be reviewed by class.',
    icon: '⌥',
  },
  {
    id: 'pattern_dispatch',
    name: 'Check for Patterns',
    blurb: 'It compares class structures with pattern rules from the catalog.',
    icon: '◇',
  },
  {
    id: 'hashing',
    name: 'Link Evidence',
    blurb: 'It connects detected classes, related code parts, and supporting evidence.',
    icon: '#',
  },
  {
    id: 'output',
    name: 'Show the Report',
    blurb: 'It returns annotations, detected patterns, documentation targets, and report artifacts.',
    icon: '→',
  },
];

export default function PipelineAnimation() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % STAGES.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div className="nt-pipeline" role="group" aria-label="Algorithm pipeline">
      <ol className="nt-pipeline__rail">
        {STAGES.map((stage, idx) => {
          const state = reduce ? 'static' : idx === active ? 'active' : idx < active ? 'done' : 'pending';
          return (
            <li
              key={stage.id}
              className="nt-pipeline__node"
              data-state={state}
              aria-current={!reduce && idx === active ? 'step' : undefined}
            >
              <motion.div
                className="nt-pipeline__bubble"
                initial={false}
                animate={{
                  scale: state === 'active' ? 1.08 : 1,
                  boxShadow:
                    state === 'active'
                      ? '0 0 0 6px rgba(120, 219, 255, 0.18)'
                      : '0 0 0 0 rgba(120, 219, 255, 0)',
                }}
                transition={{ type: 'spring', damping: 18, stiffness: 220 }}
              >
                <span className="nt-pipeline__icon" aria-hidden>
                  {stage.icon}
                </span>
                <span className="nt-pipeline__count">{idx + 1}</span>
              </motion.div>
              <div className="nt-pipeline__copy">
                <p className="nt-pipeline__name">{stage.name}</p>
                <p className="nt-pipeline__code">{stage.id}</p>
                <p className="nt-pipeline__blurb">{stage.blurb}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
