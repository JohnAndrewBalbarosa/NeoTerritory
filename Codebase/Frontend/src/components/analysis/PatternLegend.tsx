import { colorFor } from '../../lib/patterns';

interface PatternLegendProps {
  // Canonical pattern names the user has decided on. Sourced from
  // `AnnotatedModel.legendPatterns` — only unambiguous classes plus
  // ambiguous-resolved classes contribute. Ambiguous-pending classes
  // contribute nothing (they have not earned a chip yet) and
  // subclass-dropped tags contribute nothing (their parent picked a
  // non-propagating pattern).
  legendPatterns: string[];
}

export default function PatternLegend({ legendPatterns }: PatternLegendProps) {
  if (!legendPatterns.length) return <div id="pattern-legend" />;
  return (
    <div id="pattern-legend" className="pattern-legend">
      {legendPatterns.map(label => {
        const c = colorFor(label);
        return (
          <span
            key={label}
            className="legend-chip"
            style={{ background: c.bg, borderColor: c.border, color: c.text }}
          >
            <span className="legend-dot" style={{ background: c.border }} />
            {label}
          </span>
        );
      })}
    </div>
  );
}
