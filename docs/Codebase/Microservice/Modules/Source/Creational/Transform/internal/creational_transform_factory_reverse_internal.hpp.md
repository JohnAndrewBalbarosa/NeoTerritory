# creational_transform_factory_reverse_internal.hpp

- Source: Microservice/Modules/Source/Creational/Transform/internal/creational_transform_factory_reverse_internal.hpp
- Kind: C++ header
- Lines: 182

## Story
### What Happens Here

This source file belongs to the older creational transform support path. It is useful for understanding previous rewrite behavior, but the current analyzer runtime focuses on tagging evidence instead of generating replacement code. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or documentation tags.

### Why It Matters In The Flow

Runs after the generic parse tree exists so creational detection can label the structure.

### What To Watch While Reading

Implements creational transform dispatch, evidence rendering, and rewrite helpers. The main surface area is easiest to track through symbols such as SourceSpan, AllocationExpression, FactoryHashLedgerEntry, and FactoryCreateMapping. It collaborates directly with cstddef, cstdint, string, and unordered_map.

## Program Flow
Detailed program flow is decoupled into future implementation units:

- [program_flow_01](./creational_transform_factory_reverse_internal/creational_transform_factory_reverse_internal_program_flow_01.cpp.md)
- [program_flow_02](./creational_transform_factory_reverse_internal/creational_transform_factory_reverse_internal_program_flow_02.cpp.md)
## Reading Map
Read this file as: Implements creational transform dispatch, evidence rendering, and rewrite helpers.

Where it sits in the run: Runs after the generic parse tree exists so creational detection can label the structure.

Names worth recognizing while reading: SourceSpan, AllocationExpression, FactoryHashLedgerEntry, FactoryCreateMapping, FactoryClassModel, and FactoryRewriteStats.

It leans on nearby contracts or tools such as cstddef, cstdint, string, unordered_map, unordered_set, and vector.

## Story Groups

### Promises This File Makes
These entries tell the rest of the program what this file can provide.
- SourceSpan (line 13): Declare a shared type and expose the compile-time contract
- AllocationExpression (line 26): Declare a shared type and expose the compile-time contract
- FactoryHashLedgerEntry (line 33): Declare a shared type and expose the compile-time contract
- FactoryCreateMapping (line 40): Declare a shared type and expose the compile-time contract
- FactoryClassModel (line 47): Declare a shared type and expose the compile-time contract
- FactoryRewriteStats (line 54): Declare a shared type and expose the compile-time contract
- StatementSlice (line 70): Declare a shared type and expose the compile-time contract
- VariableDeclarationSite (line 76): Declare a shared type and expose the compile-time contract
- CallsiteDeclaration (line 82): Declare a shared type and expose the compile-time contract
- escape_regex_literal() (line 99): Declare a callable contract and let implementation files define the runtime body
- find_matching_paren() (line 101): Declare a callable contract and let implementation files define the runtime body
- is_supported_literal() (line 102): Declare a callable contract and let implementation files define the runtime body
- normalize_literal() (line 103): Declare a callable contract and let implementation files define the runtime body
- first_return_expression() (line 104): Declare a callable contract and let implementation files define the runtime body
- collapse_ascii_whitespace() (line 105): Declare a callable contract and let implementation files define the runtime body
- make_fnv1a64_hash_id() (line 106): Declare a callable contract and let implementation files define the runtime body
- make_vital_part_hash_id() (line 107): Declare a callable contract and let implementation files define the runtime body
- build_hash_ledger_entry() (line 108): Declare a callable contract and let implementation files define the runtime body
- parse_parameter_name_from_signature() (line 109): Declare a callable contract and let implementation files define the runtime body
- literal_from_condition() (line 112): Declare a callable contract and let implementation files define the runtime body
- statement_after_condition() (line 116): Declare a callable contract and let implementation files define the runtime body
- collect_if_branch_mapping() (line 117): Declare a callable contract and let implementation files define the runtime body
- collect_switch_branch_mapping() (line 121): Declare a callable contract and let implementation files define the runtime body
- collect_top_level_default_return() (line 125): Declare a callable contract and let implementation files define the runtime body
- parse_create_mapping_from_class_body() (line 128): Declare a callable contract and let implementation files define the runtime body
- collect_factory_classes() (line 131): Declare a callable contract and let implementation files define the runtime body
- parse_allocation_expression() (line 132): Declare a callable contract and let implementation files define the runtime body
- is_auto_declaration_type() (line 135): Declare a callable contract and let implementation files define the runtime body
- rewrite_declaration_type() (line 136): Declare a callable contract and let implementation files define the runtime body
- resolve_variable_declaration_site() (line 145): Declare a callable contract and let implementation files define the runtime body
- parse_factory_callsite_line() (line 150): Declare a callable contract and let implementation files define the runtime body
- build_rewritten_callsite_line() (line 155): Declare a callable contract and let implementation files define the runtime body
- build_rewritten_assignment_line() (line 159): Declare a callable contract and let implementation files define the runtime body
- rewrite_variable_declaration_line() (line 162): Declare a callable contract and let implementation files define the runtime body
- remove_unused_factory_instance_declaration() (line 166): Declare a callable contract and let implementation files define the runtime body
- locate_class_span_by_name() (line 170): Declare a callable contract and let implementation files define the runtime body
- has_class_reference_outside_span() (line 174): Declare a callable contract and let implementation files define the runtime body
- erase_span_with_trailing_newlines() (line 178): Declare a callable contract and let implementation files define the runtime body

