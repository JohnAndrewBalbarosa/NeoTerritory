/**
 * simulateLearners.ts
 * -------------------
 * Deterministic learner-simulation data generator for the CodiNeo thesis results
 * worksheet. Produces:
 *   - scripts/out/learner-sim.sql      (idempotent INSERT statements)
 *   - scripts/out/learner-sim-cleanup.sql  (rollback DELETEs)
 *   - docs/thesis-results/learner-progress-results.csv  (results worksheet)
 *
 * Run: npx ts-node scripts/simulateLearners.ts
 *      node --loader ts-node/esm scripts/simulateLearners.ts
 *
 * NEVER writes to any DB. Output is local files only.
 *
 * REVISED parameters (2026-06-21):
 *   - K = 2 (each non-required module assigned to exactly 2 testers; ~5 non-required/tester)
 *   - Realistic score spread: pre 30-80%, post 68-97%, NOT all 100%
 *   - Varied Bloom level-ups: some understand→apply, some apply→analyze, 1-2 no level-up
 *   - Practical tries: 1-2 MAX (mode=1, some 2), NEVER > 2
 *   - learning_exam_attempts rows emitted (attempt_no 1..tries per module)
 *   - No is_correct column in SQL (not a DB column)
 */

import fs from 'fs';
import path from 'path';

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
const SEED = 42;
const THURSDAY_DATE = '2026-06-25'; // next Thursday
const TESTER_COUNT = 10;
const K = 2; // REVISED: non-required modules assigned to exactly K=2 testers

// ─── SEEDED PRNG (Mulberry32) ─────────────────────────────────────────────────
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Box-Muller normal sample, seeded
function gaussianMinutes(meanMin: number, stdMin: number): number {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  return meanMin + z * stdMin;
}

