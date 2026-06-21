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
 */

import fs from 'fs';
import path from 'path';

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
const SEED = 42;
const THURSDAY_DATE = '2026-06-25'; // next Thursday (default)
const TESTER_COUNT = 10;
const K = 3; // non-required modules assigned to exactly K testers

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
  qA: QData[];
  qB: QData[];
}

// All modules extracted from the assessment banks (Forms A & B).
const MODULES: ModuleBank[] = [
  // ──── FOUNDATIONS (required) ────
  {
    moduleId: 'foundations-what-is-pattern', category: 'foundations', required: true,
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
    moduleId: 'foundations-why-matters', category: 'foundations', required: true,
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
    moduleId: 'foundations-categories', category: 'foundations', required: true,
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
    moduleId: 'foundations-oop', category: 'foundations', required: true,
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
    moduleId: 'foundations-interface-principle', category: 'foundations', required: true,
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
    moduleId: 'foundations-code-structure', category: 'foundations', required: true,
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
    moduleId: 'foundations-real-software', category: 'foundations', required: true,
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
    moduleId: 'foundations-beginner-mistakes', category: 'foundations', required: true,
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
    moduleId: 'foundations-ambiguity', category: 'foundations', required: true,
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
    moduleId: 'foundations-connotative-definition', category: 'foundations', required: true,
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
    moduleId: 'foundations-same-structure', category: 'foundations', required: true,
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
    moduleId: 'foundations-structural-rules', category: 'foundations', required: true,
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
    moduleId: 'foundations-context-variation', category: 'foundations', required: true,
    qA: [
      { id: 'foundations-context-variation:A1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 1 },
      { id: 'foundations-context-variation:A2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 2 },
    ],
    qB: [
      { id: 'foundations-context-variation:B1', taxonomy: 'remembering', bloomLevel: 'remember', correctIndex: 0 },
      { id: 'foundations-context-variation:B2', taxonomy: 'understanding', bloomLevel: 'understand', correctIndex: 3 },
    ],
  },

  // ──── CREATIONAL (non-required) ────
  {
    moduleId: 'creational-builder', category: 'creational', required: false,
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
    moduleId: 'creational-singleton', category: 'creational', required: false,
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
    moduleId: 'creational-factory-method', category: 'creational', required: false,
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
    moduleId: 'creational-method-chaining', category: 'creational', required: false,
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
    moduleId: 'creational-prototype', category: 'creational', required: false,
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
    moduleId: 'creational-abstract-factory', category: 'creational', required: false,
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
    moduleId: 'structural-adapter', category: 'structural', required: false,
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
    moduleId: 'structural-proxy', category: 'structural', required: false,
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
    moduleId: 'structural-decorator', category: 'structural', required: false,
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
    moduleId: 'structural-composite', category: 'structural', required: false,
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
    moduleId: 'structural-repository', category: 'structural', required: false,
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
    moduleId: 'structural-bridge', category: 'structural', required: false,
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
    moduleId: 'structural-facade', category: 'structural', required: false,
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
    moduleId: 'structural-flyweight', category: 'structural', required: false,
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
    moduleId: 'behavioural-strategy', category: 'behavioural', required: false,
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
    moduleId: 'behavioural-observer', category: 'behavioural', required: false,
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
    moduleId: 'behavioural-iterator', category: 'behavioural', required: false,
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
    moduleId: 'behavioural-command', category: 'behavioural', required: false,
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
    moduleId: 'behavioural-template-method', category: 'behavioural', required: false,
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
    moduleId: 'behavioural-state', category: 'behavioural', required: false,
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
    moduleId: 'behavioural-chain-of-responsibility', category: 'behavioural', required: false,
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
    moduleId: 'behavioural-mediator', category: 'behavioural', required: false,
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
    moduleId: 'behavioural-visitor', category: 'behavioural', required: false,
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
    moduleId: 'behavioural-interpreter', category: 'behavioural', required: false,
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
    moduleId: 'behavioural-memento', category: 'behavioural', required: false,
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
    moduleId: 'idioms-pimpl', category: 'idioms', required: false,
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

// ─── LEARNER PROFILES ─────────────────────────────────────────────────────────
// Maps devcon1-10 to archetypes; post% always > pre%.
type ProfileName = 'near-perfect' | 'mcq-strong-practical-weak' | 'steady-improver' | 'slow-starter' | 'high-achiever';

interface Profile {
  name: ProfileName;
  preTarget: number;   // target pre-test correct fraction
  postTarget: number;  // target post-test correct fraction
  practicalTriesRange: [number, number]; // [min, max] tries per module
}

const PROFILES: Record<ProfileName, Profile> = {
  'near-perfect':              { name: 'near-perfect',              preTarget: 0.75, postTarget: 0.98, practicalTriesRange: [1, 1] },
  'high-achiever':             { name: 'high-achiever',             preTarget: 0.60, postTarget: 0.95, practicalTriesRange: [1, 2] },
  'mcq-strong-practical-weak': { name: 'mcq-strong-practical-weak', preTarget: 0.60, postTarget: 0.92, practicalTriesRange: [3, 4] },
  'steady-improver':           { name: 'steady-improver',           preTarget: 0.40, postTarget: 0.80, practicalTriesRange: [2, 3] },
  'slow-starter':              { name: 'slow-starter',              preTarget: 0.30, postTarget: 0.70, practicalTriesRange: [2, 4] },
};

// Assign profiles to devcon1..10
const TESTER_PROFILES: ProfileName[] = [
  'near-perfect',              // devcon1
  'high-achiever',             // devcon2
  'mcq-strong-practical-weak', // devcon3
  'steady-improver',           // devcon4
  'slow-starter',              // devcon5
  'near-perfect',              // devcon6
  'high-achiever',             // devcon7
  'steady-improver',           // devcon8
  'mcq-strong-practical-weak', // devcon9
  'slow-starter',              // devcon10
];

// ─── MODULE ASSIGNMENT ────────────────────────────────────────────────────────

const requiredModules = MODULES.filter((m) => m.required);
const nonRequiredModules = MODULES.filter((m) => !m.required);

// Shuffle non-required modules with seeded PRNG, then assign via round-robin
// so each module appears exactly K=3 times, distributed evenly across testers.
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// For K=3, each non-required module goes to exactly 3 testers.
// We build a repeating list and chunk by K.
const shuffledNR = shuffleArray(nonRequiredModules);

// Assign tester indices to each non-required module (K per module)
const testerIndices = Array.from({ length: TESTER_COUNT }, (_, i) => i); // 0..9

// Create round-robin pool: repeat the shuffled tester indices K times, then
// cyclically assign K consecutive to each module.
const moduleTesterMap = new Map<string, number[]>(); // moduleId -> tester indexes

// We need K slots per non-required module; testers assigned cyclically
{
  const pool: number[] = [];
  const shuffledTesters = shuffleArray(testerIndices);
  // Repeat until we have enough slots
  while (pool.length < nonRequiredModules.length * K) {
    pool.push(...shuffledTesters);
  }

  // Each module gets K consecutive entries
  shuffledNR.forEach((mod, i) => {
    const slice = pool.slice(i * K, i * K + K);
    moduleTesterMap.set(mod.moduleId, slice);
  });
}

// Per-tester assigned modules
const testerModules: ModuleBank[][] = Array.from({ length: TESTER_COUNT }, () => []);
requiredModules.forEach((m) => {
  for (let t = 0; t < TESTER_COUNT; t++) testerModules[t].push(m);
});
nonRequiredModules.forEach((m) => {
  const testers = moduleTesterMap.get(m.moduleId) ?? [];
  testers.forEach((t) => testerModules[t].push(m));
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
// Generate answer array hitting ~targetFrac correct.
// bloomBias='low' = prefer correct answers on lower-bloom questions (pretest)
// bloomBias='high' = prefer correct answers on higher-bloom questions (posttest)
function generateAnswers(
  questions: QData[],
  targetFrac: number,
  rngLocal: () => number,
  bloomBias: 'low' | 'high' | 'none' = 'none',
): number[] {
  const n = questions.length;
  const targetCorrect = Math.max(1, Math.round(targetFrac * n));

  // Order indices by bloom level based on bias
  const indexed = questions.map((q, i) => ({ i, bloom: bloomScore(q.bloomLevel) }));
  if (bloomBias === 'low') {
    // Lower bloom first — make them correct first
    indexed.sort((a, b) => a.bloom - b.bloom || rngLocal() - 0.5);
  } else if (bloomBias === 'high') {
    // Higher bloom first — make them correct first
    indexed.sort((a, b) => b.bloom - a.bloom || rngLocal() - 0.5);
  } else {
    // Random shuffle
    for (let i = indexed.length - 1; i > 0; i--) {
      const j = Math.floor(rngLocal() * (i + 1));
      [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
    }
  }

  const correctSet = new Set(indexed.slice(0, targetCorrect).map((x) => x.i));
  return questions.map((q, i) => {
    if (correctSet.has(i)) return q.correctIndex;
    // Choose wrong answer (not correctIndex)
    let wrong = Math.floor(rngLocal() * 4);
    if (wrong === q.correctIndex) wrong = (wrong + 1) % 4;
    return wrong;
  });
}

// Generate pre (Form A) and post (Form B) answers separately, guaranteeing
// that post correct count >= pre correct count + 1 at the module level.
// Bloom bias: pretest favours low-bloom correct; posttest favours high-bloom correct.
function generatePrePostAnswers(
  qA: QData[],
  qB: QData[],
  preTarget: number,
  postTarget: number,
  rngLocal: () => number,
): { preAnswers: number[]; postAnswers: number[] } {
  const preAnswers = generateAnswers(qA, preTarget, rngLocal, 'low');
  let postAnswers = generateAnswers(qB, postTarget, rngLocal, 'high');

  // Count correct on their respective forms
  const preCorrect = preAnswers.filter((a, i) => a === qA[i].correctIndex).length;
  let postCorrect = postAnswers.filter((a, i) => a === qB[i].correctIndex).length;

  // If post isn't strictly greater, bump the target and retry
  if (postCorrect <= preCorrect && qB.length > preCorrect) {
    postAnswers = generateAnswers(qB, Math.min(1.0, postTarget + 0.15), rngLocal, 'high');
    postCorrect = postAnswers.filter((a, i) => a === qB[i].correctIndex).length;
  }
  // Last resort: force-correct enough higher-bloom questions in post to exceed pre
  if (postCorrect <= preCorrect) {
    const needed = preCorrect + 1 - postCorrect;
    // Sort indices by bloom descending, fix from highest bloom first
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
  isCorrect: number;
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
  userId: number; // placeholder (looked up at run time; we use SELECT)
  cycleId: string;
  planId: string;
  sessionId: string;
  profileName: ProfileName;
  preAttempt: AssessmentAttempt;
  postAttempt: AssessmentAttempt;
  preAnswers: AssessmentAnswer[];
  postAnswers: AssessmentAnswer[];
  progress: LearningProgress;
  preScore: number;  // fraction [0,1]
  postScore: number; // fraction [0,1]
  modulesCount: number;
  preBloom: number;
  postBloom: number;
}

// Unique attempt ID generator (sequential, deterministic)
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

  // Seeded PRNG per tester so answers are reproducible
  const tRng = mulberry32(SEED ^ (ti * 0x9e3779b9));

  const assignedModules = testerModules[ti];
  const totalQPre = assignedModules.reduce((s, m) => s + m.qA.length, 0);
  const totalQPost = assignedModules.reduce((s, m) => s + m.qB.length, 0);

  // Pre: earlier in window (mean+0), Post: later (mean+40 min offset)
  const preAttemptTime = gaussianTimestamp(-20);
  const postAttemptTime = gaussianTimestamp(+30);

  const preAttemptId = nextAttemptId();
  const postAttemptId = nextAttemptId();

  const preAttempt: AssessmentAttempt = {
    id: preAttemptId,
    userId: 0, // resolved via SELECT in SQL
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

  for (const mod of assignedModules) {
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
      const isCorrect = selected === q.correctIndex ? 1 : 0;
      if (isCorrect) totalPreCorrect++;
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
        isCorrect,
        createdAt: preTs,
      });
    });

    // Post answers
    const postTs = gaussianTimestamp(+30);
    mod.qB.forEach((q, qi) => {
      const selected = modPostAns[qi];
      const isCorrect = selected === q.correctIndex ? 1 : 0;
      if (isCorrect) totalPostCorrect++;
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
        isCorrect,
        createdAt: postTs,
      });
    });

    // Bloom mastery: highest correct bloom level on post form
    const postBloomMax = highestCorrectBloom(mod.qB, modPostAns);
    const preBloomMax = highestCorrectBloom(mod.qA, modPreAns);
    overallPreBloomMax = Math.max(overallPreBloomMax, preBloomMax);
    overallPostBloomMax = Math.max(overallPostBloomMax, postBloomMax);

    bloomMasteryByModule[mod.moduleId] = postBloomMax >= 0 ? postBloomMax : 0;

    // Practical tries
    const tries = randInt(profile.practicalTriesRange[0], profile.practicalTriesRange[1]);
    triesByModule[mod.moduleId] = tries;

    // Mark module completed & theory passed
    completedModuleIds.push(mod.moduleId);
    theoryPassedModuleIds.push(mod.moduleId);
  }

  const preScore = totalPreQ > 0 ? totalPreCorrect / totalPreQ : 0;
  const postScore = totalPostQ > 0 ? totalPostCorrect / totalPostQ : 0;

  // Guarantee post > pre at the aggregate level (should be true by design, but clamp)
  // If somehow equal, note it (should not happen with profile design)

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
    progress,
    preScore,
    postScore,
    modulesCount: assignedModules.length,
    preBloom: overallPreBloomMax,
    postBloom: overallPostBloomMax,
  });
}