## Function Stories
Function-level logic is decoupled into future implementation units:

- [sourcespan](./creational_transform_factory_reverse_internal/functions/sourcespan.cpp.md)
- [allocationexpression](./creational_transform_factory_reverse_internal/functions/allocationexpression.cpp.md)
- [factoryhashledgerentry](./creational_transform_factory_reverse_internal/functions/factoryhashledgerentry.cpp.md)
- [factorycreatemapping](./creational_transform_factory_reverse_internal/functions/factorycreatemapping.cpp.md)
- [factoryclassmodel](./creational_transform_factory_reverse_internal/functions/factoryclassmodel.cpp.md)
- [factoryrewritestats](./creational_transform_factory_reverse_internal/functions/factoryrewritestats.cpp.md)
- [statementslice](./creational_transform_factory_reverse_internal/functions/statementslice.cpp.md)
- [variabledeclarationsite](./creational_transform_factory_reverse_internal/functions/variabledeclarationsite.cpp.md)
- [callsitedeclaration](./creational_transform_factory_reverse_internal/functions/callsitedeclaration.cpp.md)
- [escape_regex_literal](./creational_transform_factory_reverse_internal/functions/escape_regex_literal.cpp.md)
- [find_matching_paren](./creational_transform_factory_reverse_internal/functions/find_matching_paren.cpp.md)
- [is_supported_literal](./creational_transform_factory_reverse_internal/functions/is_supported_literal.cpp.md)
- [normalize_literal](./creational_transform_factory_reverse_internal/functions/normalize_literal.cpp.md)
- [first_return_expression](./creational_transform_factory_reverse_internal/functions/first_return_expression.cpp.md)
- [collapse_ascii_whitespace](./creational_transform_factory_reverse_internal/functions/collapse_ascii_whitespace.cpp.md)
- [make_fnv1a64_hash_id](./creational_transform_factory_reverse_internal/functions/make_fnv1a64_hash_id.cpp.md)
- [make_vital_part_hash_id](./creational_transform_factory_reverse_internal/functions/make_vital_part_hash_id.cpp.md)
- [build_hash_ledger_entry](./creational_transform_factory_reverse_internal/functions/build_hash_ledger_entry.cpp.md)
- [parse_parameter_name_from_signature](./creational_transform_factory_reverse_internal/functions/parse_parameter_name_from_signature.cpp.md)
- [literal_from_condition](./creational_transform_factory_reverse_internal/functions/literal_from_condition.cpp.md)
- [statement_after_condition](./creational_transform_factory_reverse_internal/functions/statement_after_condition.cpp.md)
- [collect_if_branch_mapping](./creational_transform_factory_reverse_internal/functions/collect_if_branch_mapping.cpp.md)
- [collect_switch_branch_mapping](./creational_transform_factory_reverse_internal/functions/collect_switch_branch_mapping.cpp.md)
- [collect_top_level_default_return](./creational_transform_factory_reverse_internal/functions/collect_top_level_default_return.cpp.md)
- [parse_create_mapping_from_class_body](./creational_transform_factory_reverse_internal/functions/parse_create_mapping_from_class_body.cpp.md)
- [collect_factory_classes](./creational_transform_factory_reverse_internal/functions/collect_factory_classes.cpp.md)
- [parse_allocation_expression](./creational_transform_factory_reverse_internal/functions/parse_allocation_expression.cpp.md)
- [is_auto_declaration_type](./creational_transform_factory_reverse_internal/functions/is_auto_declaration_type.cpp.md)
- [rewrite_declaration_type](./creational_transform_factory_reverse_internal/functions/rewrite_declaration_type.cpp.md)
- [resolve_variable_declaration_site](./creational_transform_factory_reverse_internal/functions/resolve_variable_declaration_site.cpp.md)
- [parse_factory_callsite_line](./creational_transform_factory_reverse_internal/functions/parse_factory_callsite_line.cpp.md)
- [build_rewritten_callsite_line](./creational_transform_factory_reverse_internal/functions/build_rewritten_callsite_line.cpp.md)
- [build_rewritten_assignment_line](./creational_transform_factory_reverse_internal/functions/build_rewritten_assignment_line.cpp.md)
- [rewrite_variable_declaration_line](./creational_transform_factory_reverse_internal/functions/rewrite_variable_declaration_line.cpp.md)
- [remove_unused_factory_instance_declaration](./creational_transform_factory_reverse_internal/functions/remove_unused_factory_instance_declaration.cpp.md)
- [locate_class_span_by_name](./creational_transform_factory_reverse_internal/functions/locate_class_span_by_name.cpp.md)
- [has_class_reference_outside_span](./creational_transform_factory_reverse_internal/functions/has_class_reference_outside_span.cpp.md)
- [erase_span_with_trailing_newlines](./creational_transform_factory_reverse_internal/functions/erase_span_with_trailing_newlines.cpp.md)
## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.