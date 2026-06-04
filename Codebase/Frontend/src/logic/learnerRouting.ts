export const LEARNER_LANDING_PATH = '/patterns/learn';
export const PRE_TEST_PATH = '/pre-test';

export function resolveLearnerLanding(preTestCompleted: boolean): string {
  return preTestCompleted ? LEARNER_LANDING_PATH : PRE_TEST_PATH;
}

export function normalizeLearnerCallbackNext(
  requestedNext: string | null | undefined,
  preTestCompleted: boolean,
): string {
  const next = requestedNext || LEARNER_LANDING_PATH;
  if (next === LEARNER_LANDING_PATH && !preTestCompleted) return PRE_TEST_PATH;
  return next;
}
