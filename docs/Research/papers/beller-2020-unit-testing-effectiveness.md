---
title: "Developer testing in the IDE: Patterns, beliefs, and behavior"
authors: "Moritz Beller, Georgios Gousios, Annibale Panichella, Sebastian Proksch, Sven Amann, Andy Zaidman"
year: 2020
url: "https://doi.org/10.1109/TSE.2017.2776152"
kind: paper
priority: secondary
---

## Summary

IEEE Transactions on Software Engineering, 2020 reprint. Empirical study of how developers
actually write and run unit tests in their IDEs. Finds that unit tests are most effective
when they target nontrivial branching logic and are written before integration tests, not
after — but that developers underuse them and over-rely on manual testing in IDEs.

## Why it matters for this thesis

Per CodiNeo D44, unit tests are the "small, surgical" wing of the Trophy: only where the
function has nontrivial branching that integration tests cannot cheaply cover. This paper is
the empirical basis for that scoping.

## What we use from it

- The principle "unit tests for nontrivial branching only" — drives where we place unit
  scaffolds in the pattern catalog (D21, D38).
- The reminder that test scaffolds are valuable but unit-test fatigue is real; the studio
  generates them rather than asking users to.
- The observation that integration tests catch more cross-component bugs per minute,
  reinforcing the Trophy's central layer per D67.
