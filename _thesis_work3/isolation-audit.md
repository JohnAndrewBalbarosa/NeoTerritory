# Thesis isolation audit + ready-to-paste rewrites

Working note for `FINAL THESIS 3 PAPER.docx`. Apply each block in Word in the order listed. Section numbers reference the current paper's TOC.

> **Isolation rule (user choice):** Strict content, allow cross-reference pointers. Each idea owns ONE section. Other sections that need to reference it say `(see Section N.M)` instead of repeating the content.

---

## A. Section 1.5 — Statement of the Problem (rewrite all 5 items)

**Replace each numbered SOP with:**

1. How can the proposed system deliver design-pattern learning modules that pair conceptual instruction with deterministic, structure-level analysis of the user's own C++ source code?

2. How can a hash-based virtual structural copy of the C++ parse tree enable class-level design-pattern detection without mutating the original source representation, while remaining extensible through a JSON-defined pattern catalog?

3. How can detected design-pattern evidence be presented as ranked, source-anchored explanations that allow a reader unfamiliar with the codebase to trace every claim back to specific class, method, and line locations in the user's submitted source?

4. How can the system generate per-class documentation artifacts that combine deterministic structural facts with AI-assisted natural-language explanation, while clearly distinguishing the two so the AI output never replaces the structural ground truth used for evaluation?

5. How effective is the proposed system, evaluated within DEVCON Luzon as the primary user context, in measurably improving novice developers' ability to identify, document, and reason about design patterns in C++ code they did not write themselves?

---

## B. Section 1.6 — Specific Objectives (rewrite all 5 items, keep 1:1 pairing)

**Replace each numbered SO with:**

1. Design and implement learning modules that link each design-pattern concept to a corresponding deterministic structural check the system can run against user-submitted C++ code.

2. Develop a C++ analysis pipeline that (a) constructs an immutable actual parse tree, (b) maintains an annotated virtual structural copy with hash-identified sub-trees, and (c) runs pattern detection against the virtual tree using JSON pattern definitions, so new patterns can be added without recompilation.

3. Implement an evidence-presentation surface that ranks competing pattern matches, anchors each match to its source location, and exposes the structural tells (lexeme categories, signatures, ordered checks) that produced the match.

4. Implement a documentation generator that emits artifacts in which every AI-written sentence is traceable to a deterministic structural fact, and the deterministic facts remain machine-readable and re-verifiable independently of the AI layer.

5. Evaluate the system using DEVCON Luzon participants against a pre/post measurement of pattern-identification accuracy, documentation completeness, and reasoning quality on unseen C++ code.

**Pairing check (after pasting):** SOP 1 ↔ SO 1 (learning modules + structural checks); SOP 2 ↔ SO 2 (hash-based virtual structural copy + JSON catalog); SOP 3 ↔ SO 3 (ranked source-anchored evidence); SOP 4 ↔ SO 4 (deterministic + AI documentation); SOP 5 ↔ SO 5 (DEVCON Luzon pre/post evaluation).

---

## C. Section 1.7.1 — Scope (insert a new second paragraph)

**Insert this paragraph immediately after the existing first scope paragraph and before any of the existing pathway descriptions:**

> While the system is designed and built without DEVCON-Luzon-specific assumptions — its C++ analysis surface, hash-based virtual structural copy algorithm, and JSON-defined pattern catalog are applicable to any class-level C++ codebase that meets the structural prerequisites stated in Section 1.7.2 — the primary evaluation context of this study is DEVCON Luzon. Findings reported in Chapters 4 and 5 therefore describe usefulness and effectiveness within DEVCON Luzon participants and may not generalize to the broader audiences (quantitative analysts, embedded engineers, low-level AI engineers, and undergraduate students who ship AI-written code) for whom the system is technically applicable. Industry-scale rationale for those broader audiences is discussed in the Significance section (Section 1.4).

**Do not touch** the rest of Scope (1.7.1) or Delimitations (1.7.2). They are correct as written; the new paragraph just makes the system-vs-evaluation distinction explicit.

---

## D. Section 1.8 — Definition of Terms (fill in the placeholder)

**Replace the current placeholder entry** that reads:

> "Hash-Based Virtual Structural Copy: This is your 'star' term. Define it specifically as it pertains to your system—how it differs from a standard deep copy or reference copy."

**With:**

> **Hash-Based Virtual Structural Copy.** An immutable representation of the user's C++ parse tree (the *actual tree*) is mirrored into a working copy (the *virtual tree*) on which classification tags, cross-references, and pattern-detection results are written. Structural hashing identifies repeated sub-tree shapes so that detection work is performed once per unique structural shape rather than per textual occurrence. The actual tree is never mutated; it provides an auditable ground truth to which every detected-pattern claim is anchored. This differs from a standard deep copy by maintaining structural identity through hashing rather than node-by-node duplication, and from a reference copy by ensuring writes to the working surface never propagate back to the source representation.

