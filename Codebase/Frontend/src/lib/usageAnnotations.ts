import { Annotation, ClassUsageBinding, DetectedPatternFull } from '../types/api';

const KIND_HUMAN: Record<string, string> = {
  declaration:    'declaration',
  member_call:    'member call',
  arrow_call:     'arrow call',
  qualified_call: 'qualified call',
  make_unique:    'make_unique',
  make_shared:    'make_shared',
  new_ctor:       'new'
};

export function synthesizeUsageAnnotations(
  bindings: Record<string, ClassUsageBinding[]>,
  detectedPatterns: DetectedPatternFull[]
): Annotation[] {
  const classToPatternName = new Map<string, string>();
  detectedPatterns.forEach(p => {
    if (p.className && p.patternName) classToPatternName.set(p.className, p.patternName);
  });
  const out: Annotation[] = [];
  let id = 1;
  Object.entries(bindings).forEach(([cls, rows]) => {
    const patternName = classToPatternName.get(cls) || 'Review';
    (rows || []).forEach(u => {
      const target = u.varName
        ? `${u.varName}${u.methodName ? '.' + u.methodName : ''}`
        : (u.methodName ? `${cls}::${u.methodName}` : cls);
      out.push({
        id:       `usage-${id++}`,
        order:    1000 + id,
        stage:    patternName,
        severity: 'low',
        line:     u.line,
        lineEnd:  u.line,
        title:    `${patternName} :: ${KIND_HUMAN[u.kind] || u.kind}`,
        comment:  `${target} — bound to ${cls}` + (u.evidence ? ` (${u.evidence})` : ''),
        excerpt:  u.snippet || '',
        kind:     'tagged_usage'
      });
    });
  });
  return out;
}