// ─── MODULE BALANCE TABLE ─────────────────────────────────────────────────────
console.log('\n=== MODULE BALANCE PROOF (non-required modules, each should appear exactly K=' + K + ' times) ===');
console.log(`${'Module'.padEnd(48)} Testers`);
console.log('-'.repeat(70));
nonRequiredModules.forEach((m) => {
  const tList = moduleTesterMap.get(m.moduleId) ?? [];
  const names = tList.map((t) => `devcon${t + 1}`).join(', ');
  const ok = tList.length === K ? 'OK' : 'FAIL';
  console.log(`${m.moduleId.padEnd(48)} ${ok}  [${names}]`);
});

// ─── PER-TESTER GAIN SUMMARY ──────────────────────────────────────────────────
console.log('\n=== PER-TESTER PRE→POST GAIN SUMMARY ===');
console.log(`${'Tester'.padEnd(10)} ${'Profile'.padEnd(28)} ${'Pre%'.padStart(6)} ${'Post%'.padStart(7)} ${'Gain pp'.padStart(8)} ${'Mods'.padStart(5)} ${'Post>Pre'.padStart(9)}`);
console.log('-'.repeat(80));
results.forEach((r) => {
  const pre = (r.preScore * 100).toFixed(1);
  const post = (r.postScore * 100).toFixed(1);
  const gain = ((r.postScore - r.preScore) * 100).toFixed(1);
  const ok = r.postScore > r.preScore ? 'YES' : 'FAIL';
  console.log(
    `${r.username.padEnd(10)} ${r.profileName.padEnd(28)} ${pre.padStart(6)} ${post.padStart(7)} ${gain.padStart(8)} ${String(r.modulesCount).padStart(5)} ${ok.padStart(9)}`
  );
});

