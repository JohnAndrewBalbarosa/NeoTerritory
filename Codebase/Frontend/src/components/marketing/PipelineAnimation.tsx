import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

const STAGES = [
  {
    id: 'analysis',
    name: 'Analysis',
    blurb: 'Reads submitted C++ source files and loads the pattern catalog.',
    icon: '∑',
  },
  {
    id: 'trees',
    name: 'Trees',
    blurb: 'Tokenizes source and builds parse-tree, class-token, and symbol structures.',
    icon: '⌥',
  },
  {
    id: 'pattern_dispatch',
    name: 'Pattern dispatch',
    blurb: 'Matches catalog-defined pattern steps against detected class structures.',
    icon: '◇',
  },
  {
    id: 'hashing',
    name: 'Hashing',
    blurb: 'Builds links between declarations, usage nodes, and structural references.',
    icon: '#',
  },
  {
    id: 'output',
    name: 'Output',
    blurb: 'Writes report.json, evidence files, parse-tree HTML, and analysis artifacts.',
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
