---
title: "Fine-grained and accurate source code differencing"
authors: "Jean-Rémy Falleri, Floréal Morandat, Xavier Blanc, Matias Martinez, Martin Monperrus"
year: 2014
url: "https://doi.org/10.1145/2642937.2642982"
kind: paper
priority: secondary
---

## Summary

ASE 2014, with continued tooling and evaluation work through 2020-2024 (GumTree 3.x, the
GumTree-Spoon AST diff integration, and downstream evaluations in software-evolution
studies). GumTree introduces a fine-grained tree-edit-distance approach to source-code
differencing: instead of line-level diffs, it operates on the AST and reports node-level
insertions, deletions, moves, and updates. The post-2020 work in the GumTree lineage focuses
on noise reduction (collapsing trivial renames, ignoring whitespace) and on stable matchings
across small structural edits.

## Why it matters for this thesis

CodiNeo's algorithm is titled "Hash-Based Virtual Structural Copy" - the structural copy is
exactly the abstraction GumTree popularised. The lesson is that comparing programs at the
literal-text level conflates formatting noise with real design changes, while comparing at
the structural-tree level isolates the design facts. CodiNeo extends the idea by hashing the
virtual structural tree so identical structures collapse to identical hashes regardless of
text-level decoration.

## What we use from it

- The principle that structural views, not literal source, are the right comparison surface
  for pattern detection.
- Confirmation that ignoring whitespace and identifier rename noise is the standard practice,
  not a CodiNeo invention.
- A baseline framing for "two files are structurally identical when their virtual trees
  match" - the property the content-addressed hash makes O(1) to check.
