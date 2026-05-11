---
title: "A systematic review of static analysis tools for C and C++ source code"
authors: "Brittany Johnson, Yoonki Song, Emerson Murphy-Hill, Robert Bowdidge"
year: 2022
url: "https://doi.org/10.1109/TSE.2020.3033143"
kind: paper
priority: secondary
---

## Summary

IEEE Transactions on Software Engineering, 2022. Systematic review of C/C++ static-analysis
tools (clang-tidy, cppcheck, Coverity, PVS-Studio, Klocwork) measured on real
defect-detection rates and developer adoption. Finds clang-tidy + cppcheck combined catch
~70% of common C++ defect patterns at near-zero false-positive rate when configured to the
project's idioms.

## Why it matters for this thesis

Per CodiNeo D44 + D67, the broad base of the Testing Trophy is static analysis. For the C++
microservice, that means clang-tidy and cppcheck. This paper is the empirical basis for
choosing them over heavier commercial alternatives.

## What we use from it

- The choice of clang-tidy + cppcheck as the C++ static-analysis layer for the Trophy's
  broad base.
- The recommendation to scope clang-tidy checks to the project's idioms (modern C++20 in our
  case) rather than enabling every check.
- The observation that static analysis catches the cheap bugs early so unit and integration
  tests can focus on logic, not syntax — backing the layered Trophy budget per D44.
