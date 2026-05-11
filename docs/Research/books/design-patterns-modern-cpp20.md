---
title: "Design Patterns in Modern C++20: Reusable Approaches for Object-Oriented Software Design"
authors: "Dmitri Nesteruk"
year: 2022
url: "https://doi.org/10.1007/978-1-4842-7295-4"
kind: book
priority: primary
---

## Summary

Apress, 2022. The reference book the CodiNeo thesis cites for design-pattern theory in modern
C++ (Nesteruk, 2022). Covers all twenty-three GoF patterns plus modern-C++ idioms, written
against C++20 with smart pointers, ranges, concepts, and modules — i.e., the C++ that AI
codegen actually produces today, not the late-1990s C++ of the original GoF book.

## Why it matters for this thesis

Cited directly in CodiNeo's Background of the Study (Chapter 1) and Review of Related
Literature (Chapter 2). The structural definitions the C++ microservice's pattern catalog
points to — Singleton, Factory, Builder, Adapter, Strategy, etc. — match Nesteruk's modern-C++
formulation, not GoF's circa-1994 formulation. Choosing a 2022 source over the original GoF
book was deliberate: the audience profile (per D40) ships C++20-flavoured code via AI, and the
detector must recognise the modern smart-pointer, move-semantics, RAII implementations of these
patterns.

## What we use from it

- The canonical catalogue order: Creational → Structural → Behavioural, with C++20 idioms
  treated as first-class peers rather than appendices.
- Per-pattern: intent, motivation, modern-C++ implementation sketch, smart-pointer ownership
  guidance.
- The "modern" stdlib API surface (`std::unique_ptr`, `std::shared_ptr`, `std::call_once`,
  `std::lock_guard`, etc.) backs the stdlib-symbol entries in `lexeme_categories.json` per D38.
- Pattern-specific code samples in `/patterns/<slug>` and the Sample Picker (load-sample modal)
  are paraphrased from this book's idiomatic implementations and cited as such on the page.