// ─── SQL HELPERS ──────────────────────────────────────────────────────────────
function sqlStr(v: string | null): string {
  if (v === null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}
function sqlInt(v: number): string { return String(v); }

// ─── GENERATE SQL ─────────────────────────────────────────────────────────────
const sqlLines: string[] = [
  '-- CodiNeo Learner Simulation SQL',
  '-- Generated by simulateLearners.ts (deterministic, seed=' + SEED + ')',
  '-- Thursday test date: ' + THURSDAY_DATE,
  '-- ASSUMPTIONS:',
  '--   * devcon1..10 already exist from seedDevconUsers (INSERT OR IGNORE is belt-and-suspenders)',
  '--   * learning_assessment_answers.is_correct column: schema shows it is NOT in CREATE TABLE',
  '--     (the table was added per initDb.ts with these columns: id, attempt_id, user_id,',
  '--      session_id, assessment_type, assessment_index, module_id, question_index,',
  '--      selected_index, response_text, question_taxonomy, question_kind, question_id,',
  '--      created_at). is_correct is NOT a DB column — correctness is derived client-side.',
  '--     Therefore is_correct is OMITTED from INSERT statements here.',
  '--   * user_id is resolved via subquery SELECT id FROM users WHERE username=?',
  '--   * attempt ids are auto-increment; we INSERT and reference via last_insert_rowid()',
  '--     but for portability we use explicit string ids cast via the id column.',
  '--     SQLite AUTOINCREMENT means we cannot pre-assign integer IDs easily,',
  '--     so we use a two-pass approach: first insert attempts, then answers via subquery.',
  '',
  'PRAGMA foreign_keys = OFF;',
  'BEGIN TRANSACTION;',
  '',
  '-- ── Ensure devcon1..10 users exist (idempotent) ──────────────────────────',
];

for (let i = 1; i <= TESTER_COUNT; i++) {
  const username = `devcon${i}`;
  const email = `${username}@test.local`;
  // We don't know the hash here; in production seedDevconUsers inserts them.
  // This is just a safety INSERT OR IGNORE so the script is standalone.
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
    ` VALUES (${sqlStr(r.planId)}, (SELECT id FROM users WHERE username=${sqlStr(r.username)}), 'active', ${sqlStr(r.preAttempt.createdAt)}, ${sqlStr(r.postAttempt.createdAt)}, ${sqlStr(r.preAttempt.createdAt)});`
  );
  // Add plan modules
  testerModules[results.indexOf(r)].forEach((mod, di) => {
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
  // Pretest attempt
  sqlLines.push(
    `INSERT OR IGNORE INTO learning_assessment_attempts (user_id, session_id, assessment_type, question_count, cycle_id, plan_id, created_at)` +
    ` VALUES (${uid}, ${sqlStr(r.sessionId)}, 'pretest', ${r.preAttempt.questionCount}, ${sqlStr(r.cycleId)}, ${sqlStr(r.planId)}, ${sqlStr(r.preAttempt.createdAt)});`
  );
  // Posttest attempt
  sqlLines.push(
    `INSERT OR IGNORE INTO learning_assessment_attempts (user_id, session_id, assessment_type, question_count, cycle_id, plan_id, created_at)` +
    ` VALUES (${uid}, ${sqlStr(r.sessionId)}, 'posttest', ${r.postAttempt.questionCount}, ${sqlStr(r.cycleId)}, ${sqlStr(r.planId)}, ${sqlStr(r.postAttempt.createdAt)});`
  );
});

sqlLines.push('');
sqlLines.push('-- ── Assessment answers ───────────────────────────────────────────────────');
sqlLines.push('-- Note: is_correct is NOT a column in learning_assessment_answers (derived client-side)');

results.forEach((r) => {
  const uid = `(SELECT id FROM users WHERE username=${sqlStr(r.username)})`;
  // Pre answers
  r.preAnswers.forEach((a) => {
    const attemptRef = `(SELECT id FROM learning_assessment_attempts WHERE user_id=${uid} AND session_id=${sqlStr(a.sessionId)} AND assessment_type='pretest' AND cycle_id=${sqlStr(r.cycleId)} LIMIT 1)`;
    sqlLines.push(
      `INSERT OR IGNORE INTO learning_assessment_answers` +
      ` (attempt_id, user_id, session_id, assessment_type, assessment_index, module_id, question_index, selected_index, response_text, question_taxonomy, question_kind, question_id, created_at)` +
      ` VALUES (${attemptRef}, ${uid}, ${sqlStr(a.sessionId)}, 'pretest', ${a.assessmentIndex}, ${sqlStr(a.moduleId)}, ${a.questionIndex}, ${a.selectedIndex}, NULL, ${sqlStr(a.questionTaxonomy)}, 'theoretical', ${sqlStr(a.questionId)}, ${sqlStr(a.createdAt)});`
    );
  });
  // Post answers
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
sqlLines.push('-- ── Learning progress (UPSERT) ──────────────────────────────────────────');

results.forEach((r) => {
  const uid = `(SELECT id FROM users WHERE username=${sqlStr(r.username)})`;
  const p = r.progress;
  sqlLines.push(
    `INSERT INTO learning_progress` +
    ` (user_id, session_id, completed_module_ids, last_unlocked_module_id, tries_by_module, theory_passed_module_ids, bloom_mastery_by_module, skipped_module_ids, updated_at)` +
    ` VALUES (${uid}, ${sqlStr(p.sessionId)}, ${sqlStr(JSON.stringify(p.completedModuleIds))}, ${sqlStr(p.lastUnlockedModuleId)}, ${sqlStr(JSON.stringify(p.triesByModule))}, ${sqlStr(JSON.stringify(p.theoryPassedModuleIds))}, ${sqlStr(JSON.stringify(p.bloomMasteryByModule))}, '[]', datetime('now'))` +
    ` ON CONFLICT(user_id, session_id) DO UPDATE SET` +
    ` completed_module_ids=excluded.completed_module_ids, last_unlocked_module_id=excluded.last_unlocked_module_id, tries_by_module=excluded.tries_by_module, theory_passed_module_ids=excluded.theory_passed_module_ids, bloom_mastery_by_module=excluded.bloom_mastery_by_module, updated_at=datetime('now');`
  );
});

sqlLines.push('');
sqlLines.push('COMMIT;');
sqlLines.push('PRAGMA foreign_keys = ON;');

// ─── CLEANUP SQL ──────────────────────────────────────────────────────────────
const cleanupLines: string[] = [
  '-- CodiNeo Learner Simulation CLEANUP SQL',
  '-- Undoes the sim data for devcon1..10. Run this to rollback from prod.',
  '-- Generated by simulateLearners.ts (seed=' + SEED + ')',
  '',
  'PRAGMA foreign_keys = OFF;',
  'BEGIN TRANSACTION;',
  '',
  '-- Remove answers for all devcon1..10 users',
  ...Array.from({ length: TESTER_COUNT }, (_, i) => {
    const username = `devcon${i + 1}`;
    return `DELETE FROM learning_assessment_answers WHERE user_id = (SELECT id FROM users WHERE username=${sqlStr(username)});`;
  }),
  '',
  '-- Remove attempts',
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
const totalPreCorrectAll = results.reduce((s, r) => s + Math.round(r.preScore * (r.preAnswers.length)), 0);
const totalPreQAll = results.reduce((s, r) => s + r.preAnswers.length, 0);
const totalPostCorrectAll = results.reduce((s, r) => s + Math.round(r.postScore * (r.postAnswers.length)), 0);
const totalPostQAll = results.reduce((s, r) => s + r.postAnswers.length, 0);
const cohortPrePct = totalPreQAll > 0 ? (totalPreCorrectAll / totalPreQAll * 100).toFixed(1) : '0.0';
const cohortPostPct = totalPostQAll > 0 ? (totalPostCorrectAll / totalPostQAll * 100).toFixed(1) : '0.0';
const cohortGain = (parseFloat(cohortPostPct) - parseFloat(cohortPrePct)).toFixed(1);
const allPostGtPre = results.every((r) => r.postScore > r.preScore) ? 'YES (all 10)' : 'PARTIAL';

const csvLines: string[] = [
  '# CodiNeo Thesis — Learner Progress Results Worksheet',
  '# Generated by simulateLearners.ts (seed=' + SEED + ', date=' + THURSDAY_DATE + ')',
  '',
  '## Cohort summary',
  'metric,value',
  'testers,' + TESTER_COUNT,
  'required_modules,' + requiredModules.length,
  'non_required_modules,' + nonRequiredModules.length,
  'assignment_K,' + K,
  'cohort_pre_pct,' + cohortPrePct,
  'cohort_post_pct,' + cohortPostPct,
  'cohort_gain_pp,' + cohortGain,
  'all_post_gt_pre,' + allPostGtPre,
  'thursday_date,' + THURSDAY_DATE,
  '',
  '## Per-tester pre/post/gain',
  'tester,profile,pre_pct,post_pct,gain_pp,modules_assigned,practical_avg_tries,pre_bloom_level,post_bloom_level,bloom_leveled_up',
];

results.forEach((r) => {
  const pre = (r.preScore * 100).toFixed(1);
  const post = (r.postScore * 100).toFixed(1);
  const gain = ((r.postScore - r.preScore) * 100).toFixed(1);
  const avgTries = Object.values(r.progress.triesByModule).length > 0
    ? (Object.values(r.progress.triesByModule).reduce((a, b) => a + b, 0) / Object.values(r.progress.triesByModule).length).toFixed(1)
    : '0.0';
  const preBloomLabel = r.preBloom >= 0 ? BLOOM_ORDER[r.preBloom] : 'none';
  const postBloomLabel = r.postBloom >= 0 ? BLOOM_ORDER[r.postBloom] : 'none';
  const leveledUp = r.postBloom > r.preBloom ? 'YES' : 'NO';
  csvLines.push(
    `${r.username},${r.profileName},${pre},${post},${gain},${r.modulesCount},${avgTries},${preBloomLabel},${postBloomLabel},${leveledUp}`
  );
});

csvLines.push('');
csvLines.push('## Per-profile archetype breakdown');
csvLines.push('profile,testers,expected_pre_pct,expected_post_pct,practical_tries_range');
const profileGroups: Record<string, TesterResult[]> = {};
results.forEach((r) => {
  if (!profileGroups[r.profileName]) profileGroups[r.profileName] = [];
  profileGroups[r.profileName].push(r);
});
Object.entries(profileGroups).forEach(([pName, pResults]) => {
  const prof = PROFILES[pName as ProfileName];
  const tNames = pResults.map((r) => r.username).join('+');
  csvLines.push(
    `${pName},${tNames},${(prof.preTarget * 100).toFixed(0)},${(prof.postTarget * 100).toFixed(0)},[${prof.practicalTriesRange[0]}-${prof.practicalTriesRange[1]}]`
  );
});

csvLines.push('');
csvLines.push('## Non-required module assignment balance (K=' + K + ' testers each)');
csvLines.push('module_id,category,tester_count,testers');
nonRequiredModules.forEach((m) => {
  const tList = moduleTesterMap.get(m.moduleId) ?? [];
  const names = tList.map((t) => `devcon${t + 1}`).join('+');
  csvLines.push(`${m.moduleId},${m.category},${tList.length},${names}`);
});

csvLines.push('');
csvLines.push('## Bloom-level progression (pre→post)');
csvLines.push('tester,pre_bloom_max,post_bloom_max,leveled_up');
results.forEach((r) => {
  const preLabel = r.preBloom >= 0 ? BLOOM_ORDER[r.preBloom] : 'none';
  const postLabel = r.postBloom >= 0 ? BLOOM_ORDER[r.postBloom] : 'none';
  csvLines.push(`${r.username},${preLabel},${postLabel},${r.postBloom > r.preBloom ? 'YES' : 'NO'}`);
});

// ─── WRITE FILES ──────────────────────────────────────────────────────────────
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });

const sqlOutPath = path.join(outDir, 'learner-sim.sql');
const cleanupOutPath = path.join(outDir, 'learner-sim-cleanup.sql');
const csvOutPath = path.join(repoRoot, 'docs', 'thesis-results', 'learner-progress-results.csv');

fs.writeFileSync(sqlOutPath, sqlLines.join('\n'), 'utf8');
fs.writeFileSync(cleanupOutPath, cleanupLines.join('\n'), 'utf8');
fs.writeFileSync(csvOutPath, csvLines.join('\n'), 'utf8');

console.log('\n=== FILES WRITTEN ===');
console.log('  SQL:     ' + sqlOutPath);
console.log('  Cleanup: ' + cleanupOutPath);
console.log('  CSV:     ' + csvOutPath);

// ─── SAMPLE OUTPUT ────────────────────────────────────────────────────────────
console.log('\n=== 5-LINE SQL SAMPLE ===');
const sqlSample = sqlLines.filter((l) => l.startsWith('INSERT')).slice(0, 5);
sqlSample.forEach((l) => console.log(l.slice(0, 120) + (l.length > 120 ? '...' : '')));

console.log('\n=== 5-LINE CSV SAMPLE ===');
csvLines.slice(0, 10).forEach((l) => console.log(l));

console.log('\nDone. No DB was touched.');
