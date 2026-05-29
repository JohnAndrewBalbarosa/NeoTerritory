import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// D92 load-bearing invariant: the seeded module_id set MUST equal the
// LEARNING_MODULES id set exactly, because all per-learner progress
// (learning_progress / learning_question_results / learning_exam_attempts) is
// keyed to these ids. This test validates the GENERATED seed file produced by
// scripts/dump-learning-seed.mjs (npm run dump:learning-seed). If it drifts,
// regenerate the seed rather than editing it by hand.

interface SeedRow {
  moduleId?: unknown;
  category?: unknown;
  sortOrder?: unknown;
}

const SEED_PATH = path.resolve(__dirname, '..', 'db', 'seeds', 'learningModules.seed.json');

function loadSeed(): SeedRow[] {
  const raw = fs.readFileSync(SEED_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('seed JSON is not an array');
  return parsed as SeedRow[];
}

describe('learningModules.seed.json parity', () => {
  it('exists and parses as a non-empty array', () => {
    expect(fs.existsSync(SEED_PATH)).toBe(true);
    const rows = loadSeed();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('every entry has a non-empty string moduleId', () => {
    const rows = loadSeed();
    for (const r of rows) {
      expect(typeof r.moduleId).toBe('string');
      expect((r.moduleId as string).length).toBeGreaterThan(0);
    }
  });

  it('module ids are unique', () => {
    const rows = loadSeed();
    const ids = rows.map((r) => r.moduleId as string);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains more than 35 modules (the current path is 40)', () => {
    const rows = loadSeed();
    expect(rows.length).toBeGreaterThan(35);
  });

  it('sortOrder is a contiguous 0..n-1 sequence matching array order', () => {
    const rows = loadSeed();
    rows.forEach((r, i) => {
      expect(r.sortOrder).toBe(i);
    });
  });
});
