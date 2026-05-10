---
title: "A Survey of Parametric Static Analysis"
authors: "Jihee Park, Hyeonseung Lee, Sukyoung Ryu"
year: 2021
url: "https://doi.org/10.1145/3464457"
kind: paper
priority: secondary
---

## Summary

ACM Computing Surveys 54(7), Article 149. A survey of static-analysis techniques that take
analysis parameters as input — sensitivity, depth, abstraction level — and trade precision
against performance accordingly. Lays out where parametric tuning is load-bearing and where it
becomes a maintenance burden.

## Why it matters for this thesis

Cited in CodiNeo Chapter 1.1 and Chapter 2.4 (Limitations of Existing Static and AST-Based
Solutions). Justifies CodiNeo's choice to keep the C++ microservice deterministic (per D20) and
push all heuristic / parametric scoring into the backend ranking layer (per D23). The detector
itself never tunes; tuning is a separate, replaceable component.

## What we use from it

- The deterministic-detector / parametric-ranker split that lives in D20 + D23.
- The reminder that "more parameters" is not a synonym for "better tool"; the audience profile
  per D40 cannot be asked to tune analysis flags.
