import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

interface SampleWalkthroughProps {
  family: string;
  patternId: string;
  filename: string;
  source: string;
  highlights: Array<{ stage: string; lines: [number, number]; note: string }>;
}

export default function SampleWalkthrough({
  family,
  patternId,
  filename,
  source,
  highlights,
}: SampleWalkthroughProps) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setStep((i) => (i + 1) % highlights.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [reduce, highlights.length]);

  const lines = source.split('\n');
  const active = highlights[step];

  return (
    <div className="nt-sample" data-family={family.toLowerCase()}>
      <div className="nt-sample__head">
        <p className="nt-sample__family">{family}</p>
        <p className="nt-sample__pattern">{patternId}</p>
        <p className="nt-sample__file">{filename}</p>
      </div>
      <div className="nt-sample__body">
        <pre className="nt-sample__code" aria-label={`${filename} source`}>
          {lines.map((line, idx) => {
            const lineNo = idx + 1;
            const inRange = lineNo >= active.lines[0] && lineNo <= active.lines[1];
            return (
              <motion.span
                key={idx}
                className="nt-sample__line"
                data-active={inRange ? 'true' : undefined}
                initial={false}
                animate={{
                  backgroundColor: inRange
                    ? 'rgba(120, 219, 255, 0.15)'
                    : 'rgba(120, 219, 255, 0)',
                }}
                transition={{ duration: 0.4 }}
              >
                <span className="nt-sample__lineno">{lineNo.toString().padStart(2, ' ')}</span>
                <span className="nt-sample__linetext">{line || ' '}</span>
              </motion.span>
            );
          })}
        </pre>
        <ol className="nt-sample__steps" aria-label="Pipeline narration">
          {highlights.map((h, idx) => (
            <li
              key={h.stage}
              className="nt-sample__step"
              data-active={!reduce && idx === step ? 'true' : undefined}
            >
              <button
                type="button"
                onClick={() => setStep(idx)}
                aria-current={!reduce && idx === step ? 'step' : undefined}
              >
                <span className="nt-sample__stepnum">{idx + 1}</span>
                <span className="nt-sample__stepname">{h.stage}</span>
                <span className="nt-sample__stepnote">{h.note}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
