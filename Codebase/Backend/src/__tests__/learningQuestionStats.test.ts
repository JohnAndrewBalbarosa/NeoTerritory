import { describe, it, expect } from 'vitest';
import { sanitizeAnswers, aggregateQuestionResults } from '../services/learningQuestionStats';

describe('sanitizeAnswers', () => {
  it('keeps valid rows and coerces correctness to 0/1', () => {
    const out = sanitizeAnswers([
      { questionIndex: 0, selectedIndex: 2, isCorrect: true },
      { questionIndex: 1, selectedIndex: 0, isCorrect: false },
    ]);
    expect(out).toEqual([
      { questionIndex: 0, selectedIndex: 2, isCorrect: 1 },
      { questionIndex: 1, selectedIndex: 0, isCorrect: 0 },
    ]);
  });

  it('drops non-objects, negatives, and over-cap entries', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ questionIndex: i, selectedIndex: 0, isCorrect: true }));
    const out = sanitizeAnswers([{ questionIndex: -1, selectedIndex: 0, isCorrect: true }, 'x' as unknown, ...many]);
    expect(out.length).toBe(50); // MAX_ANSWERS cap, negative + junk dropped
    expect(out.every((a) => a.questionIndex >= 0)).toBe(true);
  });

  it('returns [] for non-array input', () => {
    expect(sanitizeAnswers(undefined)).toEqual([]);
    expect(sanitizeAnswers({} as unknown)).toEqual([]);
  });

  it('dedupes by questionIndex keeping the last answer, in first-seen order', () => {
    const out = sanitizeAnswers([
      { questionIndex: 0, selectedIndex: 1, isCorrect: false },
      { questionIndex: 1, selectedIndex: 3, isCorrect: true },
      { questionIndex: 0, selectedIndex: 2, isCorrect: true }, // overrides q0
    ]);
    expect(out).toEqual([
      { questionIndex: 0, selectedIndex: 2, isCorrect: 1 },
      { questionIndex: 1, selectedIndex: 3, isCorrect: 1 },
    ]);
  });
});

describe('aggregateQuestionResults', () => {
  it('rolls raw rows into per-question first-try pass rate + option distribution', () => {
    const rows = [
      { module_id: 'foundations-what-is-pattern', question_index: 0, selected_index: 1, first_attempt_correct: 1 },
      { module_id: 'foundations-what-is-pattern', question_index: 0, selected_index: 0, first_attempt_correct: 0 },
      { module_id: 'foundations-what-is-pattern', question_index: 1, selected_index: 2, first_attempt_correct: 1 },
    ];
    const out = aggregateQuestionResults(rows);
    const q0 = out.find((r) => r.moduleId === 'foundations-what-is-pattern' && r.questionIndex === 0)!;
    expect(q0.seen).toBe(2);
    expect(q0.firstTryCorrect).toBe(1);
    expect(q0.passRate).toBeCloseTo(0.5);
    expect(q0.optionDistribution[0]).toBe(1);
    expect(q0.optionDistribution[1]).toBe(1);
    expect(q0.family).toBe('foundations');
  });

  it('derives family from the module-id prefix', () => {
    const out = aggregateQuestionResults([
      { module_id: 'creational-singleton', question_index: 0, selected_index: 0, first_attempt_correct: 1 },
    ]);
    expect(out[0].family).toBe('creational');
  });
});