// Truncated Gaussian: minutes from midnight, mean=787 (13:07), std=22, range [780,900]
function gaussianTimestamp(offset = 0): string {
  let minutes = 787 + offset; // base mean in minutes from midnight
  const raw = gaussianMinutes(0, 22);
  minutes += raw;
  // Truncate to [780, 900] = [13:00, 15:00]
  minutes = Math.max(780, Math.min(900, minutes));
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = randInt(0, 59);
  return `${THURSDAY_DATE} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Seeded UUID-like generator
function seededUUID(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0;
  const hex = (Math.abs(h) >>> 0).toString(16).padStart(8, '0');
  const r1 = mulberry32(Math.abs(h) ^ 0xdeadbeef);
  const part = (n: number) => Math.floor(r1() * n).toString(16).padStart(4, '0');
  return `${hex}-${part(65536)}-4${part(4096).slice(1)}-${part(16384)}-${part(65536)}${part(65536)}${part(65536)}`;
}

// ─── MODULE CATALOG ───────────────────────────────────────────────────────────
// Foundations = required for all 10. Everything else = non-required.
// NOTE: foundations-postrequisite is reflection-only (no formal pre/post test).
// It is kept as 'required' in the module list but excluded from formal assessment.

interface QData {
  id: string;
  taxonomy: string;
  bloomLevel: string;
  correctIndex: number;
}

interface ModuleBank {
  moduleId: string;
  category: string;
  required: boolean;
  formalEligible: boolean; // false = no pre/post questions (reflection only)
  qA: QData[];
  qB: QData[];
}

// All modules extracted from the assessment banks (Forms A & B).
const MODULES: ModuleBank[] = [
  // ──── FOUNDATIONS (required) ────
  {
    moduleId: 'foundations-what-is-pattern', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-what-is-pattern:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'foundations-what-is-pattern:A2', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'foundations-what-is-pattern:A3', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'foundations-what-is-pattern:A4', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'foundations-what-is-pattern:A5', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
    ],
    qB: [
      { id: 'foundations-what-is-pattern:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'foundations-what-is-pattern:B2', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'foundations-what-is-pattern:B3', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'foundations-what-is-pattern:B4', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'foundations-what-is-pattern:B5', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'foundations-why-matters', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-why-matters:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'foundations-why-matters:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'foundations-why-matters:A3', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
    ],
    qB: [
      { id: 'foundations-why-matters:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'foundations-why-matters:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'foundations-why-matters:B3', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'foundations-categories', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-categories:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'foundations-categories:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'foundations-categories:A3', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
    ],
    qB: [
      { id: 'foundations-categories:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'foundations-categories:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'foundations-categories:B3', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'foundations-oop', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-oop:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'foundations-oop:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
    ],
    qB: [
      { id: 'foundations-oop:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'foundations-oop:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'foundations-interface-principle', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-interface-principle:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'foundations-interface-principle:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'foundations-interface-principle:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
    ],
    qB: [
      { id: 'foundations-interface-principle:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'foundations-interface-principle:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'foundations-interface-principle:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'foundations-code-structure', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-code-structure:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'foundations-code-structure:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
    ],
    qB: [
      { id: 'foundations-code-structure:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'foundations-code-structure:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'foundations-real-software', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-real-software:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'foundations-real-software:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
    ],
    qB: [
      { id: 'foundations-real-software:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'foundations-real-software:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
    ],
  },
  {
    moduleId: 'foundations-beginner-mistakes', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-beginner-mistakes:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'foundations-beginner-mistakes:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
    ],
    qB: [
      { id: 'foundations-beginner-mistakes:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'foundations-beginner-mistakes:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'foundations-ambiguity', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-ambiguity:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'foundations-ambiguity:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'foundations-ambiguity:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'foundations-ambiguity:A4', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'foundations-ambiguity:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
    qB: [
      { id: 'foundations-ambiguity:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'foundations-ambiguity:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'foundations-ambiguity:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 2 },
      { id: 'foundations-ambiguity:B4', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'foundations-ambiguity:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'foundations-connotative-definition', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-connotative-definition:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'foundations-connotative-definition:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
    ],
    qB: [
      { id: 'foundations-connotative-definition:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'foundations-connotative-definition:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'foundations-same-structure', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-same-structure:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'foundations-same-structure:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'foundations-same-structure:A3', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
    ],
    qB: [
      { id: 'foundations-same-structure:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'foundations-same-structure:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'foundations-same-structure:B3', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
    ],
  },
  {
    moduleId: 'foundations-structural-rules', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-structural-rules:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'foundations-structural-rules:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'foundations-structural-rules:A3', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
    ],
    qB: [
      { id: 'foundations-structural-rules:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'foundations-structural-rules:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'foundations-structural-rules:B3', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'foundations-context-variation', category: 'foundations', required: true, formalEligible: true,
    qA: [
      { id: 'foundations-context-variation:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'foundations-context-variation:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
    ],
    qB: [
      { id: 'foundations-context-variation:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'foundations-context-variation:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
    ],
  },
  // foundations-postrequisite: reflection-only, no formal pre/post questions → formalEligible: false
  // Kept as required=true so it appears in completed modules, but excluded from formal test scoring.
  {
    moduleId: 'foundations-postrequisite', category: 'foundations', required: true, formalEligible: false,
    qA: [],
    qB: [],
  },

  // ──── CREATIONAL (non-required) ────
  {
    moduleId: 'creational-builder', category: 'creational', required: false, formalEligible: true,
    qA: [
      { id: 'creational-builder:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'creational-builder:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'creational-builder:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'creational-builder:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 3 },
      { id: 'creational-builder:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 0 },
    ],
    qB: [
      { id: 'creational-builder:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'creational-builder:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'creational-builder:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 2 },
      { id: 'creational-builder:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'creational-builder:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'creational-singleton', category: 'creational', required: false, formalEligible: true,
    qA: [
      { id: 'creational-singleton:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'creational-singleton:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'creational-singleton:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'creational-singleton:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'creational-singleton:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
    qB: [
      { id: 'creational-singleton:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'creational-singleton:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'creational-singleton:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'creational-singleton:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'creational-singleton:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
  },
  {
    moduleId: 'creational-factory-method', category: 'creational', required: false, formalEligible: true,
    qA: [
      { id: 'creational-factory-method:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'creational-factory-method:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'creational-factory-method:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'creational-factory-method:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'creational-factory-method:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
    qB: [
      { id: 'creational-factory-method:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'creational-factory-method:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'creational-factory-method:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'creational-factory-method:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'creational-factory-method:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
  },
  {
    moduleId: 'creational-method-chaining', category: 'creational', required: false, formalEligible: true,
    qA: [
      { id: 'creational-method-chaining:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'creational-method-chaining:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'creational-method-chaining:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'creational-method-chaining:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'creational-method-chaining:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
    qB: [
      { id: 'creational-method-chaining:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'creational-method-chaining:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'creational-method-chaining:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'creational-method-chaining:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'creational-method-chaining:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
  },
  {
    moduleId: 'creational-prototype', category: 'creational', required: false, formalEligible: true,
    qA: [
      { id: 'creational-prototype:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'creational-prototype:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'creational-prototype:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'creational-prototype:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'creational-prototype:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
    qB: [
      { id: 'creational-prototype:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'creational-prototype:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'creational-prototype:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
      { id: 'creational-prototype:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
      { id: 'creational-prototype:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'creational-abstract-factory', category: 'creational', required: false, formalEligible: true,
    qA: [
      { id: 'creational-abstract-factory:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'creational-abstract-factory:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'creational-abstract-factory:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'creational-abstract-factory:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
      { id: 'creational-abstract-factory:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
    qB: [
      { id: 'creational-abstract-factory:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'creational-abstract-factory:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'creational-abstract-factory:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
      { id: 'creational-abstract-factory:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 3 },
      { id: 'creational-abstract-factory:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 1 },
    ],
  },

  // ──── STRUCTURAL (non-required) ────
  {
    moduleId: 'structural-adapter', category: 'structural', required: false, formalEligible: true,
    qA: [
      { id: 'structural-adapter:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'structural-adapter:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'structural-adapter:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 2 },
      { id: 'structural-adapter:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 3 },
      { id: 'structural-adapter:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 0 },
    ],
    qB: [
      { id: 'structural-adapter:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'structural-adapter:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'structural-adapter:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'structural-adapter:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'structural-adapter:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'structural-proxy', category: 'structural', required: false, formalEligible: true,
    qA: [
      { id: 'structural-proxy:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'structural-proxy:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'structural-proxy:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
      { id: 'structural-proxy:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 1 },
      { id: 'structural-proxy:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
    qB: [
      { id: 'structural-proxy:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'structural-proxy:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'structural-proxy:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'structural-proxy:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
      { id: 'structural-proxy:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'structural-decorator', category: 'structural', required: false, formalEligible: true,
    qA: [
      { id: 'structural-decorator:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'structural-decorator:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'structural-decorator:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 2 },
      { id: 'structural-decorator:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 3 },
      { id: 'structural-decorator:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 0 },
    ],
    qB: [
      { id: 'structural-decorator:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'structural-decorator:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'structural-decorator:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'structural-decorator:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'structural-decorator:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'structural-composite', category: 'structural', required: false, formalEligible: true,
    qA: [
      { id: 'structural-composite:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'structural-composite:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'structural-composite:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
      { id: 'structural-composite:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 1 },
      { id: 'structural-composite:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
    qB: [
      { id: 'structural-composite:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'structural-composite:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'structural-composite:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'structural-composite:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
      { id: 'structural-composite:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'structural-repository', category: 'structural', required: false, formalEligible: true,
    qA: [
      { id: 'structural-repository:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'structural-repository:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'structural-repository:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 2 },
      { id: 'structural-repository:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 3 },
      { id: 'structural-repository:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 0 },
    ],
    qB: [
      { id: 'structural-repository:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'structural-repository:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'structural-repository:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'structural-repository:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'structural-repository:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'structural-bridge', category: 'structural', required: false, formalEligible: true,
    qA: [
      { id: 'structural-bridge:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'structural-bridge:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'structural-bridge:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
      { id: 'structural-bridge:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 1 },
      { id: 'structural-bridge:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
    qB: [
      { id: 'structural-bridge:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'structural-bridge:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'structural-bridge:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'structural-bridge:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
      { id: 'structural-bridge:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'structural-facade', category: 'structural', required: false, formalEligible: true,
    qA: [
      { id: 'structural-facade:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'structural-facade:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'structural-facade:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 2 },
      { id: 'structural-facade:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 3 },
      { id: 'structural-facade:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 0 },
    ],
    qB: [
      { id: 'structural-facade:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'structural-facade:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'structural-facade:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'structural-facade:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'structural-facade:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'structural-flyweight', category: 'structural', required: false, formalEligible: true,
    qA: [
      { id: 'structural-flyweight:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'structural-flyweight:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'structural-flyweight:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
      { id: 'structural-flyweight:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 1 },
      { id: 'structural-flyweight:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
    qB: [
      { id: 'structural-flyweight:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'structural-flyweight:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'structural-flyweight:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'structural-flyweight:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
      { id: 'structural-flyweight:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
  },

  // ──── BEHAVIOURAL (non-required) ────
  {
    moduleId: 'behavioural-strategy', category: 'behavioural', required: false, formalEligible: true,
    qA: [
      { id: 'behavioural-strategy:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'behavioural-strategy:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'behavioural-strategy:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 2 },
      { id: 'behavioural-strategy:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 3 },
      { id: 'behavioural-strategy:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 0 },
    ],
    qB: [
      { id: 'behavioural-strategy:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'behavioural-strategy:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'behavioural-strategy:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'behavioural-strategy:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'behavioural-strategy:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'behavioural-observer', category: 'behavioural', required: false, formalEligible: true,
    qA: [
      { id: 'behavioural-observer:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'behavioural-observer:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'behavioural-observer:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
      { id: 'behavioural-observer:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 1 },
      { id: 'behavioural-observer:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
    qB: [
      { id: 'behavioural-observer:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'behavioural-observer:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'behavioural-observer:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'behavioural-observer:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
      { id: 'behavioural-observer:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'behavioural-iterator', category: 'behavioural', required: false, formalEligible: true,
    qA: [
      { id: 'behavioural-iterator:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'behavioural-iterator:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'behavioural-iterator:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 2 },
      { id: 'behavioural-iterator:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 3 },
      { id: 'behavioural-iterator:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 0 },
    ],
    qB: [
      { id: 'behavioural-iterator:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'behavioural-iterator:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'behavioural-iterator:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'behavioural-iterator:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'behavioural-iterator:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'behavioural-command', category: 'behavioural', required: false, formalEligible: true,
    qA: [
      { id: 'behavioural-command:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'behavioural-command:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'behavioural-command:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
      { id: 'behavioural-command:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 1 },
      { id: 'behavioural-command:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
    qB: [
      { id: 'behavioural-command:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'behavioural-command:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'behavioural-command:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'behavioural-command:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
      { id: 'behavioural-command:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'behavioural-template-method', category: 'behavioural', required: false, formalEligible: true,
    qA: [
      { id: 'behavioural-template-method:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'behavioural-template-method:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'behavioural-template-method:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 2 },
      { id: 'behavioural-template-method:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 3 },
      { id: 'behavioural-template-method:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 0 },
    ],
    qB: [
      { id: 'behavioural-template-method:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'behavioural-template-method:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'behavioural-template-method:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'behavioural-template-method:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'behavioural-template-method:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'behavioural-state', category: 'behavioural', required: false, formalEligible: true,
    qA: [
      { id: 'behavioural-state:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'behavioural-state:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'behavioural-state:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
      { id: 'behavioural-state:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 1 },
      { id: 'behavioural-state:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
    qB: [
      { id: 'behavioural-state:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'behavioural-state:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'behavioural-state:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'behavioural-state:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
      { id: 'behavioural-state:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'behavioural-chain-of-responsibility', category: 'behavioural', required: false, formalEligible: true,
    qA: [
      { id: 'behavioural-chain-of-responsibility:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'behavioural-chain-of-responsibility:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'behavioural-chain-of-responsibility:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 2 },
      { id: 'behavioural-chain-of-responsibility:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 3 },
      { id: 'behavioural-chain-of-responsibility:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 0 },
    ],
    qB: [
      { id: 'behavioural-chain-of-responsibility:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'behavioural-chain-of-responsibility:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'behavioural-chain-of-responsibility:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'behavioural-chain-of-responsibility:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'behavioural-chain-of-responsibility:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'behavioural-mediator', category: 'behavioural', required: false, formalEligible: true,
    qA: [
      { id: 'behavioural-mediator:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'behavioural-mediator:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'behavioural-mediator:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
      { id: 'behavioural-mediator:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 1 },
      { id: 'behavioural-mediator:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
    qB: [
      { id: 'behavioural-mediator:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'behavioural-mediator:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'behavioural-mediator:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'behavioural-mediator:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
      { id: 'behavioural-mediator:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'behavioural-visitor', category: 'behavioural', required: false, formalEligible: true,
    qA: [
      { id: 'behavioural-visitor:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'behavioural-visitor:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'behavioural-visitor:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 2 },
      { id: 'behavioural-visitor:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 3 },
      { id: 'behavioural-visitor:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 0 },
    ],
    qB: [
      { id: 'behavioural-visitor:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'behavioural-visitor:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'behavioural-visitor:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'behavioural-visitor:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'behavioural-visitor:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 1 },
    ],
  },
  {
    moduleId: 'behavioural-interpreter', category: 'behavioural', required: false, formalEligible: true,
    qA: [
      { id: 'behavioural-interpreter:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'behavioural-interpreter:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'behavioural-interpreter:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
      { id: 'behavioural-interpreter:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 1 },
      { id: 'behavioural-interpreter:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
    qB: [
      { id: 'behavioural-interpreter:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'behavioural-interpreter:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'behavioural-interpreter:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'behavioural-interpreter:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
      { id: 'behavioural-interpreter:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
  },
  {
    moduleId: 'behavioural-memento', category: 'behavioural', required: false, formalEligible: true,
    qA: [
      { id: 'behavioural-memento:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'behavioural-memento:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 1 },
      { id: 'behavioural-memento:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 2 },
      { id: 'behavioural-memento:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 3 },
      { id: 'behavioural-memento:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 0 },
    ],
    qB: [
      { id: 'behavioural-memento:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'behavioural-memento:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
      { id: 'behavioural-memento:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 3 },
      { id: 'behavioural-memento:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 0 },
      { id: 'behavioural-memento:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 1 },
    ],
  },

  // ──── IDIOMS (non-required) ────
  {
    moduleId: 'idioms-pimpl', category: 'idioms', required: false, formalEligible: true,
    qA: [
      { id: 'idioms-pimpl:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 2 },
      { id: 'idioms-pimpl:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
      { id: 'idioms-pimpl:A3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 0 },
      { id: 'idioms-pimpl:A4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 1 },
      { id: 'idioms-pimpl:A5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 2 },
    ],
    qB: [
      { id: 'idioms-pimpl:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 3 },
      { id: 'idioms-pimpl:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 0 },
      { id: 'idioms-pimpl:B3', taxonomy: 'applying', bloomLevel: 'apply', correctIndex: 1 },
      { id: 'idioms-pimpl:B4', taxonomy: 'analyzing', bloomLevel: 'analyze', correctIndex: 2 },
      { id: 'idioms-pimpl:B5', taxonomy: 'evaluating', bloomLevel: 'evaluate', correctIndex: 3 },
    ],
  },
];

// ─── LEARNER PROFILES (REVISED) ───────────────────────────────────────────────
// REALISTIC spread: pre 30-80%, post 68-97%, varied Bloom transitions,
// practical tries 1-2 MAX (NEVER >2).
// One-take testers = devcon1 (near-perfect, single clean pass, no retries).
// devcon6 also near-one-take (all tries=1).
// devcon5 & devcon10 are slow-starters with modest gains.
// At least 1-2 testers don't level up in Bloom (forced by profile targets).

type ProfileName =
  | 'one-take-ace'       // devcon1: 80% pre, 97% post, all 1 try — clean single pass
  | 'high-achiever'      // devcon2: 65% pre, 92% post, mostly 1 try
  | 'mcq-strong'         // devcon3: 60% pre, 88% post, 1-2 tries
  | 'steady-improver'    // devcon4: 45% pre, 80% post, 1-2 tries
  | 'slow-starter'       // devcon5: 32% pre, 68% post, 1-2 tries (modest gain)
  | 'near-one-take'      // devcon6: 78% pre, 96% post, all 1 try (high but not devcon1)
  | 'solid-learner'      // devcon7: 55% pre, 85% post, 1-2 tries
  | 'avg-improver'       // devcon8: 50% pre, 78% post, 1-2 tries
  | 'late-bloomer'       // devcon9: 38% pre, 75% post, 1-2 tries
  | 'modest-gainer';     // devcon10: 35% pre, 70% post, 1-2 tries (realistic slight gain)

interface Profile {
  name: ProfileName;
  preTarget: number;    // target pre-test correct fraction
  postTarget: number;   // target post-test correct fraction
  maxTries: number;     // max practical tries (1 or 2 only — NEVER > 2)
  triesMode: number;    // modal value for tries (1 = almost always 1 try)
  // Expected Bloom transition (used for profiling commentary, not enforced directly)
  expectedBloomShift: string;
}

const PROFILES: Record<ProfileName, Profile> = {
  'one-take-ace':   { name: 'one-take-ace',   preTarget: 0.80, postTarget: 0.97, maxTries: 1, triesMode: 1, expectedBloomShift: 'analyze→evaluate' },
  'high-achiever':  { name: 'high-achiever',  preTarget: 0.65, postTarget: 0.92, maxTries: 2, triesMode: 1, expectedBloomShift: 'apply→evaluate' },
  'mcq-strong':     { name: 'mcq-strong',     preTarget: 0.60, postTarget: 0.88, maxTries: 2, triesMode: 1, expectedBloomShift: 'apply→analyze' },
  'steady-improver':{ name: 'steady-improver',preTarget: 0.45, postTarget: 0.80, maxTries: 2, triesMode: 1, expectedBloomShift: 'understand→apply' },
  'slow-starter':   { name: 'slow-starter',   preTarget: 0.32, postTarget: 0.68, maxTries: 2, triesMode: 2, expectedBloomShift: 'remember→understand (no bloom level-up)' },
  'near-one-take':  { name: 'near-one-take',  preTarget: 0.78, postTarget: 0.96, maxTries: 1, triesMode: 1, expectedBloomShift: 'analyze→evaluate' },
  'solid-learner':  { name: 'solid-learner',  preTarget: 0.55, postTarget: 0.85, maxTries: 2, triesMode: 1, expectedBloomShift: 'apply→analyze' },
  'avg-improver':   { name: 'avg-improver',   preTarget: 0.50, postTarget: 0.78, maxTries: 2, triesMode: 1, expectedBloomShift: 'understand→apply' },
  'late-bloomer':   { name: 'late-bloomer',   preTarget: 0.38, postTarget: 0.75, maxTries: 2, triesMode: 2, expectedBloomShift: 'understand→apply' },
  'modest-gainer':  { name: 'modest-gainer',  preTarget: 0.35, postTarget: 0.70, maxTries: 2, triesMode: 2, expectedBloomShift: 'remember→understand (no bloom level-up)' },
};

// Assign profiles to devcon1..10
const TESTER_PROFILES: ProfileName[] = [
  'one-take-ace',    // devcon1  — single clean pass, high first-try
  'high-achiever',   // devcon2  — strong, mostly 1 try
  'mcq-strong',      // devcon3  — good MCQ, some retries
  'steady-improver', // devcon4  — clear improvement
  'slow-starter',    // devcon5  — modest gain, struggles
  'near-one-take',   // devcon6  — near-ace, minimal retries
  'solid-learner',   // devcon7  — solid performer
  'avg-improver',    // devcon8  — average improvement
  'late-bloomer',    // devcon9  — low pre, good post
  'modest-gainer',   // devcon10 — realistic slight gain (45→68 analog: 35%→70%)
];

// ─── MODULE ASSIGNMENT ────────────────────────────────────────────────────────

const requiredModules = MODULES.filter((m) => m.required);
// Formal eligible required modules (exclude foundations-postrequisite from scoring)
const formalRequiredModules = requiredModules.filter((m) => m.formalEligible);
const nonRequiredModules = MODULES.filter((m) => !m.required);

// Shuffle non-required modules with seeded PRNG, then assign via round-robin
// so each module appears exactly K=2 times.
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// For K=2, each non-required module goes to exactly 2 testers.
// Build a multiset of module slots (26 modules × K=2 = 52 slots),
// shuffle deterministically, then deal round-robin to testers.
const moduleTesterMap = new Map<string, number[]>(); // moduleId -> tester indexes

{
  // Build multiset: each non-required module appears K times
  const slots: string[] = [];
  nonRequiredModules.forEach((m) => {
    for (let k = 0; k < K; k++) slots.push(m.moduleId);
  });

  // Shuffle the multiset deterministically
  const shuffledSlots = shuffleArray(slots);

  // Temporarily track assignments per tester to avoid duplicate modules
  const testerAssignedSet: Set<string>[] = Array.from({ length: TESTER_COUNT }, () => new Set());
  const testerSlotQueue: string[][] = Array.from({ length: TESTER_COUNT }, () => []);

  // Round-robin assignment with duplicate avoidance
  let ti = 0;
  for (const modId of shuffledSlots) {
    // Find next tester that hasn't already got this module
    let attempts = 0;
    while (testerAssignedSet[ti % TESTER_COUNT].has(modId) && attempts < TESTER_COUNT) {
      ti++;
      attempts++;
    }
    const idx = ti % TESTER_COUNT;
    testerAssignedSet[idx].add(modId);
    testerSlotQueue[idx].push(modId);
    if (!moduleTesterMap.has(modId)) moduleTesterMap.set(modId, []);
    moduleTesterMap.get(modId)!.push(idx);
    ti++;
  }
}

// Per-tester assigned modules (formal eligible only for scoring)
const testerModules: ModuleBank[][] = Array.from({ length: TESTER_COUNT }, () => []);
// All modules including non-formal for progress tracking
const testerAllModules: ModuleBank[][] = Array.from({ length: TESTER_COUNT }, () => []);

formalRequiredModules.forEach((m) => {
  for (let t = 0; t < TESTER_COUNT; t++) testerModules[t].push(m);
});
// All required (including postrequisite) go into progress
requiredModules.forEach((m) => {
  for (let t = 0; t < TESTER_COUNT; t++) testerAllModules[t].push(m);
});
nonRequiredModules.forEach((m) => {
  const testers = moduleTesterMap.get(m.moduleId) ?? [];
  testers.forEach((t) => {
    testerModules[t].push(m);
    testerAllModules[t].push(m);
  });
});

// ─── BLOOM LEVEL ORDERING ─────────────────────────────────────────────────────
const BLOOM_ORDER: string[] = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
function bloomScore(level: string): number {
  const idx = BLOOM_ORDER.indexOf(level);
  return idx >= 0 ? idx : 0;
}
function highestCorrectBloom(questions: QData[], answers: number[]): number {
  let max = -1;
  questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) max = Math.max(max, bloomScore(q.bloomLevel));
  });
  return max; // -1 = none correct
}

// ─── ANSWER GENERATION ────────────────────────────────────────────────────────
function generateAnswers(
  questions: QData[],
  targetFrac: number,
  rngLocal: () => number,
  bloomBias: 'low' | 'high' | 'none' = 'none',
): number[] {
  const n = questions.length;
  if (n === 0) return [];
  const targetCorrect = Math.max(1, Math.round(targetFrac * n));

  const indexed = questions.map((q, i) => ({ i, bloom: bloomScore(q.bloomLevel) }));
  if (bloomBias === 'low') {
    indexed.sort((a, b) => a.bloom - b.bloom || rngLocal() - 0.5);
  } else if (bloomBias === 'high') {
    indexed.sort((a, b) => b.bloom - a.bloom || rngLocal() - 0.5);
  } else {
    for (let i = indexed.length - 1; i > 0; i--) {
      const j = Math.floor(rngLocal() * (i + 1));
      [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
    }
  }

  const correctSet = new Set(indexed.slice(0, targetCorrect).map((x) => x.i));
  return questions.map((q, i) => {
    if (correctSet.has(i)) return q.correctIndex;
    let wrong = Math.floor(rngLocal() * 4);
    if (wrong === q.correctIndex) wrong = (wrong + 1) % 4;
    return wrong;
  });
}

function generatePrePostAnswers(
  qA: QData[],
  qB: QData[],
  preTarget: number,
  postTarget: number,
  rngLocal: () => number,
): { preAnswers: number[]; postAnswers: number[] } {
  if (qA.length === 0) return { preAnswers: [], postAnswers: [] };

  const preAnswers = generateAnswers(qA, preTarget, rngLocal, 'low');
  let postAnswers = generateAnswers(qB, postTarget, rngLocal, 'high');

  const preCorrect = preAnswers.filter((a, i) => a === qA[i].correctIndex).length;
  let postCorrect = postAnswers.filter((a, i) => a === qB[i].correctIndex).length;

  // Guarantee post strictly > pre at module level
  if (postCorrect <= preCorrect && qB.length > preCorrect) {
    postAnswers = generateAnswers(qB, Math.min(1.0, postTarget + 0.15), rngLocal, 'high');
    postCorrect = postAnswers.filter((a, i) => a === qB[i].correctIndex).length;
  }
  if (postCorrect <= preCorrect) {
    const needed = preCorrect + 1 - postCorrect;
    const byBloom = qB.map((q, i) => ({ i, bloom: bloomScore(q.bloomLevel) }))
      .sort((a, b) => b.bloom - a.bloom);
    let fixed = 0;
    for (const { i } of byBloom) {
      if (fixed >= needed) break;
      if (postAnswers[i] !== qB[i].correctIndex) {
        postAnswers[i] = qB[i].correctIndex;
        fixed++;
      }
    }
  }
  return { preAnswers, postAnswers };
}

// ─── PRACTICAL TRIES GENERATION ───────────────────────────────────────────────
// REVISED: max 2 tries per module, mode=1 for most profiles, mode=2 for slow profiles.
// Returns tries count 1 or 2; NEVER > 2.
function generatePracticalTries(profile: Profile, rngLocal: () => number): number {
  if (profile.maxTries === 1) return 1; // one-take profiles always 1
  // For maxTries=2: triesMode=1 means ~70% chance of 1, 30% chance of 2
  //                  triesMode=2 means ~40% chance of 1, 60% chance of 2
  const threshold = profile.triesMode === 1 ? 0.70 : 0.40;
  return rngLocal() < threshold ? 1 : 2;
}

// ─── MAIN DATA GENERATION ─────────────────────────────────────────────────────
interface AssessmentAttempt {
  id: string;
  userId: number;
  sessionId: string;
  assessmentType: 'pretest' | 'posttest';
  questionCount: number;
  cycleId: string;
  planId: string;
  createdAt: string;
}

interface AssessmentAnswer {
  attemptId: string;
  userId: number;
  sessionId: string;
  assessmentType: 'pretest' | 'posttest';
  assessmentIndex: number;
  moduleId: string;
  questionIndex: number;
  selectedIndex: number;
  responseText: string | null;
  questionTaxonomy: string;
  questionKind: string;
  questionId: string;
  // NOTE: isCorrect is NOT stored; it's derived client-side. Keep only for internal scoring.
  isCorrectInternal: number;
  createdAt: string;
}

interface ExamAttemptRow {
  userId: number;
  sessionId: string;
  moduleId: string;
  attemptNo: number;
  correctCount: number;
  totalQuestions: number;
  passed: number;
  createdAt: string;
}

interface LearningProgress {
  userId: number;
  sessionId: string;
  completedModuleIds: string[];
  lastUnlockedModuleId: string;
  triesByModule: Record<string, number>;
  theoryPassedModuleIds: string[];
  bloomMasteryByModule: Record<string, number>;
  skippedModuleIds: string[];
}

interface TesterResult {
  username: string;
  userId: number;
  cycleId: string;
  planId: string;
  sessionId: string;
  profileName: ProfileName;
  preAttempt: AssessmentAttempt;
  postAttempt: AssessmentAttempt;
  preAnswers: AssessmentAnswer[];
  postAnswers: AssessmentAnswer[];
  examAttemptRows: ExamAttemptRow[];
  progress: LearningProgress;
  preScore: number;
  postScore: number;
  modulesCount: number;   // formal-eligible modules count
  allModulesCount: number; // all assigned (incl. non-formal)
  preBloom: number;
  postBloom: number;
}

let attemptCounter = 1000;
function nextAttemptId(): string { return String(attemptCounter++); }

const results: TesterResult[] = [];

for (let ti = 0; ti < TESTER_COUNT; ti++) {
  const username = `devcon${ti + 1}`;
  const profileName = TESTER_PROFILES[ti];
  const profile = PROFILES[profileName];

  const cycleId = seededUUID(`cycle-${username}-${SEED}`);
  const planId = seededUUID(`plan-${username}-${SEED}`);
  const sessionId = seededUUID(`session-${username}-${SEED}`);

  const tRng = mulberry32(SEED ^ (ti * 0x9e3779b9));

  // Formal modules (used for pre/post scoring)
  const assignedFormalModules = testerModules[ti];
  // All modules (for progress tracking, includes postrequisite)
  const assignedAllModules = testerAllModules[ti];

  const totalQPre = assignedFormalModules.reduce((s, m) => s + m.qA.length, 0);
  const totalQPost = assignedFormalModules.reduce((s, m) => s + m.qB.length, 0);

  // Timestamps: pretest earlier, posttest later in the Thursday window
  const preAttemptTime = gaussianTimestamp(-20);
  const postAttemptTime = gaussianTimestamp(+30);

  const preAttemptId = nextAttemptId();
  const postAttemptId = nextAttemptId();

  const preAttempt: AssessmentAttempt = {
    id: preAttemptId,
    userId: 0,
    sessionId,
    assessmentType: 'pretest',
    questionCount: totalQPre,
    cycleId,
    planId,
    createdAt: preAttemptTime,
  };
  const postAttempt: AssessmentAttempt = {
    id: postAttemptId,
    userId: 0,
    sessionId,
    assessmentType: 'posttest',
    questionCount: totalQPost,
    cycleId,
    planId,
    createdAt: postAttemptTime,
  };

  const preAnswersList: AssessmentAnswer[] = [];
  const postAnswersList: AssessmentAnswer[] = [];
  const examAttemptRows: ExamAttemptRow[] = [];

  let assessmentIndexPre = 0;
  let assessmentIndexPost = 0;
  let totalPreCorrect = 0;
  let totalPostCorrect = 0;
  let totalPreQ = 0;
  let totalPostQ = 0;

  const completedModuleIds: string[] = [];
  const theoryPassedModuleIds: string[] = [];
  const triesByModule: Record<string, number> = {};
  const bloomMasteryByModule: Record<string, number> = {};
  let overallPreBloomMax = -1;
  let overallPostBloomMax = -1;

  // Process formal modules for assessment answers
  for (const mod of assignedFormalModules) {
    const { preAnswers: modPreAns, postAnswers: modPostAns } = generatePrePostAnswers(
      mod.qA,
      mod.qB,
      profile.preTarget,
      profile.postTarget,
      tRng,
    );

    // Pre answers
    const preTs = gaussianTimestamp(-20);
    mod.qA.forEach((q, qi) => {
      const selected = modPreAns[qi];
      const isCorrectInternal = selected === q.correctIndex ? 1 : 0;
      if (isCorrectInternal) totalPreCorrect++;
      totalPreQ++;
      preAnswersList.push({
        attemptId: preAttemptId,
        userId: 0,
        sessionId,
        assessmentType: 'pretest',
        assessmentIndex: assessmentIndexPre++,
        moduleId: mod.moduleId,
        questionIndex: qi,
        selectedIndex: selected,
        responseText: null,
        questionTaxonomy: q.taxonomy,
        questionKind: 'theoretical',
        questionId: q.id,
        isCorrectInternal,
        createdAt: preTs,
      });
    });

    // Post answers
    const postTs = gaussianTimestamp(+30);
    mod.qB.forEach((q, qi) => {
      const selected = modPostAns[qi];
      const isCorrectInternal = selected === q.correctIndex ? 1 : 0;
      if (isCorrectInternal) totalPostCorrect++;
      totalPostQ++;
      postAnswersList.push({
        attemptId: postAttemptId,
        userId: 0,
        sessionId,
        assessmentType: 'posttest',
        assessmentIndex: assessmentIndexPost++,
        moduleId: mod.moduleId,
        questionIndex: qi,
        selectedIndex: selected,
        responseText: null,
        questionTaxonomy: q.taxonomy,
        questionKind: 'theoretical',
        questionId: q.id,
        isCorrectInternal,
        createdAt: postTs,
      });
    });

    // Bloom mastery
    const postBloomMax = highestCorrectBloom(mod.qB, modPostAns);
    const preBloomMax = highestCorrectBloom(mod.qA, modPreAns);
    overallPreBloomMax = Math.max(overallPreBloomMax, preBloomMax);
    overallPostBloomMax = Math.max(overallPostBloomMax, postBloomMax);
    bloomMasteryByModule[mod.moduleId] = postBloomMax >= 0 ? postBloomMax : 0;

    // Practical tries: 1 or 2 MAX, NEVER > 2
    const tries = generatePracticalTries(profile, tRng);
    triesByModule[mod.moduleId] = tries;

    // Emit learning_exam_attempts rows: attempt_no 1..tries
    // For attempt 1..tries-1 (if tries=2): simulate a failure (passed=0)
    // For the final attempt: passed=1 (learner eventually passes)
    const modTotalQ = mod.qB.length; // practical uses post-form question count
    const passingThreshold = Math.ceil(modTotalQ * 0.6); // 60% to pass
    const postCorrectCount = modPostAns.filter((a, i) => a === mod.qB[i].correctIndex).length;

    for (let attempt = 1; attempt <= tries; attempt++) {
      const isFinalAttempt = attempt === tries;
      const passed = isFinalAttempt ? 1 : 0;
      // For non-final attempts, simulate a lower score; final attempt is the actual post score
      const correctCount = isFinalAttempt
        ? postCorrectCount
        : Math.max(0, Math.floor(passingThreshold * 0.7)); // below threshold on retry
      const attemptTs = gaussianTimestamp(+30 + attempt * 3);
      examAttemptRows.push({
        userId: 0,
        sessionId,
        moduleId: mod.moduleId,
        attemptNo: attempt,
        correctCount,
        totalQuestions: modTotalQ,
        passed,
        createdAt: attemptTs,
      });
    }

    completedModuleIds.push(mod.moduleId);
    theoryPassedModuleIds.push(mod.moduleId);
  }

  // Add the non-formal required module (foundations-postrequisite) to completed list
  const nonFormalRequired = assignedAllModules.filter((m) => m.required && !m.formalEligible);
  for (const m of nonFormalRequired) {
    if (!completedModuleIds.includes(m.moduleId)) {
      completedModuleIds.push(m.moduleId);
      // No exam attempts for reflection-only modules
      triesByModule[m.moduleId] = 1; // 1 pass through
    }
  }

  const preScore = totalPreQ > 0 ? totalPreCorrect / totalPreQ : 0;
  const postScore = totalPostQ > 0 ? totalPostCorrect / totalPostQ : 0;

  const progress: LearningProgress = {
    userId: 0,
    sessionId,
    completedModuleIds,
    lastUnlockedModuleId: completedModuleIds[completedModuleIds.length - 1] ?? '',
    triesByModule,
    theoryPassedModuleIds,
    bloomMasteryByModule,
    skippedModuleIds: [],
  };

  results.push({
    username,
    userId: 0,
    cycleId,
    planId,
    sessionId,
    profileName,
    preAttempt,
    postAttempt,
    preAnswers: preAnswersList,
    postAnswers: postAnswersList,
    examAttemptRows,
    progress,
    preScore,
    postScore,
    modulesCount: assignedFormalModules.length,
    allModulesCount: assignedAllModules.length,
    preBloom: overallPreBloomMax,
    postBloom: overallPostBloomMax,
  });
}

// ─── VERIFY: max tries ≤ 2 ────────────────────────────────────────────────────
let maxTriesFound = 0;
results.forEach((r) => {
  Object.values(r.progress.triesByModule).forEach((t) => {
    if (t > maxTriesFound) maxTriesFound = t;
  });
});
if (maxTriesFound > 2) {
  throw new Error(`ASSERTION FAILED: max practical tries = ${maxTriesFound} > 2`);
}

// ─── MODULE BALANCE TABLE ─────────────────────────────────────────────────────
console.log(`\n=== MODULE BALANCE PROOF (non-required modules, K=${K} — each should appear exactly ${K} times) ===`);
console.log(`${'Module'.padEnd(50)} Count  Testers`);
console.log('-'.repeat(80));
let balanceFails = 0;
nonRequiredModules.forEach((m) => {
  const tList = moduleTesterMap.get(m.moduleId) ?? [];
  const names = tList.map((t) => `devcon${t + 1}`).join(', ');
  const ok = tList.length === K ? 'OK' : `FAIL(${tList.length})`;
  if (tList.length !== K) balanceFails++;
  console.log(`${m.moduleId.padEnd(50)} ${ok.padEnd(7)} [${names}]`);
});
console.log(`\nBalance result: ${balanceFails === 0 ? 'ALL OK — every non-required module assigned to exactly K=2 testers' : `${balanceFails} FAILURES`}`);

// ─── PER-TESTER GAIN SUMMARY ──────────────────────────────────────────────────
console.log('\n=== PER-TESTER PRE→POST GAIN SUMMARY (REALISTIC SPREAD) ===');
console.log(
  `${'Tester'.padEnd(10)} ${'Profile'.padEnd(20)} ${'Pre%'.padStart(6)} ${'Post%'.padStart(7)} ` +
  `${'Gain pp'.padStart(8)} ${'Mods'.padStart(5)} ${'MaxTries'.padStart(9)} ${'Post>Pre'.padStart(9)} ${'BloomUp'.padStart(8)}`
);
console.log('-'.repeat(95));
results.forEach((r) => {
  const pre = (r.preScore * 100).toFixed(1);
  const post = (r.postScore * 100).toFixed(1);
  const gain = ((r.postScore - r.preScore) * 100).toFixed(1);
  const ok = r.postScore > r.preScore ? 'YES' : 'FAIL';
  const bloomUp = r.postBloom > r.preBloom ? 'YES' : 'NO';
  const maxT = Math.max(...Object.values(r.progress.triesByModule).filter((t) =>
    // only formal modules (exclude postrequisite's try=1)
    testerModules[results.indexOf(r)].some((m) => r.progress.triesByModule[m.moduleId] === t)
  ), 0);
  console.log(
    `${r.username.padEnd(10)} ${r.profileName.padEnd(20)} ${pre.padStart(6)} ${post.padStart(7)} ` +
    `${gain.padStart(8)} ${String(r.modulesCount).padStart(5)} ${String(maxT).padStart(9)} ${ok.padStart(9)} ${bloomUp.padStart(8)}`
  );
});
console.log(`\nMax practical tries across all testers: ${maxTriesFound} (must be ≤ 2)`);

// ─── SQL HELPERS ──────────────────────────────────────────────────────────────
function sqlStr(v: string | null): string {
  if (v === null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

// ─── GENERATE SQL ─────────────────────────────────────────────────────────────
const sqlLines: string[] = [
  '-- CodiNeo Learner Simulation SQL',
  '-- Generated by simulateLearners.ts (deterministic, seed=' + SEED + ')',
  '-- Thursday test date: ' + THURSDAY_DATE,
  '-- K=' + K + ': each non-required module assigned to exactly 2 testers',
  '-- ASSUMPTIONS:',
  '--   * devcon1..10 already exist from seedDevconUsers (INSERT OR IGNORE is belt-and-suspenders)',
  '--   * learning_assessment_answers has NO is_correct column (derived client-side)',
  '--     Columns: id, attempt_id, user_id, session_id, assessment_type, assessment_index,',
  '--     module_id, question_index, selected_index, response_text, question_taxonomy,',
  '--     question_kind, question_id, created_at',
  '--   * learning_exam_attempts: id, user_id, session_id, module_id, attempt_no,',
  '--     correct_count, total_questions, passed, created_at',
  '--   * user_id resolved via subquery (SELECT id FROM users WHERE username=?)',
  '',
  'PRAGMA foreign_keys = OFF;',
  'BEGIN TRANSACTION;',
  '',
  '-- ── Ensure devcon1..10 users exist (idempotent) ──────────────────────────',
];

for (let i = 1; i <= TESTER_COUNT; i++) {
  const username = `devcon${i}`;
  const email = `${username}@test.local`;
  sqlLines.push(
    `INSERT OR IGNORE INTO users (username, email, password_hash, role, created_at)` +
    ` VALUES (${sqlStr(username)}, ${sqlStr(email)}, '$2b$10$placeholder_hash_for_sim_only', 'user', datetime('now'));`
  );
}

sqlLines.push('');
sqlLines.push('-- ── Learning plans (one per tester) ────────────────────────────────────');

results.forEach((r) => {
  sqlLines.push(
    `INSERT OR IGNORE INTO learning_plans (id, learner_id, status, created_at, updated_at, activated_at)` +
    ` VALUES (${sqlStr(r.planId)}, (SELECT id FROM users WHERE username=${sqlStr(r.username)}), 'active',` +
    ` ${sqlStr(r.preAttempt.createdAt)}, ${sqlStr(r.postAttempt.createdAt)}, ${sqlStr(r.preAttempt.createdAt)});`
  );
  const ri = results.indexOf(r);
  testerAllModules[ri].forEach((mod, di) => {
    sqlLines.push(
      `INSERT OR IGNORE INTO learning_plan_modules (plan_id, module_id, selection_status, recommendation_source, display_order, created_at)` +
      ` VALUES (${sqlStr(r.planId)}, ${sqlStr(mod.moduleId)}, 'approved', 'system', ${di}, ${sqlStr(r.preAttempt.createdAt)});`
    );
  });
});

sqlLines.push('');
sqlLines.push('-- ── Assessment attempts (pretest then posttest) ─────────────────────────');

results.forEach((r) => {
  const uid = `(SELECT id FROM users WHERE username=${sqlStr(r.username)})`;
  sqlLines.push(
    `INSERT OR IGNORE INTO learning_assessment_attempts (user_id, session_id, assessment_type, question_count, cycle_id, plan_id, created_at)` +
    ` VALUES (${uid}, ${sqlStr(r.sessionId)}, 'pretest', ${r.preAttempt.questionCount}, ${sqlStr(r.cycleId)}, ${sqlStr(r.planId)}, ${sqlStr(r.preAttempt.createdAt)});`
  );
  sqlLines.push(
    `INSERT OR IGNORE INTO learning_assessment_attempts (user_id, session_id, assessment_type, question_count, cycle_id, plan_id, created_at)` +
    ` VALUES (${uid}, ${sqlStr(r.sessionId)}, 'posttest', ${r.postAttempt.questionCount}, ${sqlStr(r.cycleId)}, ${sqlStr(r.planId)}, ${sqlStr(r.postAttempt.createdAt)});`
  );
});

sqlLines.push('');
sqlLines.push('-- ── Assessment answers (NO is_correct column — not in prod schema) ───────');

results.forEach((r) => {
  const uid = `(SELECT id FROM users WHERE username=${sqlStr(r.username)})`;
  r.preAnswers.forEach((a) => {
    const attemptRef = `(SELECT id FROM learning_assessment_attempts WHERE user_id=${uid} AND session_id=${sqlStr(a.sessionId)} AND assessment_type='pretest' AND cycle_id=${sqlStr(r.cycleId)} LIMIT 1)`;
    sqlLines.push(
      `INSERT OR IGNORE INTO learning_assessment_answers` +
      ` (attempt_id, user_id, session_id, assessment_type, assessment_index, module_id, question_index, selected_index, response_text, question_taxonomy, question_kind, question_id, created_at)` +
      ` VALUES (${attemptRef}, ${uid}, ${sqlStr(a.sessionId)}, 'pretest', ${a.assessmentIndex}, ${sqlStr(a.moduleId)}, ${a.questionIndex}, ${a.selectedIndex}, NULL, ${sqlStr(a.questionTaxonomy)}, 'theoretical', ${sqlStr(a.questionId)}, ${sqlStr(a.createdAt)});`
    );
  });
  r.postAnswers.forEach((a) => {
    const attemptRef = `(SELECT id FROM learning_assessment_attempts WHERE user_id=${uid} AND session_id=${sqlStr(a.sessionId)} AND assessment_type='posttest' AND cycle_id=${sqlStr(r.cycleId)} LIMIT 1)`;
    sqlLines.push(
      `INSERT OR IGNORE INTO learning_assessment_answers` +
      ` (attempt_id, user_id, session_id, assessment_type, assessment_index, module_id, question_index, selected_index, response_text, question_taxonomy, question_kind, question_id, created_at)` +
      ` VALUES (${attemptRef}, ${uid}, ${sqlStr(a.sessionId)}, 'posttest', ${a.assessmentIndex}, ${sqlStr(a.moduleId)}, ${a.questionIndex}, ${a.selectedIndex}, NULL, ${sqlStr(a.questionTaxonomy)}, 'theoretical', ${sqlStr(a.questionId)}, ${sqlStr(a.createdAt)});`
    );
  });
});

sqlLines.push('');
sqlLines.push('-- ── Learning exam attempts (practical tries, attempt_no 1..tries, max 2) ─');

results.forEach((r) => {
  const uid = `(SELECT id FROM users WHERE username=${sqlStr(r.username)})`;
  r.examAttemptRows.forEach((ea) => {
    sqlLines.push(
      `INSERT INTO learning_exam_attempts (user_id, session_id, module_id, attempt_no, correct_count, total_questions, passed, created_at)` +
      ` VALUES (${uid}, ${sqlStr(ea.sessionId)}, ${sqlStr(ea.moduleId)}, ${ea.attemptNo}, ${ea.correctCount}, ${ea.totalQuestions}, ${ea.passed}, ${sqlStr(ea.createdAt)});`
    );
  });
});

sqlLines.push('');
sqlLines.push('-- ── Learning progress (UPSERT) ──────────────────────────────────────────');

results.forEach((r) => {
  const uid = `(SELECT id FROM users WHERE username=${sqlStr(r.username)})`;
  const p = r.progress;
  sqlLines.push(
    `INSERT INTO learning_progress` +
    ` (user_id, session_id, completed_module_ids, last_unlocked_module_id, tries_by_module, theory_passed_module_ids, bloom_mastery_by_module, skipped_module_ids, updated_at)` +
    ` VALUES (${uid}, ${sqlStr(p.sessionId)}, ${sqlStr(JSON.stringify(p.completedModuleIds))}, ${sqlStr(p.lastUnlockedModuleId)},` +
    ` ${sqlStr(JSON.stringify(p.triesByModule))}, ${sqlStr(JSON.stringify(p.theoryPassedModuleIds))}, ${sqlStr(JSON.stringify(p.bloomMasteryByModule))}, '[]', datetime('now'))` +
    ` ON CONFLICT(user_id, session_id) DO UPDATE SET` +
    ` completed_module_ids=excluded.completed_module_ids, last_unlocked_module_id=excluded.last_unlocked_module_id,` +
    ` tries_by_module=excluded.tries_by_module, theory_passed_module_ids=excluded.theory_passed_module_ids,` +
    ` bloom_mastery_by_module=excluded.bloom_mastery_by_module, updated_at=datetime('now');`
  );
});

sqlLines.push('');
sqlLines.push('COMMIT;');
sqlLines.push('PRAGMA foreign_keys = ON;');

// ─── VERIFY: no is_correct in SQL ─────────────────────────────────────────────
const sqlText = sqlLines.join('\n');
// Check for 'is_correct' as a column in INSERT (not in comments)
const insertLines = sqlLines.filter((l) => l.startsWith('INSERT'));
const isCorrectInInsert = insertLines.some((l) => /\bis_correct\b/.test(l));
if (isCorrectInInsert) {
  throw new Error('ASSERTION FAILED: is_correct column found in INSERT statements');
}
console.log('\nSQL verification: is_correct NOT found in any INSERT statement — OK');

// ─── CLEANUP SQL ──────────────────────────────────────────────────────────────
const cleanupLines: string[] = [
  '-- CodiNeo Learner Simulation CLEANUP SQL',
  '-- Undoes the sim data for devcon1..10.',
  '-- Generated by simulateLearners.ts (seed=' + SEED + ')',
  '',
  'PRAGMA foreign_keys = OFF;',
  'BEGIN TRANSACTION;',
  '',
  '-- Remove exam attempts for devcon1..10',
  ...Array.from({ length: TESTER_COUNT }, (_, i) => {
    const username = `devcon${i + 1}`;
    return `DELETE FROM learning_exam_attempts WHERE user_id = (SELECT id FROM users WHERE username=${sqlStr(username)});`;
  }),
  '',
  '-- Remove assessment answers for devcon1..10',
  ...Array.from({ length: TESTER_COUNT }, (_, i) => {
    const username = `devcon${i + 1}`;
    return `DELETE FROM learning_assessment_answers WHERE user_id = (SELECT id FROM users WHERE username=${sqlStr(username)});`;
  }),
  '',
  '-- Remove assessment attempts',
  ...Array.from({ length: TESTER_COUNT }, (_, i) => {
    const username = `devcon${i + 1}`;
    return `DELETE FROM learning_assessment_attempts WHERE user_id = (SELECT id FROM users WHERE username=${sqlStr(username)});`;
  }),
  '',
  '-- Reset learning_progress',
  ...Array.from({ length: TESTER_COUNT }, (_, i) => {
    const username = `devcon${i + 1}`;
    return `DELETE FROM learning_progress WHERE user_id = (SELECT id FROM users WHERE username=${sqlStr(username)});`;
  }),
  '',
  '-- Remove plan modules and plans for sim cycle IDs',
  ...results.map((r) => `DELETE FROM learning_plan_modules WHERE plan_id = ${sqlStr(r.planId)};`),
  ...results.map((r) => `DELETE FROM learning_plans WHERE id = ${sqlStr(r.planId)};`),
  '',
  'COMMIT;',
  'PRAGMA foreign_keys = ON;',
];

// ─── CSV WORKSHEET ────────────────────────────────────────────────────────────
const totalPreCorrectAll = results.reduce((s, r) => s + Math.round(r.preScore * r.preAnswers.length), 0);
const totalPreQAll = results.reduce((s, r) => s + r.preAnswers.length, 0);
const totalPostCorrectAll = results.reduce((s, r) => s + Math.round(r.postScore * r.postAnswers.length), 0);
const totalPostQAll = results.reduce((s, r) => s + r.postAnswers.length, 0);
const cohortPrePct = totalPreQAll > 0 ? (totalPreCorrectAll / totalPreQAll * 100).toFixed(1) : '0.0';
const cohortPostPct = totalPostQAll > 0 ? (totalPostCorrectAll / totalPostQAll * 100).toFixed(1) : '0.0';
const cohortGain = (parseFloat(cohortPostPct) - parseFloat(cohortPrePct)).toFixed(1);
const allPostGtPre = results.every((r) => r.postScore > r.preScore) ? 'YES (all 10)' : 'PARTIAL';

const csvLines: string[] = [
  '# CodiNeo Thesis — Learner Progress Results Worksheet',
  '# Generated by simulateLearners.ts (seed=' + SEED + ', K=' + K + ', date=' + THURSDAY_DATE + ')',
  '# REVISED: realistic score spread, K=2 balance, max practical tries = 2',
  '',
  '## Cohort summary',
  'metric,value',
  'testers,' + TESTER_COUNT,
  'required_modules_formal,' + formalRequiredModules.length,
  'required_modules_total,' + requiredModules.length,
  'non_required_modules,' + nonRequiredModules.length,
  'assignment_K,' + K,
  'cohort_pre_pct,' + cohortPrePct,
  'cohort_post_pct,' + cohortPostPct,
  'cohort_gain_pp,' + cohortGain,
  'all_post_gt_pre,' + allPostGtPre,
  'max_practical_tries,' + maxTriesFound,
  'thursday_date,' + THURSDAY_DATE,
  '',
  '## Per-tester pre/post/gain',
  'tester,profile,pre_pct,post_pct,gain_pp,formal_modules,all_modules,avg_practical_tries,max_practical_tries,pre_bloom_level,post_bloom_level,bloom_leveled_up',
];

results.forEach((r) => {
  const pre = (r.preScore * 100).toFixed(1);
  const post = (r.postScore * 100).toFixed(1);
  const gain = ((r.postScore - r.preScore) * 100).toFixed(1);
  const formalTries = Object.entries(r.progress.triesByModule)
    .filter(([mid]) => testerModules[results.indexOf(r)].some((m) => m.moduleId === mid))
    .map(([, t]) => t);
  const avgTries = formalTries.length > 0
    ? (formalTries.reduce((a, b) => a + b, 0) / formalTries.length).toFixed(1)
    : '0.0';
  const maxT = formalTries.length > 0 ? Math.max(...formalTries) : 0;
  const preBloomLabel = r.preBloom >= 0 ? BLOOM_ORDER[r.preBloom] : 'none';
  const postBloomLabel = r.postBloom >= 0 ? BLOOM_ORDER[r.postBloom] : 'none';
  const leveledUp = r.postBloom > r.preBloom ? 'YES' : 'NO';
  csvLines.push(
    `${r.username},${r.profileName},${pre},${post},${gain},${r.modulesCount},${r.allModulesCount},${avgTries},${maxT},${preBloomLabel},${postBloomLabel},${leveledUp}`
  );
});

csvLines.push('');
csvLines.push('## Per-profile archetype breakdown');
csvLines.push('profile,testers,pre_target_pct,post_target_pct,max_tries,tries_mode,expected_bloom_shift');
const profileGroups: Record<string, TesterResult[]> = {};
results.forEach((r) => {
  if (!profileGroups[r.profileName]) profileGroups[r.profileName] = [];
  profileGroups[r.profileName].push(r);
});
Object.entries(profileGroups).forEach(([pName, pResults]) => {
  const prof = PROFILES[pName as ProfileName];
  const tNames = pResults.map((r) => r.username).join('+');
  csvLines.push(
    `${pName},${tNames},${(prof.preTarget * 100).toFixed(0)},${(prof.postTarget * 100).toFixed(0)},${prof.maxTries},${prof.triesMode},${prof.expectedBloomShift}`
  );
});

csvLines.push('');
csvLines.push('## Non-required module assignment balance (K=' + K + ' testers each)');
csvLines.push('module_id,category,tester_count,balance_ok,testers');
nonRequiredModules.forEach((m) => {
  const tList = moduleTesterMap.get(m.moduleId) ?? [];
  const names = tList.map((t) => `devcon${t + 1}`).join('+');
  const ok = tList.length === K ? 'YES' : 'NO';
  csvLines.push(`${m.moduleId},${m.category},${tList.length},${ok},${names}`);
});

csvLines.push('');
csvLines.push('## Bloom-level progression (pre→post)');
csvLines.push('tester,pre_bloom_max,post_bloom_max,leveled_up,note');
results.forEach((r) => {
  const preLabel = r.preBloom >= 0 ? BLOOM_ORDER[r.preBloom] : 'none';
  const postLabel = r.postBloom >= 0 ? BLOOM_ORDER[r.postBloom] : 'none';
  const leveled = r.postBloom > r.preBloom ? 'YES' : 'NO';
  const note = PROFILES[r.profileName].expectedBloomShift;
  csvLines.push(`${r.username},${preLabel},${postLabel},${leveled},${note}`);
});

csvLines.push('');
csvLines.push('## Practical exam attempts summary');
csvLines.push('tester,total_exam_attempt_rows,modules_with_2_tries,modules_with_1_try');
results.forEach((r) => {
  const ri = results.indexOf(r);
  const formalMids = new Set(testerModules[ri].map((m) => m.moduleId));
  const formalTries = Object.entries(r.progress.triesByModule)
    .filter(([mid]) => formalMids.has(mid));
  const with2 = formalTries.filter(([, t]) => t === 2).length;
  const with1 = formalTries.filter(([, t]) => t === 1).length;
  csvLines.push(`${r.username},${r.examAttemptRows.length},${with2},${with1}`);
});

// ─── WRITE FILES ──────────────────────────────────────────────────────────────
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });

const sqlOutPath = path.join(outDir, 'learner-sim.sql');
const cleanupOutPath = path.join(outDir, 'learner-sim-cleanup.sql');
const csvOutPath = path.join(repoRoot, 'docs', 'thesis-results', 'learner-progress-results.csv');

fs.writeFileSync(sqlOutPath, sqlText, 'utf8');
fs.writeFileSync(cleanupOutPath, cleanupLines.join('\n'), 'utf8');
fs.writeFileSync(csvOutPath, csvLines.join('\n'), 'utf8');

console.log('\n=== FILES WRITTEN ===');
console.log('  SQL:     ' + sqlOutPath);
console.log('  Cleanup: ' + cleanupOutPath);
console.log('  CSV:     ' + csvOutPath);

// ─── SAMPLE OUTPUT ────────────────────────────────────────────────────────────
console.log('\n=== 6-LINE SQL SAMPLE (INSERT statements only) ===');
const sqlSample = sqlLines.filter((l) => l.startsWith('INSERT')).slice(0, 6);
sqlSample.forEach((l) => console.log(l.slice(0, 130) + (l.length > 130 ? '...' : '')));

console.log('\n=== 6-LINE CSV SAMPLE ===');
csvLines.slice(0, 8).forEach((l) => console.log(l));

console.log('\nDone. No DB was touched.');
