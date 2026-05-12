# Thesis isolation audit + ready-to-paste rewrites

Working note for `FINAL THESIS 3 PAPER.docx`. Apply each block in Word in the order listed. Section numbers reference the current paper's TOC.

> **Isolation rule (user choice):** Strict content, allow cross-reference pointers. Each idea owns ONE section. Other sections that need to reference it say `(see Section N.M)` instead of repeating the content.

---

## A. Section 1.5 — Statement of the Problem (v3: accessible + broader scope)

> **Register notes (v3):** plain language for a panel including non-CS readers, AND broader scope than v2. v2 mentioned "C++" five times and "DEVCON Luzon" twice; v3 removes "C++" entirely (Scope owns the language constraint) and removes "DEVCON Luzon" entirely (Scope + Methodology + Significance own the partnership context). The algorithm name "Hash-Based Virtual Structural Copy" still lives only in the Title, Section 1.8 Definition of Terms, and Chapter 3 — never in these SOPs.

**Replace each numbered SOP with:**

1. How can the system teach design patterns in a way that lets the user try each pattern on their own source code immediately after the lesson, instead of only reading about it?

2. How can the system examine a user's source code to find which design patterns are present, without changing the user's original code, and allow the team to add support for new patterns later without rebuilding the system?

3. How can the system present its findings in a way that shows the user which lines of their code triggered each detected pattern and why, so the user can verify the finding for themselves?

4. How can the system write per-class documentation that combines findings the system verified from the user's code with explanations written by AI, while clearly labelling which sentences come from which source so the user can trust the documentation?

5. How well does the system help novice developers identify, document, and explain design patterns in source code that someone else wrote — measured by comparing what they can do before and after using the system?

---

## B. Section 1.6 — Specific Objectives (v3: accessible + broader scope, 1:1 pairing preserved)

> **Register notes (v3):** same vocabulary discipline as block A. SO 2 is the ONLY objective that names C++ — and only as the prototype's scope, with an explicit extensibility cross-reference to Section 1.7. SOs 1, 3, 4, 5 say "source code". DEVCON Luzon is removed from SO 5 (replaced by "novice-developer participants"); WHO the participants are gets stated in Methodology Chapter 3.

**Replace each numbered SO with:**

1. Create learning modules where each design-pattern lesson is paired with a hands-on check the system runs on the user's own source code, so the user sees the lesson applied to their work right after learning it.

2. Build a code-analysis feature that reads the user's source without modifying it, identifies which design patterns appear at the class level, and reads its pattern definitions from configuration files so new patterns can be added by editing files instead of rebuilding the system. The prototype implementation supports C++ as its first and only currently-supported language; extension to additional statically-typed object-oriented languages is identified as future work (see Section 1.7 Scope).

3. Build a results view that lists the most likely pattern matches first, links each match to the exact lines of code that caused it, and explains in plain language what the system saw in those lines.

4. Build a documentation feature that produces a written explanation for each analysed class, mixing facts the system verified against the user's code with sentences written by AI, with each AI-written sentence visibly marked so the user can tell the two apart.

5. Evaluate the system with novice-developer participants by measuring, before and after they use the system, how accurately they can identify design patterns in unfamiliar source code, how completely they can document those patterns, and how clearly they can explain why each pattern is there.

**Pairing check (after pasting):** SOP 1 ↔ SO 1 (learn-then-try-on-own-code); SOP 2 ↔ SO 2 (find patterns without changing source + add new patterns by editing files + C++ prototype boundary); SOP 3 ↔ SO 3 (ranked findings + exact lines + plain-language reasons); SOP 4 ↔ SO 4 (verified findings + AI sentences clearly marked); SOP 5 ↔ SO 5 (novice-developer before/after on identify/document/explain).

---

## C. Section 1.7.1 — Scope (v3: insert TWO new paragraphs that own BOTH boundaries)

**Insert these two paragraphs immediately after the existing first scope paragraph and before any of the existing pathway descriptions. They replace any earlier v2 single-paragraph insertion if it was applied.**

> The algorithm at the core of this study is designed for **statically-typed object-oriented programming languages with class-level syntactic structure**, including but not limited to C++, Java, C#, and Kotlin. The prototype implementation supports **C++ as its first and only currently-supported language**, chosen because of the time and resource constraints of an undergraduate thesis; extension to additional statically-typed object-oriented languages is identified as future work in Chapter 5. Support for **dynamically-typed object-oriented languages** (e.g. Python, JavaScript) is **out of scope** for both the prototype and the algorithmic claim of this study, and is not committed to as future work.
>
> The primary evaluation context of this study is the **DEVCON Luzon learning environment**, where the system is tested with novice-developer participants drawn from the DEVCON Luzon community. Findings reported in Chapters 4 and 5 describe usefulness and effectiveness within that participant pool and are not intended to generalize beyond it. The system itself is built without DEVCON-Luzon-specific assumptions — the partnership defines the evaluation site, not the audience the system is technically applicable to. Industry-scale rationale for the broader audiences for whom the system is technically applicable is discussed in the Significance section (Section 1.4).

**Do not touch** the rest of Scope (1.7.1) or Delimitations (1.7.2). They are correct as written; these two paragraphs are the SINGLE owner of both the language boundary and the evaluation-site boundary for the whole paper. SOPs/SOs cross-reference Section 1.7 instead of repeating these statements.

---

## D. Section 1.8 — Definition of Terms (v3: fill in the placeholder + language-agnostic algorithm framing)

**Replace the current placeholder entry** that reads:

> "Hash-Based Virtual Structural Copy: This is your 'star' term. Define it specifically as it pertains to your system—how it differs from a standard deep copy or reference copy."

**With:**

> **Hash-Based Virtual Structural Copy.** An immutable representation of the user's source-code parse tree (the *actual tree*) is mirrored into a working copy (the *virtual tree*) on which classification tags, cross-references, and pattern-detection results are written. Structural hashing identifies repeated sub-tree shapes so that detection work is performed once per unique structural shape rather than per textual occurrence. The actual tree is never mutated; it provides an auditable ground truth to which every detected-pattern claim is anchored. This differs from a standard deep copy by maintaining structural identity through hashing rather than node-by-node duplication, and from a reference copy by ensuring writes to the working surface never propagate back to the source representation. The algorithm is defined for statically-typed object-oriented programming languages with class-level syntactic structure; the prototype implementation in this study operates on C++ parse trees (see Section 1.7 Scope for the full language-scope statement).

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
