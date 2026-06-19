// Competency registry for authored assessment modules. Each formal/in-module
// question references a competencyId here. (Modules not yet authored simply have
// no entries yet — they are reported as pending, not errors.)

import type { AssessmentCompetency } from './types';

export const ASSESSMENT_COMPETENCIES: ReadonlyArray<AssessmentCompetency> = [
  // --- Foundations ---
  { competencyId: 'pattern-definition', moduleId: 'foundations-what-is-pattern', title: 'Define a design pattern', description: 'State what a design pattern is: a named, reusable solution to a recurring OO design problem.' },
  { competencyId: 'pattern-value', moduleId: 'foundations-what-is-pattern', title: 'Explain a pattern’s value', description: 'Explain why naming a recurring design helps communication and reuse.' },
  { competencyId: 'why-patterns-matter', moduleId: 'foundations-why-matters', title: 'Explain why patterns matter', description: 'Explain how shared pattern vocabulary improves design communication and review.' },
  { competencyId: 'pattern-families', moduleId: 'foundations-categories', title: 'Map the pattern families', description: 'Distinguish Creational, Structural, and Behavioural families by intent.' },
  { competencyId: 'oop-foundations', moduleId: 'foundations-oop', title: 'Relate OOP to patterns', description: 'Connect encapsulation, inheritance, and polymorphism to pattern structure.' },
];

const BY_MODULE = new Map<string, AssessmentCompetency[]>();
for (const c of ASSESSMENT_COMPETENCIES) {
  const list = BY_MODULE.get(c.moduleId) ?? [];
  list.push(c);
  BY_MODULE.set(c.moduleId, list);
}
const BY_ID = new Map(ASSESSMENT_COMPETENCIES.map((c) => [c.competencyId, c]));

export function getCompetenciesForModule(moduleId: string): AssessmentCompetency[] {
  return BY_MODULE.get(moduleId) ?? [];
}
export function competencyExists(competencyId: string): boolean {
  return BY_ID.has(competencyId);
}
