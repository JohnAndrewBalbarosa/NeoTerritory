---
title: "Dive Into Design Patterns"
authors: "Alexander Shvets"
year: 2024
url: "https://refactoring.guru/design-patterns/book"
kind: book
priority: primary
---

## Summary

Continuously updated catalogue of 22 GoF patterns plus extras and SOLID principles. Visual, beginner-to-intermediate friendly. Widely cited in Filipino devcon and student communities; the matching free site at refactoring.guru is the canonical online reference for patterns most undergraduates encounter.

## Why it matters for this thesis

NeoTerritory's pattern catalog (`Codebase/Microservice/pattern_catalog/`) follows the structural definitions in this book. When we ship a new pattern detector, the JSON shape and the user-facing description on `/patterns/<slug>` are sourced from this book's chapter on that pattern. Choosing this over GoF (1994) or Head First (2nd ed 2020) was deliberate: it is the most current and the most aligned with the audience profile defined in D40.

## What we use from it

- The canonical catalogue order: Creational → Structural → Behavioural.
- Per-pattern: Intent, Problem, Solution, Structure, Pseudocode.
- The "applicability" sections inform our `signature_categories` and `negative_signature_categories` choices per D38.
- Refactoring.Guru's pattern slugs (e.g. `factory-method`, `abstract-factory`) are reused verbatim as our `/patterns/<slug>` URLs for SEO and linking from external study materials.
