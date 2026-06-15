export const LEARNER_LANDING_PATH = '/patterns/learn';
export const PRE_TEST_PATH = '/pre-test';

export function isLearnerPath(path: string): boolean {
  return (
    path === LEARNER_LANDING_PATH ||
    path.startsWith(`${LEARNER_LANDING_PATH}/`) ||
    path.startsWith(`${LEARNER_LANDING_PATH}?`) ||
    path.startsWith(`${LEARNER_LANDING_PATH}#`)
  );
}

export function resolveLearnerLanding(_preTestCompleted: boolean): string {
  return LEARNER_LANDING_PATH;
}

export function normalizeLearnerCallbackNext(
  requestedNext: string | null | undefined,
  _preTestCompleted: boolean,
): string {
  const next = requestedNext || LEARNER_LANDING_PATH;
  return isLearnerPath(next) ? next : LEARNER_LANDING_PATH;
}

export function preTestPathForNext(next: string): string {
  const safeNext = isLearnerPath(next) ? next : LEARNER_LANDING_PATH;
  return `${PRE_TEST_PATH}?next=${encodeURIComponent(safeNext)}`;
}

export function resolvePreTestNext(requestedNext: string | null | undefined): string {
  return requestedNext && isLearnerPath(requestedNext)
    ? requestedNext
    : LEARNER_LANDING_PATH;
}
