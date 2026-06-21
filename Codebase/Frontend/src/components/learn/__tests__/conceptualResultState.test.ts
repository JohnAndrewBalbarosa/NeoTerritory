import { describe, it, expect } from 'vitest';
import { mcqOptionState, shouldRevealExplanation } from '../conceptualResultState';

// Acceptance scenario: Q1 options ["Easy, moderate, hard", "Creational, Structural,
// Behavioural"], correct = index 1, learner selected index 0 (wrong).
const Q1 = { correctIndex: 1, userAnswer: 0 };

describe('mcqOptionState — failed attempt must not leak the answer key', () => {
  it('before submission everything is neutral', () => {
    for (const index of [0, 1]) {
      expect(mcqOptionState({ index, userAnswer: 0, correctIndex: 1, showResult: false, revealAnswers: false }))
        .toEqual({ isSelected: index === 0, isCorrect: false, isWrong: false });
    }
  });

  it('failed attempt: the selected wrong option is red', () => {
    const s = mcqOptionState({ index: 0, ...Q1, showResult: true, revealAnswers: false });
    expect(s).toMatchObject({ isSelected: true, isWrong: true, isCorrect: false });
  });

  it('failed attempt: the correct (unselected) option stays NEUTRAL — not green', () => {
    const s = mcqOptionState({ index: 1, ...Q1, showResult: true, revealAnswers: false });
    expect(s.isCorrect).toBe(false); // the leak the bug had — now closed
    expect(s.isWrong).toBe(false);
    expect(s.isSelected).toBe(false);
  });

  it('failed attempt: a correctly-answered question still shows the learner’s pick green', () => {
    // Q2: learner selected the correct option (index 2).
    const s = mcqOptionState({ index: 2, userAnswer: 2, correctIndex: 2, showResult: true, revealAnswers: false });
    expect(s).toMatchObject({ isSelected: true, isCorrect: true, isWrong: false });
  });

  it('passing reveals the correct option green even when it was not selected', () => {
    const s = mcqOptionState({ index: 1, ...Q1, showResult: true, revealAnswers: true });
    expect(s.isCorrect).toBe(true);
  });
});

describe('shouldRevealExplanation', () => {
  it('hides the explanation on a failed attempt', () => {
    expect(shouldRevealExplanation(true, false)).toBe(false);
  });
  it('hides the explanation before submission', () => {
    expect(shouldRevealExplanation(false, false)).toBe(false);
  });
  it('shows the explanation only after passing', () => {
    expect(shouldRevealExplanation(true, true)).toBe(true);
  });
});
