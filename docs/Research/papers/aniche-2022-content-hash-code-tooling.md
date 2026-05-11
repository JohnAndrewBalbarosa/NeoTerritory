---
title: "Content-addressed identifiers and reproducible caching in code-analysis tooling"
authors: "Citation pending — placeholder for a locked 2020-2026 reference"
year: 2022
url: ""
kind: paper
priority: reference
---

## Summary

**Citation pending.** This entry is a placeholder for a locked 2020-2026 reference covering
the use of content-addressed (typically SHA-256) identifiers in code-analysis caching and
build-system tooling. The pattern is well-documented in production systems — Bazel's
content-addressable cache, Nix store paths, the Git object model — but a single canonical
2020-2026 academic citation has not yet been locked in for the bibliography. The tile on
`/research` referencing this entry surfaces a visible "citation pending" badge so readers
know the claim is grounded in industry practice rather than a peer-reviewed paper at this
exact frontmatter.

## Why it matters for this thesis

CodiNeo's algorithm hashes the virtual structural copy so that re-analysing the same code
becomes a cache hit. This is the same content-addressed pattern that Git, Bazel, and Nix
already rely on. Locking a peer-reviewed citation here strengthens the academic surface; in
the meantime the tile is transparent about the gap.

## What we use from it

- The content-addressed identity model: identical content produces an identical hash
  regardless of location or filename.
- The reproducibility-via-hash guarantee: any two analyses with the same hash MUST have
  produced the same verdict.
- The cache-by-hash property: re-analysing unchanged code is O(1) lookup rather than O(n)
  re-parse.
