
import { DetectedPatternFull } from '../../types/api';
import { colorFor } from '../../lib/patterns';

interface PatternLegendProps {
  detectedPatterns: DetectedPatternFull[];
}

/**
 * Renders pattern chips immediately from detected patterns.
 * P0 fix: does NOT wait for AI annotations — renders as soon as
 * pattern data arrives.
 */
export default function PatternLegend({ detectedPatterns }: PatternLegendProps) {
  if (!detectedPatterns.length) return <div id="pattern-legend" />;
  const seen = new Set<string>();
  const chips: Array<{ key: string; label: string }> = [];
  detectedPatterns.forEach(p => {
    const key = p.patternName || 'Review';
    if (seen.has(key)) return;
    seen.add(key);
    chips.push({ key, label: key });
  });
  return (
    <div id="pattern-legend" className="pattern-legend">
      {chips.map(({ key, label }) => {
        const c = colorFor(key);
        return (
          <span
            key={key}
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
