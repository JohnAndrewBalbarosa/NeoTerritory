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
  published?: unknown;
  category?: unknown;
  sortOrder?: unknown;
  theoreticalExam?: {
    questions?: Array<{
      type?: string;
      taxonomy?: string;
      question?: string;
      prompt?: string;
      scenario?: string;
      options?: string[];
      code?: string;
      explanation?: string;
    }>;
  };
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

  it('stores a canonical six-question Bloom bank with mixed question shapes', () => {
    const rows = loadSeed();
    const expectedTaxonomies = ['remembering', 'understanding', 'applying', 'analyzing', 'evaluating', 'creating'];
    const allQuestions = rows.flatMap((row) => row.theoreticalExam?.questions ?? []);

    rows.forEach((row) => {
      const questions = row.theoreticalExam?.questions ?? [];
      expect(questions).toHaveLength(6);
      expect(questions.map((q) => q.taxonomy)).toEqual(expectedTaxonomies);
    });
    expect(allQuestions.some((q) => q.type === 'identification')).toBe(true);
    expect(allQuestions.some((q) => q.type === 'studio')).toBe(true);
    expect(allQuestions.every((q) => typeof q.type === 'string')).toBe(true);
  });

  it('publishes the deployed 25-module baseline with 25 questions per Bloom category', () => {
    const rows = loadSeed();
    const published = rows.filter((row) => row.published === true);
    const counts = new Map<string, number>();
    for (const row of published) {
      for (const question of row.theoreticalExam?.questions ?? []) {
        const taxonomy = question.taxonomy ?? 'missing';
        counts.set(taxonomy, (counts.get(taxonomy) ?? 0) + 1);
      }
    }

    expect(published).toHaveLength(25);
    expect(Object.fromEntries(counts)).toEqual({
      remembering: 25,
      understanding: 25,
      applying: 25,
      analyzing: 25,
      evaluating: 25,
      creating: 25,
    });
  });

  it('keeps the supported GoF and Modern C++ pattern bank free of Rust and Java examples', () => {
    const rows = loadSeed();
    const ids = new Set(rows.map((row) => row.moduleId));
    [
      'creational-singleton',
      'creational-factory-method',
      'creational-builder',
      'structural-adapter',
      'structural-composite',
      'behavioural-observer',
      'behavioural-iterator',
    ].forEach((id) => expect(ids.has(id)).toBe(true));

    const questionText = rows
      .flatMap((row) => row.theoreticalExam?.questions ?? [])
      .map((question) => JSON.stringify(question))
      .join('\n')
      .toLowerCase();
    expect(questionText).not.toMatch(/\brust\b/);
    expect(questionText).not.toMatch(/\bjava\b/);
    expect(questionText).toMatch(/c\+\+|std::|unique_ptr|shared_ptr/);
  });
});
