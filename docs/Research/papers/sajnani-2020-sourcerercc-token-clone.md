---
title: "SourcererCC: Scaling code clone detection to big-code"
authors: "Hitesh Sajnani, Vaibhav Saini, Jeffrey Svajlenko, Chanchal K. Roy, Cristina V. Lopes"
year: 2016
url: "https://doi.org/10.1145/2884781.2884877"
kind: paper
priority: secondary
---

## Summary

ICSE 2016 (with continued evaluation work through 2020-2024). SourcererCC is a token-based
near-miss code clone detector that scales to hundreds of millions of lines of code. Its core
insight is that lexical token bags - not full ASTs - are sufficient to detect Type-1, Type-2,
and many Type-3 clones, and that ordering plus filtering on token overlap is cheap enough to
brute-force at corpus scale. Later studies (BigCloneBench evaluations 2020-2024) keep
SourcererCC as a baseline because its token-bag formulation remains competitive with
heavier AST-diff approaches on recall.

## Why it matters for this thesis

CodiNeo's detector is not a clone detector, but its first stage is token-based: the C++
microservice tokenises the source and the pattern catalog matches token combinations against
expected pattern shapes. The lesson SourcererCC formalises - that token-level features carry
enough structural signal to make the first cut, and heavier structural analysis only needs to
run on what survives the token gate - is the architecture CodiNeo applies to pattern
detection.

## What we use from it

- The principle that token-bag matching is cheap and high-recall enough to be the front
  layer of a multi-stage detector.
- The framing that each added token narrows the candidate set - directly informs the
  "connotative ladder" framing on the rationale tile.
- BigCloneBench-derived expectations for false-positive control at scale.
