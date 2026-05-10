---
title: "Modern C++ Design: Generic Programming and Design Patterns Applied"
authors: "Andrei Alexandrescu"
year: 2001
url: "https://www.informit.com/store/modern-c-plus-plus-design-generic-programming-and-design-9780201704310"
kind: book
priority: secondary
---

## Summary

The foundational text on policy-based design and template metaprogramming for design patterns in C++. Predates C++11 but the ideas (CRTP, type lists, policy-based singletons) remain load-bearing in modern C++ codebases.

## Why it matters for this thesis

Our pattern catalog includes idioms like CRTP and PIMPL that are not GoF but are everywhere in idiomatic C++. Alexandrescu's framing — "this is what a pattern looks like when you take generics seriously" — informs how we describe Idiom-family patterns in `/patterns/<slug>` for the Idioms category.

## What we use from it

- The CRTP definition we use in our pattern catalog (`pattern_catalog/idiom/...`).
- The vocabulary distinction between "GoF pattern" and "C++ idiom" — important for the audience profile, who often confuse the two.
- The reminder that patterns in C++ are not always inheritance-driven. Our matcher's signature categories per D38 are designed to reflect this.
