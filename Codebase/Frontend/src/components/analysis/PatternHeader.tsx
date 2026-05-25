import { useState } from 'react';
import { PatternHeaderData } from '../../logic/documentedModel';
import { colorFor, ensureReadableContrast } from '../../logic/patterns';

interface PatternHeaderProps {
  data: PatternHeaderData;
  onLineFlash?: (line: number) => void;
}

// Collapsible per-class header. Default collapsed: badge + class + one-liner +
// AI/Static pill. Expanded body carries the full pattern teaching. Print CSS
// (`@media print`) forces the body open so exports are complete.
export default function PatternHeader({ data, onLineFlash }: PatternHeaderProps) {
  const [open, setOpen] = useState(false);
  const base = colorFor(data.patternName);
  const text = ensureReadableContrast(base.text, 4.5);

  return (
    <div className={`pattern-header ${open ? 'pattern-header--open' : ''}`} data-pattern={data.patternName}>
      <button
        type="button"
        className="pattern-header__toggle no-print"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="pattern-header__chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span
          className="pattern-header__badge"
          style={{ borderColor: base.border, background: base.bg, color: text }}
        >
          {data.patternName}
        </span>
        <code className="pattern-header__class">{data.className}</code>
        <span className="pattern-header__oneliner">{data.oneLiner}</span>
        <span className={`pattern-header__pill pattern-header__pill--${data.source}`}>
          {data.source === 'ai' ? 'AI explanation' : 'Built-in guide'}
        </span>
      </button>

      <div className="pattern-header__body">
        <p><span className="pattern-header__label">What is it?</span> {data.oneLiner}</p>
        {data.whyThisFired && (
          <p><span className="pattern-header__label">Why it fired:</span> {data.whyThisFired}</p>
        )}
        {data.whenToUse && (
          <p><span className="pattern-header__label">When to use:</span> {data.whenToUse}</p>
        )}
        {data.realWorldAnalogy && (
          <p><span className="pattern-header__label">Analogy:</span> {data.realWorldAnalogy}</p>
        )}
        {data.watchOuts && (
          <p className="pattern-header__watchout"><span className="pattern-header__label">Watch out:</span> {data.watchOuts}</p>
        )}
        {data.methodsToTest.length > 0 && (
          <div className="pattern-header__methods">
            <span className="pattern-header__label">Methods to test:</span>
            <ul className="pattern-header__method-list">
              {data.methodsToTest.map((m) => (
                <li key={`${m.name}-${m.line}`}>
                  <button type="button" className="pattern-header__method no-print" onClick={() => onLineFlash?.(m.line)}>
                    <code>{m.name}</code>
                    <span className="pattern-header__method-kind">{m.branchKind}</span>
                    <span className="pattern-header__method-line">L{m.line}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
