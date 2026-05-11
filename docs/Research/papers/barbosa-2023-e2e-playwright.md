---
title: "End-to-end testing of modern web applications: A comparative study of Playwright, Cypress, and Selenium"
authors: "Pedro Barbosa, Tiago Boldt Sousa, Filipe Figueiredo Correia"
year: 2023
url: "https://doi.org/10.1145/3593434.3593466"
kind: paper
priority: secondary
---

## Summary

EASE 2023. Compares Playwright, Cypress, and Selenium for E2E testing on modern SPA
applications. Finds Playwright offers the best browser-coverage / stability / flake-rate
tradeoff for headless CI runs, especially for multi-process applications where the frontend
talks to a backend and asynchronous services.

## Why it matters for this thesis

Per CodiNeo D68, the GitHub Actions workflow (`.github/workflows/playwright-e2e.yml`) uses
Playwright to drive the studio from sign-in through analyze to tests on every push. This
paper is the empirical basis for choosing Playwright over Cypress or Selenium.

## What we use from it

- The choice of Playwright as the E2E framework.
- The convention of `trace: 'retain-on-failure'` + screenshot + video for CI debugging (used
  in `Codebase/Frontend/playwright.config.ts`).
- The recommendation to quarantine flaky specs (1 retry max in CI; the spec is removed if it
  flakes repeatedly) per D44.
