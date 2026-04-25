# parse_tree_symbols.hpp

- Source: Microservice/Modules/Header/SyntacticBrokenAST/ParseTree/parse_tree_symbols.hpp
- Kind: C++ header

## Story
### What Happens Here

This header defines the semantic symbol facade for the parse and analysis pipeline. It gives the rest of the codebase a small shared contract for class symbols, function symbols, and usage records.

### Why It Matters In The Flow

This file sits at the binding/resolution boundary. It should stay narrow and describe named semantic records, not every-node pointer indexing or hash-link plumbing.

### What To Watch While Reading

Track `ParseSymbol`, `ParseSymbolUsage`, `ParseTreeSymbolBuildOptions`, and `ParseTreeSymbolTables`. Those are the only contracts this facade should own.

## Program Flow
Detailed program flow is decoupled into future implementation units:

- [program_flow](./parse_tree_symbols/parse_tree_symbols_program_flow.hpp.md)

## Reading Map
Read this file as: the semantic symbol contracts and the bundled table types.

Where it sits in the run: this artifact participates in binding and resolution, according to the surrounding module or toolchain that loads it.

Names worth recognizing while reading: `ParseSymbol`, `ParseSymbolUsage`, `ParseTreeSymbolBuildOptions`, and `ParseTreeSymbolTables`.

It leans on nearby contracts or tools such as `parse_tree.hpp`, `cstddef`, `string`, `unordered_set`, and `vector`.

## Story Groups

### Claude Handoff Contract
These notes capture the split the implementation should follow.

- Keep this facade slim. It owns `ParseSymbol`, `ParseSymbolUsage`, `ParseTreeSymbolBuildOptions`, and `ParseTreeSymbolTables` only.
- `ParseSymbol` is a light semantic record with two subtree pointers, used for the primary head and the alternate or virtual head when that exists.
- `ParseSymbolUsage` is a usage-site record with one usage pointer plus the containing function hash.
- `ParseTreeSymbolTables` bundles three maps: class symbols, function symbols, and class usages.
- Class and function keys are derived with `std::hash` from normalized identity strings.
- Registry ownership for actual pointers lives elsewhere. This file does not own an all-nodes pointer index.
- Class declarations become candidates first and become final only after cross-reference and validation accept them.
- Class registry entries still point at subtree heads. Child hashes are path evidence, not ownership pointers.
- Function records need owner context and parameter signatures so overloads and repeated names stay distinct.
- `class_usage_table` records class usage facts and can reference binding evidence, but the durable variable->class map belongs in a separate Binding-phase file.
- `return_targets_known_class()` stays a narrow predicate that checks whether a return target resolves to a known class.

### Promises This File Makes
These entries tell the rest of the program what this file can provide.
- `ParseSymbol`: declare a shared type and expose the compile-time contract
- `ParseSymbolUsage`: declare a shared type and expose the compile-time contract
- `ParseTreeSymbolBuildOptions`: declare a shared type and expose the compile-time contract
- `ParseTreeSymbolTables`: declare a shared type and expose the compile-time contract

## Function Stories
Implementation details are decoupled into the relevant binding, resolution, and hash docs.

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.
