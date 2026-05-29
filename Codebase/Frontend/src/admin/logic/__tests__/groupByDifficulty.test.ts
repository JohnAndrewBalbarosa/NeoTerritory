import { describe, it, expect } from 'vitest';
import { groupByDifficulty } from '../groupByDifficulty';
import type { ModuleDifficulty } from '../learningAggregate';

// Build a minimal ModuleDifficulty fixture; only `difficulty` drives grouping.
function mod(moduleId: string, title: string, difficulty: number): ModuleDifficulty {
  return {
    moduleId,
    title,
    category: 'foundations',
    seen: 10,
    firstTryCorrect: Math.round((1 - difficulty) * 10),
    firstTryPassRate: 1 - difficulty,
    difficulty,
  };
}

describe('groupByDifficulty', () => {
  it('assigns distinct, dense ranks to clearly different difficulties (hardest first)', () => {
    // Arrange — three well-separated buckets, already hardest-first.
    const input = [
      mod('m1', 'Module 1', 0.80),
      mod('m2', 'Module 2', 0.50),
      mod('m3', 'Module 3', 0.20),
    ];

    // Act
    const groups = groupByDifficulty(input);

    // Assert — one module per rank, ranks 1..3 in order.
    expect(groups.map((g) => g.rank)).toEqual([1, 2, 3]);
    expect(groups.every((g) => g.modules.length === 1)).toBe(true);
    expect(groups[0].modules[0].moduleId).toBe('m1');
  });

  it('groups two modules whose D rounds to the same 0.05 bucket into one shared rank', () => {
    // Arrange — 0.80 and 0.78 both round to the 0.80 bucket; 0.50 is its own.
    const input = [
      mod('m4', 'Module 4', 0.80),
      mod('m19', 'Module 19', 0.78),
      mod('m7', 'Module 7', 0.50),
    ];

    // Act
    const groups = groupByDifficulty(input);

    // Assert — rank 1 holds BOTH near-equal modules; rank 2 is the easier one.
    expect(groups).toHaveLength(2);
    expect(groups[0].rank).toBe(1);
    expect(groups[0].modules.map((m) => m.moduleId)).toEqual(['m4', 'm19']);
    expect(groups[1].rank).toBe(2);
    expect(groups[1].modules.map((m) => m.moduleId)).toEqual(['m7']);
  });

  it('returns an empty list for no modules', () => {
    expect(groupByDifficulty([])).toEqual([]);
  });

  it('does not group equal-bucket modules that are not adjacent in the sorted list', () => {
    // Arrange — a hardest-first list where an equal bucket reappears later is a
    // contradiction of the sort contract, but the grouping must stay dense and
    // never retroactively merge a non-adjacent module.
    const input = [
      mod('a', 'A', 0.90),
      mod('b', 'B', 0.50),
      mod('c', 'C', 0.50),
    ];

    // Act
    const groups = groupByDifficulty(input);

    // Assert — B and C are adjacent and share rank 2; A is rank 1.
    expect(groups).toHaveLength(2);
    expect(groups[1].modules.map((m) => m.moduleId)).toEqual(['b', 'c']);
  });
});
