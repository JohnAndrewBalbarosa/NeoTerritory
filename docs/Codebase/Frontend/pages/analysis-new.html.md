# analysis-new.html

- Source: Frontend/pages/analysis-new.html
- Kind: HTML view

## Story
### What Happens Here

This page fragment implements one route-sized screen inside the frontend shell. The router fetches it on demand, injects it into the main content container, and then lets the page-specific scripts bring it to life.

### Why It Matters In The Flow

Loaded after the router selects a route and injects the fragment into the shell document.

### What To Watch While Reading

Provides a page fragment that the client-side router injects into the main content area. The main surface area is easiest to track through symbols such as #ready-card, #progress-card, #prog-pct-1, and #prog-bar-1. It collaborates directly with #/dashboard.

## Program Flow
This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.
```mermaid
flowchart TD
    Start["Begin local flow"]
    N0["Render #ready-card"]
    N1["Render #progress-card"]
    N2["Render #prog-pct-1"]
    N3["Render #prog-bar-1"]
    N4["Render #prog-pct-2"]
    N5["Render #prog-bar-2"]
    End["Return from local flow"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> End
```

## Reading Map
Read this file as: Provides a page fragment that the client-side router injects into the main content area.

Where it sits in the run: Loaded after the router selects a route and injects the fragment into the shell document.

Names worth recognizing while reading: #ready-card, #progress-card, #prog-pct-1, #prog-bar-1, #prog-pct-2, and #prog-bar-2.

It leans on nearby contracts or tools such as #/dashboard.

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.

