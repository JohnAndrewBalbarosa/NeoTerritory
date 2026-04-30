import { Annotation } from '../types/api';

export interface PatternColor {
  bg: string;
  border: string;
  text: string;
}

export const PATTERN_COLORS: Record<string, PatternColor> = {
  Singleton:      { bg: 'rgba(59, 130, 246, 0.18)', border: '#3b82f6', text: '#1d4ed8' },
  Factory:        { bg: 'rgba(16, 185, 129, 0.18)', border: '#10b981', text: '#047857' },
  Builder:        { bg: 'rgba(139, 92, 246, 0.18)', border: '#8b5cf6', text: '#6d28d9' },
  MethodChaining: { bg: 'rgba(20, 184, 166, 0.18)', border: '#14b8a6', text: '#0f766e' },
  Adapter:        { bg: 'rgba(249, 115, 22, 0.20)', border: '#f97316', text: '#c2410c' },
  Decorator:      { bg: 'rgba(236, 72, 153, 0.18)', border: '#ec4899', text: '#be185d' },
  Proxy:          { bg: 'rgba(239, 68, 68, 0.18)',  border: '#ef4444', text: '#b91c1c' },
  Review:         { bg: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '#475569' },
  default:        { bg: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '#475569' }
};

export function colorFor(patternKey: string): PatternColor {
  return PATTERN_COLORS[patternKey] || PATTERN_COLORS.default;
}

export function patternFromAnnotation(annotation: Annotation): string {
  const title = annotation.title || '';
  const head = title.split(' :: ')[0] || annotation.stage || 'Review';
  return PATTERN_COLORS[head] ? head : 'default';
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