The surrounding terms (Hashing Algorithm, Graph Memory Copy Algorithm) stay as written.

---

## E. Section 1.4 — Significance (add an "Industry rationale" sub-block)

**At the end of the existing five-audience justification, add a new sub-heading "Industry rationale" with the following content. The seven stats below live ONLY here.**

> **Industry rationale.** Beyond DEVCON Luzon's onboarding context, the cost of unreadable code is documented at industry scale. Recent studies between 2020 and 2026 estimate that poor software quality cost United States firms approximately $2.41 trillion in 2022 (Krasner, 2022, CISQ); top-quartile Developer Velocity organisations grow revenue four to five times faster than peers (Srivastava et al., 2020, McKinsey); elite DevOps teams recover from failures 2,604 times faster than low performers, an outcome tied to code-clarity and trunk-based discipline (DORA / Google Cloud, 2023); AI coding assistants increase commit throughput by approximately 55% but shift comprehension load onto reviewers (GitHub, 2022, 2024); classes implementing GoF design patterns show measurably lower change-proneness under maintenance (Ampatzoglou et al., 2020); breaches traced to system complexity cost organisations an additional ~$241,000 on average (IBM Security, 2023); and 76% of developers now use or plan to use AI tools while 45% do not trust the output (Stack Overflow, 2024). These figures motivate the need for AI-assisted documentation systems whose claims remain anchored to deterministic structural facts — the core contribution of this study.

**Add full citations to References** (alphabetical, APA 7th unless your style guide says otherwise):

- Ampatzoglou, A., Charalampidou, S., & Stamelos, I. (2020). A systematic literature review on the use of design patterns. *Information and Software Technology, 124,* 106324. https://doi.org/10.1016/j.infsof.2020.106324
- DORA / Google Cloud. (2023). *Accelerate State of DevOps Report 2023.* Google Cloud. https://cloud.google.com/devops/state-of-devops
- GitHub. (2022). *Quantifying GitHub Copilot's impact on developer productivity and happiness.* https://github.blog/2022-09-07-research-quantifying-github-copilots-impact-on-developer-productivity-and-happiness/
- GitHub. (2024). *Octoverse 2024.* https://octoverse.github.com/
- IBM Security. (2023). *Cost of a Data Breach Report 2023.* https://www.ibm.com/reports/data-breach
- Krasner, H. (2022). *The Cost of Poor Software Quality in the US: A 2022 Report.* Consortium for IT Software Quality. https://www.it-cisq.org/the-cost-of-poor-software-quality-in-the-us-2022/
- Srivastava, S., Trehan, K., Wagle, D., & Wang, J. (2020). *Developer Velocity: How software excellence fuels business performance.* McKinsey & Company. https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/developer-velocity-how-software-excellence-fuels-business-performance
- Stack Overflow. (2024). *2024 Developer Survey — AI Tooling section.* https://survey.stackoverflow.co/2024/ai

---

## F. Section 3.4.4 — Use Case (fill in the near-empty section)

**Replace the body of Section 3.4.4 with this introductory sentence followed by the table, then reposition the existing figure as a Figure caption beneath:**

> The system supports three actor categories — Learner / Student, Developer / Intern, and Admin / Researcher — across the routes exposed by the running prototype. Table 3.<n> enumerates the supported use cases, the trigger that initiates each, and the abbreviated main flow. Each use case maps to a verifiable route on the deployed system so that the panel can replay any row.

| Actor | Use case | Trigger | Main flow (abbreviated) |
|---|---|---|---|
| Learner / Student | Browse design-pattern learning modules | Opens `/learn` | Selects pattern → reads concept → reviews structural tells → optional self-check. |
| Learner / Student | Take pattern-comprehension assessment | From a module page | Receives questions tied to the module's structural tells; system records score for evaluation. |
| Developer / Intern | Submit C++ source for analysis | From `/student-studio` | Pastes or uploads source → system parses, builds virtual tree, runs detector → presents ranked pattern cards. |
| Developer / Intern | Inspect virtual-vs-actual tree for a class | From a pattern card | Opens the per-class detail view; sees both trees side-by-side with tagged nodes. |
| Developer / Intern | Generate AI-assisted documentation | From a pattern card | Requests narrative explanation; system composes from deterministic facts + AI; both layers visibly labeled. |
| Developer / Intern | Export documentation | From the documentation view | Downloads as Markdown, DOCX, or print-to-PDF. |
| Learner / Developer | Submit post-evaluation survey | After a session | Answers Likert-scale + open-ended items; stored for admin aggregation. |
| Admin / Researcher | View aggregated survey statistics | From `/admin` | Sees response counts, distributions, and free-text comments. |
| Admin / Researcher | Audit individual session logs | From `/admin` | Inspects a specific session's submitted code, detection output, and AI-generated documentation. |

