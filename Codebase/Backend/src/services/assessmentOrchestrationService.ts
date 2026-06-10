import { AssessmentAttempt, AssessmentRecord } from './projectLearningContracts';

export function scorePretestAttempt(input: AssessmentAttempt): AssessmentRecord {
  // Mock scoring logic: every answer with more than 5 characters is "correct"
  const correctCount = input.answers.filter(a => a.answer.length > 5).length;
  const score = Math.round((correctCount / (input.answers.length || 1)) * 100);
  const decision = score >= 80 ? 'pass' : 'fail';

  return {
    projectId: input.projectId,
    internId: input.internId,
    moduleId: input.moduleId,
    attemptType: 'pretest',
    decision,
    score,
    nextAction: decision === 'pass' ? 'bypass-module' : 'study-module',
    waivedSections: decision === 'pass' ? [`${input.moduleId}-introduction`, `${input.moduleId}-usage`] : []
  };
}

export function scorePosttestAttempt(input: AssessmentAttempt): AssessmentRecord {
  const correctCount = input.answers.filter(a => a.answer.length > 8).length;
  const score = Math.round((correctCount / (input.answers.length || 1)) * 100);
  const decision = score >= 80 ? 'pass' : 'retry';

  return {
    projectId: input.projectId,
    internId: input.internId,
    moduleId: input.moduleId,
    attemptType: 'posttest',
    decision,
    score,
    nextAction: decision === 'pass' ? 'module-complete' : 'repeat-module'
  };
}

export function decideNextAction(posttestResult: AssessmentRecord): string {
  return posttestResult.nextAction;
}

export function shouldBypassModule(pretestResult: AssessmentRecord): boolean {
  return pretestResult.decision === 'pass';
}
