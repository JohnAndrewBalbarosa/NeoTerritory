/*
 * Class Usage Binder (D24) — INTERIM heuristic.
 * Replaces nothing in microservice; fills the gap until the C++ Binding phase
 * (D7/D8/D18) is implemented and starts emitting `class_usages` natively.
 *
 * Given source text + a set of known class names from microservice detection,
 * find variable→class bindings and emit per-class usage rows for the frontend.
 */

interface MatchEntry {
  index: number;
  captures: string[];
  full: string;
}

interface Usage {
  line: number;
  kind: string;
  sub_kind?: string;
  varName?: string;
  methodName?: string;
  boundClass: string;
  snippet: string;
  evidence?: string;
}

interface DetectedPatternLike {
  className?: string;
}

function escapeRe(value: unknown): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lineOf(text: string, index: number): number {
  if (index < 0) return 0;
  let line = 1;
  const cap = Math.min(index, text.length);
  for (let i = 0; i < cap; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function findAllMatches(re: RegExp, text: string): MatchEntry[] {
  const out: MatchEntry[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    out.push({ index: m.index, captures: m.slice(1) as string[], full: m[0] });
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
}

function snippetAt(text: string, index: number, len = 60): string {
  return text.slice(index, Math.min(text.length, index + len)).replace(/\s+/g, ' ').trim();
}

export function bindUsages(sourceText: string, className: string): Usage[] {
  const usages: Usage[] = [];
  const cls = escapeRe(className);

  // 1) Variable declarations of various shapes.
  const declPatterns = [
    { kind: 'value_decl', captureIndex: 0, re: new RegExp(`\\b${cls}\\b\\s+([a-zA-Z_]\\w*)\\s*[;={(,]`, 'g') },
    { kind: 'ref_decl',   captureIndex: 0, re: new RegExp(`\\b${cls}\\s*&\\s*([a-zA-Z_]\\w*)\\b`, 'g') },
    { kind: 'ptr_decl',   captureIndex: 0, re: new RegExp(`\\b${cls}\\s*\\*\\s*([a-zA-Z_]\\w*)\\b`, 'g') },
    { kind: 'smart_decl', captureIndex: 1, re: new RegExp(`\\b(unique_ptr|shared_ptr)\\s*<\\s*${cls}\\s*>\\s+([a-zA-Z_]\\w*)\\b`, 'g') }
  ];

  const decls: Array<{ varName: string; declLine: number; kind: string }> = [];
  for (const p of declPatterns) {
    for (const m of findAllMatches(p.re, sourceText)) {
      const varName = m.captures[p.captureIndex];
      if (!varName) continue;
      const declLine = lineOf(sourceText, m.index);
      decls.push({ varName, declLine, kind: p.kind });
      usages.push({
        line:       declLine,
        kind:       'declaration',
        sub_kind:   p.kind,
        varName,
        boundClass: className,
        snippet:    snippetAt(sourceText, m.index)
      });
    }
  }

  // 2) Member access on each declared variable.
  const seenCalls = new Set<string>();
  for (const d of decls) {
    const v = escapeRe(d.varName);
    const dotRe   = new RegExp(`\\b${v}\\s*\\.\\s*(\\w+)\\s*\\(`, 'g');
    const arrowRe = new RegExp(`\\b${v}\\s*->\\s*(\\w+)\\s*\\(`, 'g');

    for (const m of findAllMatches(dotRe, sourceText)) {
      const callLine = lineOf(sourceText, m.index);
      if (callLine === d.declLine) continue;
      const methodName = m.captures[0] ?? '';
      const key = `member_call:${callLine}:${d.varName}:${methodName}`;
      if (seenCalls.has(key)) continue;
      seenCalls.add(key);
      usages.push({
        line:       callLine,
        kind:       'member_call',
        varName:    d.varName,
        methodName,
        boundClass: className,
        snippet:    snippetAt(sourceText, m.index),
        evidence:   `decl@line ${d.declLine}`
      });
    }

    for (const m of findAllMatches(arrowRe, sourceText)) {
      const callLine = lineOf(sourceText, m.index);
      if (callLine === d.declLine) continue;
      const methodName = m.captures[0] ?? '';
      const key = `arrow_call:${callLine}:${d.varName}:${methodName}`;
      if (seenCalls.has(key)) continue;
      seenCalls.add(key);
      usages.push({
        line:       callLine,
        kind:       'arrow_call',
        varName:    d.varName,
        methodName,
        boundClass: className,
        snippet:    snippetAt(sourceText, m.index),
        evidence:   `decl@line ${d.declLine}`
      });
    }
  }

  // 3) Qualified static calls: `Class::method(`
  const staticRe = new RegExp(`\\b${cls}\\s*::\\s*(\\w+)\\s*\\(`, 'g');
  for (const m of findAllMatches(staticRe, sourceText)) {
    usages.push({
      line:       lineOf(sourceText, m.index),
      kind:       'qualified_call',
      methodName: m.captures[0] ?? '',
      boundClass: className,
      snippet:    snippetAt(sourceText, m.index)
    });
  }

  // 4) Constructor calls.
  const ctorPatterns = [
    { kind: 'make_unique', re: new RegExp(`\\bmake_unique\\s*<\\s*${cls}\\s*>\\s*\\(`, 'g') },
    { kind: 'make_shared', re: new RegExp(`\\bmake_shared\\s*<\\s*${cls}\\s*>\\s*\\(`, 'g') },
    { kind: 'new_ctor',    re: new RegExp(`\\bnew\\s+${cls}\\s*\\(`,                  'g') }
  ];
  for (const p of ctorPatterns) {
    for (const m of findAllMatches(p.re, sourceText)) {
      usages.push({
        line:       lineOf(sourceText, m.index),
        kind:       p.kind,
        boundClass: className,
        snippet:    snippetAt(sourceText, m.index)
      });
    }
  }

  // Stable sort: by line, then by kind so same-line rows group sensibly.
  usages.sort((a, b) => (a.line - b.line) || a.kind.localeCompare(b.kind));
  return usages;
}

export function extractClassNames(sourceText: string): string[] {
  const re = /\b(?:class|struct)\s+([A-Za-z_]\w*)\b(?!\s*::)/g;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(sourceText)) !== null) {
    if (m[1]) names.add(m[1]);
  }
  return [...names];
}

export function bindAll(sourceText: string, detectedPatterns: DetectedPatternLike[] | undefined): Record<string, Usage[]> {
  const result: Record<string, Usage[]> = {};
  const seen = new Set<string>();
  (detectedPatterns || []).forEach((p) => {
    const name = p && p.className;
    if (name) seen.add(name);
  });
  extractClassNames(sourceText).forEach((n) => seen.add(n));
  for (const name of seen) {
    const bound = bindUsages(sourceText, name);
    if (bound.length > 0) result[name] = bound;
  }
  return result;
}
