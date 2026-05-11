---
title: "The Testing Trophy and Testing Classifications"
authors: "Kent C. Dodds"
year: 2021
url: "https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications"
kind: article
priority: primary
---

## Summary

The canonical post from Kent C. Dodds (updated 2021) introducing the Testing Trophy as a
deliberate inversion of Mike Cohn's test pyramid. Argues that the centre of testing effort
should be integration tests, with static analysis as the broad base, E2E at the tip, and
unit tests on the side wing. Targets modern multi-process applications where bugs live at
the seams between modules.

## Why it matters for this thesis

Per CodiNeo D44 + D67, the testing strategy of NeoTerritory follows the Trophy. This is the
foundational source; every other entry in the testing-strategy bibliography refers back to
this taxonomy.

## What we use from it

- The four-layer model (static analysis / unit / integration / E2E) that drives the studio's
  Tests tab phases per D67.
- The justification for putting integration in the centre: it is the most-test-bang-for-buck
  layer for multi-process apps like NeoTerritory.
- The convention of labelling phases "planned" vs "live" so the strategy is visible before
  every layer is wired.
