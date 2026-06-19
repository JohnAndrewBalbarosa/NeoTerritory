export const LEARNER_LANDING_PATH = '/patterns/learn';
export const PRE_TEST_PATH = '/pre-test';
export const INTERN_DASHBOARD_PATH = '/intern-dashboard';

export function isLearnerPath(path: string): boolean {
  return (
    path === LEARNER_LANDING_PATH ||
    path.startsWith(`${LEARNER_LANDING_PATH}/`) ||
    path.startsWith(`${LEARNER_LANDING_PATH}?`) ||
    path.startsWith(`${LEARNER_LANDING_PATH}#`)
  );
}

export function resolveLearnerLanding(_preTestCompleted: boolean): string {
  return _preTestCompleted ? INTERN_DASHBOARD_PATH : PRE_TEST_PATH;
}

export function normalizeLearnerCallbackNext(
  requestedNext: string | null | undefined,
  _preTestCompleted: boolean,
): string {
  const next = requestedNext || resolveLearnerLanding(_preTestCompleted);
  if (next === INTERN_DASHBOARD_PATH || next === PRE_TEST_PATH || isLearnerPath(next)) return next;
  return resolveLearnerLanding(_preTestCompleted);
}

export function preTestPathForNext(next: string): string {
  const safeNext = isLearnerPath(next) ? next : LEARNER_LANDING_PATH;
  return `${PRE_TEST_PATH}?next=${encodeURIComponent(safeNext)}`;
}

export function resolvePreTestNext(requestedNext: string | null | undefined): string {
  return requestedNext && isLearnerPath(requestedNext)
    ? requestedNext
    : INTERN_DASHBOARD_PATH;
}
