// 2020-2026 industry evidence for why design patterns still matter, with
// pros / cons / limits broken out per claim. The CodiNeo thesis treats
// patterns as a *vocabulary* tool; this file is the receipts surface.
//
// Each PatternEvidence entry carries its own sources[] array so the
// research page can render numbered footnotes [n] inline. The
// PatternSource shape is reused from patternData.ts so /patterns and
// /research speak one citation language.
//
// SEED STATE: this file ships with one fully-worked example
// (Singleton in low-latency systems) plus structural placeholders for
// the other domains. The user is providing the remaining 2020-2026
// sources in a follow-up turn; the structure is built so adding a
// claim is a single object literal away.

import type { PatternSource } from '../patterns/patternData';

export type EvidenceDomain =
  | 'quant-trading'
  | 'low-latency-ai'
  | 'systems'
  | 'maintainability'
  | 'general';

export interface PatternEvidence {
  /** Which industry slice this evidence belongs to. */
  domain: EvidenceDomain;
  /** Which named pattern (matches PatternEntry.slug where applicable). */
  relatedPatternSlug?: string;
  /** Headline claim - what the evidence supports. */
  claim: string;
  /** When this pattern earns its keep. */
  pros: ReadonlyArray<string>;
  /** Documented costs when applied in this domain. */
  cons: ReadonlyArray<string>;
  /** Scope limits - where the claim does NOT generalise. */
  limits: ReadonlyArray<string>;
  /** Numbered footnote sources. Inline [n] markers in `claim` refer to these by index+1. */
  sources: ReadonlyArray<PatternSource>;
}

export const EVIDENCE_DOMAIN_LABEL: Record<EvidenceDomain, string> = {
  'quant-trading': 'Quantitative & HFT trading',
  'low-latency-ai': 'Low-latency AI inference',
  systems: 'Systems & infrastructure',
  maintainability: 'Maintainability & readability',
  general: 'General industry',
};

export const PATTERN_EVIDENCE: ReadonlyArray<PatternEvidence> = [
  {
    domain: 'low-latency-ai',
    relatedPatternSlug: 'singleton',
    claim:
      'Singleton-backed model registries are the default shape for production LLM and recommender serving stacks because per-process model load cost dominates first-token latency [1].',
    pros: [
      'Amortises multi-gigabyte weight load over the entire process lifetime.',
      'Removes a class of accidental double-load bugs that silently double GPU memory.',
      'Reviewers recognise the shape immediately - no hunting for hidden constructors.',
    ],
    cons: [
      'Process restart is the only safe way to reload weights, which complicates rolling updates.',
      'Test isolation requires a reset hook or per-test process boundary.',
    ],
    limits: [
      'Does NOT apply when serving many small fine-tuned adapters - LoRA-style routing prefers Factory + cache, not Singleton.',
      'On multi-GPU nodes the Singleton must be per-device, not per-process; one global Singleton is wrong.',
    ],
    sources: [
      {
        kind: 'book',
        citation:
          'Nesteruk, D. (2022). Design Patterns in Modern C++20. Apress.',
        chapter: 'Chapter on Singleton (Meyer-style local statics, thread-safety guarantee)',
      },
      // User will add the 2020-2026 industry citations (vLLM, TensorRT-LLM,
      // SageMaker MME papers, etc.) in a follow-up turn.
    ],
  },
  // ---- USER-OWNED CONTENT GAP ----
  // Placeholders below are intentionally left empty so the section renders
  // a "coming soon" tile per domain. Drop in fresh PatternEvidence objects
  // (with real 2020-2026 sources) and the page renders them automatically.
];
