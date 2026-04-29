/**
 * Pattern catalog schema (live form, as actually consumed today).
 *
 * Three layers:
 *   1. The C++ matcher reads `ordered_checks` and decides "is this class a candidate?"
 *   2. The C++ evidence extractor (D29) reads `evidence_rules` and emits a per-class
 *      `EvidenceSignals` map of yes/no/count answers.
 *   3. The TS ranker (`patternRankingService`) consumes `EvidenceSignals` and decides
 *      among candidate patterns. No regex over identifier text.
 *
 * See `docs/Codebase/DESIGN_DECISIONS.md` D29 for the full vocabulary of `EvidenceRuleKind`.
 */

export type LexicalTokenKind =
  | 'Keyword'
  | 'Identifier'
  | 'Operator'
  | 'Punctuation'
  | 'StringLiteral'
  | 'NumericLiteral'
  | 'Unknown';

export interface OrderedCheck {
  id: string;
  expected_kind?: LexicalTokenKind;
  expected_lexeme_any_of?: readonly string[];
  capture_as?: string;
  document_as?: string;
  one_of?: readonly OrderedCheck[];
}

export type EvidenceRuleKind =
  | 'token_pattern'
  | 'stl_call'
  | 'deleted_method'
  | 'defaulted_method'
  | 'static_local'
  | 'static_member'
  | 'pure_virtual_count'
  | 'non_static_data_member_count'
  | 'override_specifier_count'
  | 'final_specifier_on_class'
  | 'inheritance_present'
  | 'inherits_from_member_type'
  | 'non_self_class_member'
  | 'owning_member'
  | 'owning_member_of_self_type'
  | 'owning_member_of_base_type'
  | 'self_reference_return'
  | 'method_forwards_to_member'
  | 'null_check_then_construct_member'
  | 'control_flow_then_construction'
  | 'return_type_smart_ptr'
  | 'terminator_method_with_distinct_return'
  | 'friend_class';

export type EvidencePolarity = 'positive' | 'negative';

export interface EvidenceRule {
  id: string;
  kind: EvidenceRuleKind;
  polarity: EvidencePolarity;
  /** For `deleted_method` / `defaulted_method`. */
  method?: 'copy_ctor' | 'copy_assign' | 'move_ctor' | 'move_assign' | 'destructor';
  /** For `stl_call`. e.g. "std::make_unique" */
  callee?: string;
  /** For `stl_call` / `static_local` / `static_member`. May reference {class_name}. */
  type_arg?: string;
  of_type?: string;
  ptr_or_ref?: boolean;
  /** For `owning_member*` rules. */
  smart_ptr?: readonly ('unique_ptr' | 'shared_ptr' | 'weak_ptr')[];
  /** For `token_pattern`. The literal token sequence to find inside the class. */
  tokens?: readonly string[];
  /** For *_count rules, inclusive. */
  min?: number;
  max?: number;
}

export type EvidenceLanguage = 'cpp' | 'java' | 'python' | 'go' | 'typescript';

export interface PatternEntry {
  pattern_id: string;
  pattern_family: 'creational' | 'structural' | 'behavioural' | 'idiom';
  pattern_name: string;
  pattern_role?: 'interface' | 'concrete';
  enabled: boolean;
  /** Default 'cpp' for backward compatibility. Multi-language analyzers (D29) use this to dispatch. */
  language?: EvidenceLanguage;
  ordered_checks: readonly OrderedCheck[];
  evidence_rules?: readonly EvidenceRule[];
  /** Manual surface (criterion 2: works without AI). Static, version-controlled, never network. */
  manual_documentation_template?: string;
  manual_review_checklist?: readonly string[];
  manual_test_scaffold?: string;
}

export interface PatternCatalog {
  [patternId: string]: PatternEntry;
}

/** Output of the C++ evidence extractor (D29). Per-class, per-rule answers. */
export type EvidenceSignalValue = boolean | number;

export interface EvidenceSignals {
  [className: string]: {
    [ruleId: string]: EvidenceSignalValue;
  };
}
