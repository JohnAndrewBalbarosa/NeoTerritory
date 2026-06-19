// Authoritative authored in-module conceptual bank, keyed by moduleId. Merged
// from per-category files and consumed by attachExams() in learningModules.ts
// (preferred over the legacy FOUNDATIONS_THEORY/PATTERN_THEORY maps). Modules
// absent here fall back to the legacy maps, so this can be filled incrementally.

import type { ExamQuestion } from '../../learningModules';
import { IN_MODULE_FOUNDATIONS } from './foundations';
import { IN_MODULE_CREATIONAL } from './creational';
import { IN_MODULE_STRUCTURAL } from './structural';
import { IN_MODULE_BEHAVIOURAL } from './behavioural';
import { IN_MODULE_IDIOMS } from './idioms';

export const IN_MODULE_THEORY: Record<string, ReadonlyArray<ExamQuestion>> = {
  ...IN_MODULE_FOUNDATIONS,
  ...IN_MODULE_CREATIONAL,
  ...IN_MODULE_STRUCTURAL,
  ...IN_MODULE_BEHAVIOURAL,
  ...IN_MODULE_IDIOMS,
};
