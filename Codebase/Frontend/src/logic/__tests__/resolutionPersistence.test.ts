import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { AnalysisRun } from '../../types/api';
import { sourceKeyOf, loadResolutions, saveResolutions } from '../resolutionPersistence';
import { useAppStore } from '../../store/appState';

// In-memory Storage so the suite runs under vitest's default node env (no DOM,
// no jsdom dependency). The persistence module reads `window.localStorage`
// lazily, so injecting this per-test is enough.
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  };
}

function makeRun(over: Partial<AnalysisRun> = {}): AnalysisRun {
  return {
    runId: null,
    sourceName: 'computer_builder.cpp',
    sourceText: 'class ComputerBuilder { ComputerBuilder& setCpu(); };\n',
    detectedPatterns: [],
    annotations: [],
    ranking: null,
    classUsageBindings: {},
    classUsageBindingSource: 'heuristic',
    summary: '',
    ...over,
  };
}

const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
const realWindow = (globalThis as unknown as { window?: unknown }).window;

beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = { localStorage: makeStorage() };
  // The store is a singleton; reset run state between tests.
  useAppStore.getState().setCurrentRun(null);
});

afterEach(() => {
  if (hadWindow) (globalThis as unknown as { window: unknown }).window = realWindow;
  else delete (globalThis as unknown as { window?: unknown }).window;
});

describe('sourceKeyOf', () => {
  test('is deterministic for identical source', () => {
    expect(sourceKeyOf(makeRun())).toBe(sourceKeyOf(makeRun()));
  });

  test('differs when the source text changes', () => {
    expect(sourceKeyOf(makeRun({ sourceText: 'class A {};' })))
      .not.toBe(sourceKeyOf(makeRun({ sourceText: 'class B {};' })));
  });

  test('keys multi-file runs off files[] contents', () => {
    const a = sourceKeyOf(makeRun({ files: [{ name: 'a.cpp', sourceText: 'class A{};' }] }));
    const b = sourceKeyOf(makeRun({ files: [{ name: 'a.cpp', sourceText: 'class B{};' }] }));
    expect(a).not.toBe(b);
  });
});

describe('save / load resolutions', () => {
  test('round-trips a resolution map', () => {
    saveResolutions('k1', { ComputerBuilder: 'Builder' });
    expect(loadResolutions('k1')).toEqual({ ComputerBuilder: 'Builder' });
  });

  test('returns {} for an unknown key', () => {
    expect(loadResolutions('missing')).toEqual({});
  });

  test('an empty map clears a prior entry', () => {
    saveResolutions('k', { X: 'Strategy' });
    saveResolutions('k', {});
    expect(loadResolutions('k')).toEqual({});
  });

  test('LRU-caps stored sources at 50 (cap enforced, newest retained)', () => {
    for (let i = 0; i < 55; i++) saveResolutions('k' + i, { C: 'P' + i });
    let retained = 0;
    for (let i = 0; i < 55; i++) {
      if (Object.keys(loadResolutions('k' + i)).length > 0) retained++;
    }
    expect(retained).toBe(50);
    expect(loadResolutions('k54')).toEqual({ C: 'P54' });
  });

  test('is a no-op without a DOM (SSR / non-browser)', () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    expect(() => saveResolutions('k', { A: 'B' })).not.toThrow();
    expect(loadResolutions('k')).toEqual({});
  });
});

describe('appState hooks — persist + restore classResolvedPatterns', () => {
  test('patchCurrentRun persists the resolution map keyed by source', () => {
    const run = makeRun({ pendingId: 'pen_x' });
    useAppStore.getState().setCurrentRun(run);
    useAppStore.getState().patchCurrentRun({ classResolvedPatterns: { ComputerBuilder: 'Builder' } });
    expect(loadResolutions(sourceKeyOf(run))).toEqual({ ComputerBuilder: 'Builder' });
  });

  test('setCurrentRun restores a saved resolution for the same source (the reload case)', () => {
    const run = makeRun({ pendingId: 'pen_x' });
    useAppStore.getState().setCurrentRun(run);
    useAppStore.getState().patchCurrentRun({ classResolvedPatterns: { ComputerBuilder: 'Builder' } });
    // Simulate a reload + re-analyse of the SAME code: brand-new run, empty map.
    useAppStore.getState().setCurrentRun(makeRun({ pendingId: 'pen_y' }));
    expect(useAppStore.getState().currentRun?.classResolvedPatterns).toEqual({ ComputerBuilder: 'Builder' });
  });

  test("the run's own resolution wins over the persisted one", () => {
    const run = makeRun();
    useAppStore.getState().setCurrentRun(run);
    useAppStore.getState().patchCurrentRun({ classResolvedPatterns: { C: 'Builder' } });
    useAppStore.getState().setCurrentRun(makeRun({ classResolvedPatterns: { C: 'Prototype' } }));
    expect(useAppStore.getState().currentRun?.classResolvedPatterns?.C).toBe('Prototype');
  });

  test('does not restore when the source differs', () => {
    const run = makeRun({ sourceText: 'class A{};' });
    useAppStore.getState().setCurrentRun(run);
    useAppStore.getState().patchCurrentRun({ classResolvedPatterns: { A: 'Builder' } });
    useAppStore.getState().setCurrentRun(makeRun({ sourceText: 'class Z{};' }));
    expect(useAppStore.getState().currentRun?.classResolvedPatterns || {}).toEqual({});
  });
});
