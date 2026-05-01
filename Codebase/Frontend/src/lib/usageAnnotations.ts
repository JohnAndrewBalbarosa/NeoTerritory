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

// Whitelist of binding kinds the heuristic binder shares with the
// authoritative microservice output. When the run's binding source is
// 'heuristic', we accept only these kinds so the heuristic can't paint
// lines the microservice would never have flagged. The microservice path
// passes through unchanged because it's already authoritative.
const HEURISTIC_KIND_WHITELIST: ReadonlySet<string> = new Set([
  'declaration',
  'member_call',
  'arrow_call',
  'qualified_call',
  'make_unique',
  'make_shared',
  'new_ctor'
]);

export function synthesizeUsageAnnotations(
  bindings: Record<string, ClassUsageBinding[]>,
  detectedPatterns: DetectedPatternFull[],
  classResolvedPatterns?: Record<string, string>,
  bindingSource: 'heuristic' | 'microservice' = 'heuristic'
): Annotation[] {
  const classToPatternName = new Map<string, string>();
  detectedPatterns.forEach(p => {
    if (p.className && p.patternName) classToPatternName.set(p.className, p.patternName);
  });
  // classResolvedPatterns intentionally NOT consulted here. The resolved
  // pattern repaints the class's own declaration via SourceView's scope
  // dominance short-circuit; it must NOT cascade onto usage lines in global
  // functions (e.g. lines inside int main that reference QueryBuilder). Those
  // standalone usage lines stay tagged with the structural-matcher verdict
  // so the user's tag is confined to the class declaration scope only.
  void classResolvedPatterns;  // kept on the signature for API stability
  const out: Annotation[] = [];
  let id = 1;
  Object.entries(bindings).forEach(([cls, rows]) => {
    // Only emit usage annotations for classes the matcher actually tagged.
    // Without this guard, declarations of an untagged class would scatter
    // "Review" badges across global functions whose picker options are empty.
    const patternName = classToPatternName.get(cls);
    if (!patternName) return;
    (rows || []).forEach(u => {
      // Trim heuristic emissions to kinds the microservice would also tag.
      // Microservice-source bindings are authoritative and pass through.
      if (bindingSource === 'heuristic' && !HEURISTIC_KIND_WHITELIST.has(u.kind)) return;
      const target = u.varName
        ? `${u.varName}${u.methodName ? '.' + u.methodName : ''}`
        : (u.methodName ? `${cls}::${u.methodName}` : cls);
      out.push({
        id:         `usage-${id++}`,
        order:      1000 + id,
        stage:      patternName,
        severity:   'low',
        line:       u.line,
        lineEnd:    u.line,
        title:      `${patternName} :: ${KIND_HUMAN[u.kind] || u.kind}`,
        comment:    `${target} — bound to ${cls}` + (u.evidence ? ` (${u.evidence})` : ''),
        excerpt:    u.snippet || '',
        kind:       'tagged_usage',
        className:  cls,
        patternKey: patternName
      });
    });
  });
  return out;
}
