---
title: "Lexical analysis as a foundation for source-code pattern detection"
authors: "Internal synthesis"
year: 2026
url: ""
kind: paper
priority: reference
---

## Summary

Lexical tagging — assigning each token a semantic category before any structural analysis — is older than most modern static-analysis tools and remains the most predictable pre-step for pattern matching. It separates "what does this token mean in the language" from "how does this construct fit the program," and that separation is what makes a JSON-driven catalog feasible.

## Why it matters for this thesis

NeoTerritory's algorithm starts at lexical tagging per D31 stage 1. Many pattern-detection tools skip this step and try to match patterns against the AST directly, which couples pattern definitions to AST shape. Our approach decouples them: tokens get categorised first, then the matcher operates on token-category windows per D38. This is what makes the pattern catalog extensible by JSON edit (per D9) without C++ recompilation.

## What we use from it

- The dichotomy "lexical category vs. AST shape" is the load-bearing distinction in D38's dictionary discipline rule.
- The decision to keep `lexeme_categories.json` separate from per-pattern JSONs (rather than inlining categories into each pattern) follows from the "categorise once, match many times" principle.
