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
  // Review is the "we don't know" bucket. Brighter mid-greys (slate-400/300)
  // so the badge remains visible on both dark and light surfaces. The dark
  // text variant is only swapped to a lighter slate at runtime when light
  // mode is active (see colorFor() / AMBIGUOUS_COLOR theming).
  Review:         { bg: 'rgba(148, 163, 184, 0.18)', border: '#94a3b8', text: '#cbd5e1' }
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

const PATTERN_COLORS_CI: Record<string, PatternColor> = Object.fromEntries(
  Object.entries(PATTERN_COLORS).map(([k, v]) => [k.toLowerCase(), v])
);

export function colorFor(key: string): PatternColor {
  if (PATTERN_COLORS[key]) return PATTERN_COLORS[key];
  const lower = (key || '').toLowerCase();
  // Try exact lowercase match first, then strip non-alphanumerics so microservice
  // ids like "factory_method" or "strategy (policy)" still resolve to "Factory"
  // / "Strategy" palette entries via their leading token.
  if (PATTERN_COLORS_CI[lower]) return PATTERN_COLORS_CI[lower];
  const head = lower.split(/[^a-z0-9]+/).filter(Boolean)[0] || lower;
  if (PATTERN_COLORS_CI[head]) return PATTERN_COLORS_CI[head];
  return generatedColor(key);
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

// Neutral grey used when a class scope has tied or no dominant pattern.
// Two variants so the grey stays readable on both backgrounds: dark mode
// gets a lighter slate that pops on the dark surface, light mode keeps the
// classic darker slate. AMBIGUOUS_COLOR is a getter so it reflects the
// current `<html data-theme>` at every call.
const AMBIGUOUS_DARK: PatternColor = {
  bg:     'rgba(148, 163, 184, 0.18)',
  border: 'rgba(203, 213, 225, 1)',
  text:   'rgba(226, 232, 240, 1)',
};
const AMBIGUOUS_LIGHT: PatternColor = {
  bg:     'rgba(100, 116, 139, 0.12)',
  border: 'rgba(100, 116, 139, 1)',
  text:   'rgba(71, 85, 105, 1)',
};
function isLightMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'light';
}
export function getAmbiguousColor(): PatternColor {
  return isLightMode() ? AMBIGUOUS_LIGHT : AMBIGUOUS_DARK;
}
// Backwards-compatible export. Acts as a live proxy: every property read
// resolves to the current theme's variant. Existing imports keep working
// without code changes.
export const AMBIGUOUS_COLOR: PatternColor = new Proxy({} as PatternColor, {
  get(_target, prop: keyof PatternColor) {
    return getAmbiguousColor()[prop];
  }
}) as PatternColor;

function parseRgba(s: string): [number, number, number, number] {
  const m = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s\/]+([\d.]+))?\s*\)/);
  if (!m) return [100, 116, 139, 0.15];
  return [+m[1], +m[2], +m[3], m[4] != null ? +m[4] : 1];
}

function blendRgbaStr(a: string, b: string, t: number): string {
  const [r1, g1, b1, a1] = parseRgba(a);
  const [r2, g2, b2, a2] = parseRgba(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  const alpha = +(a1 + (a2 - a1) * t).toFixed(3);
  return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}

// Linearly interpolate between two PatternColors.
// t=0 → color a, t=1 → color b (AMBIGUOUS_COLOR in practice).
export function blendColor(a: PatternColor, b: PatternColor, t: number): PatternColor {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    bg:     blendRgbaStr(a.bg, b.bg, t),
    border: blendRgbaStr(a.border, b.border, t),
    text:   blendRgbaStr(a.text, b.text, t),
  };
}

export function fmtDate(value: string | undefined | null): string {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}
