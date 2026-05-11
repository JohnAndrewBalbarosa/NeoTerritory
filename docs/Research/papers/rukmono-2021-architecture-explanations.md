---
title: "From Expert to Novice: An Empirical Study on Software Architecture Explanations"
authors: "Sebastian A. Rukmono, Florin Zamfir, Lina Ochoa, Michel R. V. Chaudron"
year: 2021
url: "https://arxiv.org/abs/2503.08628"
kind: paper
priority: primary
---

## Summary

ICPC 2021 (extended preprint 2025). Empirical study of how senior developers explain software
architecture to novices, what they emphasise, what they skip, and which abstractions they reach
for. Finds that experts disproportionately rely on pattern names ("this is a Strategy pattern
with a Factory wrapper") because the names compress an entire structural argument into one
phrase a novice can look up.

## Why it matters for this thesis

Cited in CodiNeo Chapter 1.1 (Background of the Study) and Chapter 2.1 (Code Understanding in
Collaborative and Learning-Oriented Development). It's the empirical backing for the claim
that "pattern literacy is what experts actually use to onboard juniors" — which is exactly
what CodiNeo automates by detecting and naming patterns instead of leaving the novice to
reverse-engineer the architecture from raw code.

## What we use from it

- The "shared vocabulary" framing on `/why` — pattern names ARE the vocabulary experts use to
  explain architecture, and CodiNeo gives that vocabulary to the novice automatically.
- The argument that explanations need to compress structure, not expand it. CodiNeo's per-line
  AI commentary deliberately stays terse (≤8 salient lines per class per D37) instead of
  exhaustive annotation.
