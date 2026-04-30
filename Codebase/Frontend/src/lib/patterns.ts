import { Annotation } from '../types/api';

export interface PatternColor {
  bg: string;
  border: string;
  text: string;
}

// Confident pattern -> vivid color. Multi-pattern ambiguity is rendered grey
// elsewhere (see SourceView's AMBIGUOUS_COLOR), so these are reserved for the
// "we know exactly which pattern fired here" case.
export const PATTERN_COLORS: Record<string, PatternColor> = {
  Factory:        { bg: 'rgba(239, 68, 68, 0.20)',  border: '#ef4444', text: '#b91c1c' }, // red
  Singleton:      { bg: 'rgba(59, 130, 246, 0.20)', border: '#3b82f6', text: '#1d4ed8' }, // blue
  Builder:        { bg: 'rgba(139, 92, 246, 0.20)', border: '#8b5cf6', text: '#6d28d9' }, // violet
  MethodChaining: { bg: 'rgba(20, 184, 166, 0.20)', border: '#14b8a6', text: '#0f766e' }, // teal
  Adapter:        { bg: 'rgba(249, 115, 22, 0.22)', border: '#f97316', text: '#c2410c' }, // orange
  Decorator:      { bg: 'rgba(236, 72, 153, 0.20)', border: '#ec4899', text: '#be185d' }, // pink
  Proxy:          { bg: 'rgba(168, 85, 247, 0.20)', border: '#a855f7', text: '#7e22ce' }, // purple
  Strategy:       { bg: 'rgba(34, 197, 94, 0.20)',  border: '#22c55e', text: '#15803d' }, // green
  Observer:       { bg: 'rgba(234, 179, 8, 0.22)',  border: '#eab308', text: '#a16207' }, // amber
  Composite:      { bg: 'rgba(6, 182, 212, 0.20)',  border: '#06b6d4', text: '#0e7490' }, // cyan
  Iterator:       { bg: 'rgba(132, 204, 22, 0.22)', border: '#84cc16', text: '#4d7c0f' }, // lime
  Visitor:        { bg: 'rgba(217, 70, 239, 0.20)', border: '#d946ef', text: '#a21caf' }, // fuchsia
  Command:        { bg: 'rgba(245, 158, 11, 0.20)', border: '#f59e0b', text: '#b45309' }, // amber-orange
  Pimpl:          { bg: 'rgba(202, 138, 4, 0.20)',  border: '#ca8a04', text: '#854d0e' }, // gold
  Review:         { bg: 'rgba(100, 116, 139, 0.18)', border: '#64748b', text: '#475569' }
};

function hueFor(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

function generatedColor(key: string): PatternColor {
  const h = hueFor(key || 'default');
  return {
    bg:     `oklch(72% 0.18 ${h} / 0.10)`,
    border: `oklch(72% 0.18 ${h})`,
    text:   `oklch(85% 0.14 ${h})`
  };
}

export function colorFor(key: string): PatternColor {
  return PATTERN_COLORS[key] ?? generatedColor(key);
}

export function patternFromAnnotation(annotation: Annotation): string {
  // The microservice tags every annotation with the pattern that triggered it;
  // we prefer the explicit patternKey, falling back to parsing the legacy
  // "<PatternName> :: <anchor>" title format. Unknown names still flow through
  // colorFor's hash-based generator so every pattern reads as a distinct color
  // — never grey (grey is reserved for ambiguous lines).
  if (annotation.patternKey) return annotation.patternKey;
  const title = annotation.title || '';
  const head = title.split(' :: ')[0] || annotation.stage || 'Review';
  return head;
}

export const USAGE_KIND_LABEL: Record<string, string> = {
  declaration:    'declared',
  member_call:    '. call',
  arrow_call:     '-> call',
  qualified_call: ':: static',
  make_unique:    'make_unique',
  make_shared:    'make_shared',
  new_ctor:       'new'
};

export function fmtDate(value: string | undefined | null): string {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}
