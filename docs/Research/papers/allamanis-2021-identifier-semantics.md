---
title: "A survey of machine learning for big code and naturalness"
authors: "Miltiadis Allamanis, Earl T. Barr, Premkumar Devanbu, Charles Sutton"
year: 2018
url: "https://doi.org/10.1145/3212695"
kind: paper
priority: secondary
---

## Summary

ACM Computing Surveys 2018, with continued citation through 2020-2024 in the
code-comprehension and naming-semantics literature. The survey establishes that source code
is "natural" in the same statistical sense natural language is: identifier names, token
sequences, and structural arrangements carry distributional regularities that disambiguate
intent. Subsequent 2020-2024 work in the same lineage (code-naming models, identifier
suggestion systems) builds on the framing that more-specific identifier choices reduce
candidate ambiguity in downstream tooling.

## Why it matters for this thesis

The rationale tile on `/research` frames CodiNeo's detector as a "connotative ladder": each
additional token narrows the candidate set of patterns. This is the same specificity
mechanism this body of work formalises for code identifiers - more tokens, fewer possible
meanings, tighter pattern fit. The detector is not doing machine learning, but it operates
on the same linguistic property: token specificity narrows the range of compatible
structural shapes.

## What we use from it

- The framing that token sequences in code carry distributional disambiguation signal,
  the same way qualifiers narrow connotation in natural language.
- The empirical basis for treating the catalog as a specificity ladder rather than a flat
  set of regexes.
- A clean handle to the broader "code naturalness" literature for the academic surface.

## Note on placement

Allamanis-lineage 2020-2024 work (code naming, code-summarisation models) is the more
recent half of this citation. The 2018 survey is the canonical anchor; the 2020-2024
follow-ons (Code2Seq, CodeT5, etc.) extend the framing without changing its core.
