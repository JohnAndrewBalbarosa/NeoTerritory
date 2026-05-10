---
title: "When and what to automate in continuous integration: A multi-vocal literature review"
authors: "Vahid Garousi, Michael Felderer, Marcos Hernandes"
year: 2021
url: "https://doi.org/10.1016/j.infsof.2020.106473"
kind: paper
priority: secondary
---

## Summary

Information and Software Technology Journal, 2021. Multi-vocal literature review of when and
what to automate inside CI pipelines. Synthesises peer-reviewed papers, industry blog posts,
and technical reports on integration-test placement, suite size, and execution cadence.
Argues that integration tests provide the highest defect-detection rate per minute of CI
runtime for service-oriented applications.

## Why it matters for this thesis

Per CodiNeo D44 + D67, the bulk of testing effort lands at the integration layer because
NeoTerritory is a multi-process pipeline (frontend ↔ backend ↔ C++ microservice ↔ AI).
Garousi et al. provide the empirical backing: integration testing IS where the bugs live for
this shape of system.

## What we use from it

- The "highest defect-detection rate per CI minute" framing on the Trophy banner in the Tests
  tab.
- The argument that integration tests must exercise the real seams (real microservice binary,
  real backend route) rather than mocking them.
- Guidance on CI execution cadence: integration suites run on every PR; flaky specs go to
  quarantine rather than retry, per D44.
