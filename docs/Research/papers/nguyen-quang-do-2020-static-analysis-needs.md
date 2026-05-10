---
title: "Why Do Software Developers Use Static Analysis Tools? A User-Centered Study of Developer Needs and Motivations"
authors: "Lisa Nguyen Quang Do, James R. Wright, Karim Ali"
year: 2020
url: ""
kind: paper
priority: secondary
---

## Summary

IEEE Transactions on Software Engineering, 2020. User study examining what developers actually
want from static-analysis tooling. Finds that developers consistently rank "explanation of why
this finding matters" higher than "more findings" — i.e., precision and explanatory power beat
recall.

## Why it matters for this thesis

Cited in CodiNeo Chapter 1.1 (Background of the Study) and Chapter 2.4.2 (Limitations of
Static Analysis Tools). Justifies CodiNeo's choice to surface a small number of confidently
detected patterns with rich evidence + AI explanation, rather than a wall of low-confidence
findings the audience would have to triage themselves.

## What we use from it

- The principle "fewer findings, better explained" on `/mechanics` Stage 5 and on the studio's
  pattern card layout.
- The argument that the per-line AI documentation per D37 should target salient lines (≤8 per
  class), not exhaustive annotation.
