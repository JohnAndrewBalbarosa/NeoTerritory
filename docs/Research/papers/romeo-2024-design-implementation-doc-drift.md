---
title: "Capturing and Understanding the Drift Between Design, Implementation, and Documentation"
authors: "Jacopo Romeo, Marco Raglianti, Csaba Nagy, Michele Lanza"
year: 2024
url: "https://doi.org/10.1145/3643916.3644399"
kind: paper
priority: primary
---

## Summary

ICPC 2024. Empirical study of how design intent, source-code implementation, and developer
documentation drift apart over a project's lifetime. Argues that drift between any two of the
three causes measurable degradation in code-comprehension speed, and that the third (often
documentation) is usually the one the team allows to fall behind.

## Why it matters for this thesis

Cited in CodiNeo Chapter 1.1 (Background of the Study) and Chapter 2 (Review of Related
Literature). It's the paper that justifies the entire premise: "documentation produced after
the fact, manually, becomes useless as soon as the implementation moves on." CodiNeo's
documentation-oriented output is generated FROM the implementation's structural facts so the
two can never drift independently.

## What we use from it

- The "drift" framing on `/about` (research question, gap analysis).
- The argument for AI documentation that reads structural facts rather than free-form prose:
  if the structural facts are the ground truth, the docs cannot drift past them without an
  explicit re-run.
- The reminder that fast detection alone is not the goal — documentation that stays faithful
  to implementation is the goal.
