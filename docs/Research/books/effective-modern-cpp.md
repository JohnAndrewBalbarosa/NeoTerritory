---
title: "Effective Modern C++"
authors: "Scott Meyers"
year: 2014
url: "https://www.oreilly.com/library/view/effective-modern-c/9781491908419/"
kind: book
priority: secondary
---

## Summary

42 specific items on C++11 and C++14 best practice. Item-driven format. The canonical reference for smart pointers, move semantics, and the resource-management idioms that pattern detectors trip over if they are not designed around them.

## Why it matters for this thesis

Our `signature_categories` (per D38) include `ownership_handle` (`std::unique_ptr`, `std::shared_ptr`, `std::weak_ptr`) and `access_control_caching` (`std::mutex`, `std::lock_guard`, `std::call_once`). The decision to ship those as stdlib-symbol categories instead of bare keywords comes directly from Meyers' framing of these as the load-bearing idioms of modern C++.

## What we use from it

- Definition of correct smart-pointer use; informs our Singleton + Builder detectors.
- Definition of `= delete` and `= default` as deliberate language facts; backs the `destruction_signal` category in `lexeme_categories.json`.
- Item 1 ("understand template type deduction") is a reminder that our matcher cannot rely on `auto` to know a type — backs D24's "out of scope: no `auto x = make<Foo>()` type inference."
