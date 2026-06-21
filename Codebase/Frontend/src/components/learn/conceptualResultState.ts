// Per-option result state for objective (MCQ) questions, split so a FAILED
// conceptual-assessment attempt never leaks the answer key.
//
// Two independent signals:
//  - showResult   : grade the learner's OWN selection (their pick may turn
//                   red if wrong, or green if they happened to pick correctly).
//  - revealAnswers: additionally expose the answer key — green the correct
//                   option even when unselected, and show the explanation.
//                   Only true once the attempt PASSES.
//
// On a failed attempt (showResult && !revealAnswers) the correct, unselected
// option stays neutral and no explanation is shown, so the learner must revise
// without being told the answer.

export interface OptionResultState {
  isSelected: boolean;
  isCorrect: boolean; // render green
  isWrong: boolean;   // render red
}

export function mcqOptionState(opts: {
  index: number;
  userAnswer: number | undefined;
  correctIndex: number;
  showResult: boolean;
  revealAnswers: boolean;
}): OptionResultState {
  const { index, userAnswer, correctIndex, showResult, revealAnswers } = opts;
  const isSelected = userAnswer === index;
  if (!showResult) return { isSelected, isCorrect: false, isWrong: false };

  const isWrong = isSelected && index !== correctIndex;
  // Green the correct option only when the learner actually selected it, OR when
  // we are allowed to reveal the key (after passing). Never green an unselected
  // correct option on a failed attempt.
  const isCorrect = index === correctIndex && (revealAnswers || isSelected);
  return { isSelected, isCorrect, isWrong };
}

// The explanation (and any "expected answer" hint) directly reveals the key, so
// it is shown only when answers may be revealed — i.e. after the attempt passes.
export function shouldRevealExplanation(showResult: boolean, revealAnswers: boolean): boolean {
  return showResult && revealAnswers;
}
