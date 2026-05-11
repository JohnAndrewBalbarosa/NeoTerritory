---
title: "Code longevity in embedded firmware"
authors: "Internal compilation"
year: 2026
url: ""
kind: article
priority: reference
---

## Summary

Embedded firmware ships and lives. A washing-machine controller written in 2014 is still in customers' homes in 2026. The next person reading the source is rarely the original author and often is not even on the same team. Pattern names and idiomatic structure are the only handle they have on intent.

## Why it matters for this thesis

Backs the embedded-programmer hook on `/why`. The argument: AI-written firmware that compiles and ships is not enough. The next maintainer needs a vocabulary to navigate the code, and pattern names are that vocabulary.

## What we use from it

- One-sentence framing on `/why` panel 3.
- Reinforces the audience-profile bias toward reusable shared vocabulary over project-specific naming. Backs the lexeme-dictionary discipline in D38 (no project-specific identifiers in `lexeme_categories.json`).
