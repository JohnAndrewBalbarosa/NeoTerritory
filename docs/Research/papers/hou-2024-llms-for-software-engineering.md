---
title: "Large Language Models for Software Engineering: A Systematic Literature Review"
authors: "Xinyi Hou, Yanjie Zhao, Yue Liu, Zhou Yang, Kailong Wang, Li Li, Xiapu Luo, David Lo, John Grundy, Haoyu Wang"
year: 2024
url: "https://doi.org/10.1145/3695988"
kind: paper
priority: secondary
---

## Summary

ACM Transactions on Software Engineering and Methodology 33(8), Article 220. Systematic
literature review covering ~400 papers on LLMs applied to software engineering tasks: code
generation, code review, documentation, repair, testing. Maps the field's current capabilities
and persistent failure modes.

## Why it matters for this thesis

Cited in CodiNeo Chapter 2.4.1 (Limitations of AI-Driven Coding Assistants). Documents the
recurring problem CodiNeo is built to mitigate: LLMs produce different verdicts on the same
file across runs unless they are given a structural anchor. The paper's recommendation — pair
LLMs with deterministic structural analysis — matches the C++-microservice + AI-doc-layer
split in CodiNeo.

## What we use from it

- The framing on `/about` ("Pure LLM passes over source produce different verdicts on the same
  file across runs; the structural ground truth keeps shifting").
- The justification for the chunking + fallback ladder in D37 (5 chunks, 30/60s timeouts,
  static fallback): non-determinism is not eliminated by promise, it is contained by design.