**Figure caption (under the table):** *Figure 3.<n>. Use case diagram for the CodiNeo system, showing the three actor categories and their relationships to the use cases enumerated in Table 3.<n>.*

---

## G. Chapter 3 — ISO/IEC 25010 mapping (add a justifying-excerpt column)

**In the existing Chapter 3 paragraph that enumerates the five ISO/IEC 25010 characteristics, restructure it as a two-column table.** Left column = the characteristic (already in the paper); right column = the website-derived justifying excerpt below. The intent is to make the ISO mapping verifiable against the running system.

| ISO/IEC 25010 characteristic | Justifying behaviour in the running system |
|---|---|
| Functional suitability | "Five stages, in order. Each one runs once. The output is structural facts plus an evidence file the AI can cite back to." (System mechanics — verifiable on the live `/mechanics` page.) |
| Performance efficiency | "Categorising once means the matcher can operate on token-category windows instead of raw text." (Lexical-tagging stage — see `/mechanics` Stage 1.) |
| Interaction capability | "Pattern names are the only handle [the next reviewer] has on intent." (Audience framing — see `/why` industry panels.) |
| Reliability | "The actual tree mirrors the original source and stays immutable — that is the audit trail." (Virtual-vs-actual tree split — see `/mechanics` Stage 2.) |
| Maintainability | "Adding a new pattern is dropping a JSON file in `pattern_catalog/<family>/` and rerunning. No C++ recompile." (Catalog extensibility — see `/mechanics` Stage 5.) |

These excerpts appear ONLY under their characteristic in Chapter 3. Chapters 4 and 5 reference them as `(see Section 3.X, ISO/IEC 25010 mapping)`.

---

## H. Whole-paper isolation sweep (apply during a final pass)

For each row, keep the content in the "Owner section" only. Replace any duplicate occurrence with the indicated cross-reference.

| Idea | Owner section | Cross-reference to use elsewhere |
|---|---|---|
| Seven 2020–2026 industry stats (CISQ, McKinsey, DORA, GitHub, Ampatzoglou, IBM, Stack Overflow) | 1.4 Significance — "Industry rationale" sub-block | "(see Section 1.4, Industry rationale)" |
| "Hash-Based Virtual Structural Copy" definition | 1.8 Definition of Terms | "(see Section 1.8)" |
| Virtual-vs-actual tree mechanism (full description) | Chapter 3 — System Architecture | "(see Section 3.X)" — Chapter 1 may name the term, must not describe the mechanism |
| ISO/IEC 25010:2023 characteristic mapping table | Chapter 3 — Methodology / Evaluation framework | "(see Section 3.X, ISO/IEC 25010 mapping)" — Chapter 4 cites by section |
| Actor / use case enumeration | Chapter 3 §3.4.4 — Use Case Diagram | "(see Section 3.4.4)" — Chapters 1 and 4 must not re-list actors |
| DEVCON Luzon evaluation scope statement | Section 1.7 Scope | "(see Section 1.7)" — Background and Significance just name the context, don't restate the limits |
| Five-audience justification (interns, developers, mentors, DEVCON Luzon, software engineering) | Section 1.4 Significance | "(see Section 1.4)" — Scope and Background do not repeat the five-way breakdown |
| "AI-written code is unreadable" framing | Chapter 1 Background | Significance cross-references this rather than restating it |

**Final-pass rule when in doubt:** Background says WHY a problem exists, Significance says WHO is harmed and HOW MUCH, Scope says WHAT is in/out, Methodology says HOW it is addressed, Results report WHAT was observed. Same topic phrased differently across these sections is fine; same SENTENCE appearing twice is the failure mode.

---

## I. Pre-defense checklist (run after applying A through H)

- [ ] SOP 1 ↔ SO 1, SOP 2 ↔ SO 2, …, SOP 5 ↔ SO 5 — semantic pairing verified, not just numeric.
- [ ] The phrase "hash-based virtual structural copy" appears with a concrete definition in Section 1.8 (no placeholder text remains).
- [ ] The phrase "DEVCON Luzon" is bounded — appears in Significance and Scope, not as a scope-limiter inside every chapter.
- [ ] The seven industry-rationale stats appear ONLY in Section 1.4.
- [ ] The Use Case table appears ONLY in Section 3.4.4.
- [ ] The ISO/IEC 25010 mapping table appears ONLY in Chapter 3.
- [ ] Each References entry for the seven new stats is present and the in-text citation format matches the rest of the paper.
- [ ] Word's Find & Replace turns up zero copies of any of the seven stats outside Section 1.4.
