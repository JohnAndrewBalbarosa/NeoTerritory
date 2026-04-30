# Questionnaire Reference (Source-of-Truth)

> **Important:** Every question in this file is **validated** and must be reproduced **word-for-word** in the UI. Do not paraphrase, shorten, or "improve" wording. Whitespace and punctuation in section labels follow the source `.docx` export.
>
> Source export: `Questionnaire A & B.docx.md` at repo root.
>
> The export only contains **Questionnaire B**. **Questionnaire A is missing** — paste it into the `## Questionnaire A` block below before wiring it into the UI.
>
> Rating scale `1–5` is rendered in the UI as a **5-star control** (1 ★ = Strongly Disagree, 5 ★★★★★ = Strongly Agree).

---

## Data Privacy Act of 2012 (consent gate — shown before any testing)

In compliance with the Data Privacy Act of 2012 (Republic Act No. 10173), all information collected through this questionnaire will be treated with strict confidentiality and used solely for academic research purposes. Participation is voluntary, and respondents may refuse to answer any question or withdraw at any time. All responses will be analyzed and reported only in summarized form, and no personal information will be disclosed in the final study or related outputs. By proceeding with this questionnaire, you acknowledge that you have read and understood this notice and voluntarily consent to the collection and use of your responses for the stated research purpose.

**Acknowledgement control:** single checkbox/toggle — "I have read and understood this notice and voluntarily consent." User cannot proceed past the consent gate without checking it. Decline → returns to the seat picker / sign-out.

---

## Questionnaire A — Pre-Test (Respondent Profile)

> **NOT IN THE EXPORT.** Paste Questionnaire A here word-for-word when available.
>
> Working assumption (replace when source arrives): A is the *pre-test* questionnaire shown right after consent, before the user touches the analysis tool. Per the source, Section A's "Respondent Profile" likely belongs to A:

### Section A. Respondent Profile (placeholder — confirm source)

1. Current year level or experience level: ☐ First year  ☐ Second year  ☐ Third year  ☐ Fourth year  ☐ Intern  ☐ Novice developer  ☐ Others: ____________

2. Programming experience: ☐ Less than 1 year  ☐ 1-2 years  ☐ 3-4 years  ☐ More than 4 years

3. Familiarity with C++: ☐ Not familiar  ☐ Beginner  ☐ Intermediate  ☐ Advanced

4. Familiarity with object-oriented programming: ☐ Not familiar  ☐ Beginner  ☐ Intermediate  ☐ Advanced

5. Familiarity with design patterns: ☐ Not familiar  ☐ Beginner  ☐ Intermediate  ☐ Advanced

---

## Questionnaire B — Intern / Application-User Cohort

*User Evaluation for Code Understanding, Documentation Support, and Learning*

### Purpose

This questionnaire is intended for interns, novice developers, or software engineering students. It aims to evaluate whether the system is understandable and useful for learning C++ code structure, understanding design-pattern evidence, and supporting documentation and onboarding. The questions use simplified user-centered wording while remaining aligned with selected ISO/IEC 25010 software quality characteristics.

### Rating Scale

| Rating | Interpretation |
| :---- | :---- |
| 5 | Strongly Agree |
| 4 | Agree |
| 3 | Neutral |
| 2 | Disagree |
| 1 | Strongly Disagree |

For each statement, encircle or check one rating: 1 ☐   2 ☐   3 ☐   4 ☐   5 ☐
*(UI: render as 5-star input.)*

### Section B. Functional Suitability and Code Understanding Support

1. The system helps me understand unfamiliar C++ source code.
2. The system helps me identify important parts of the analyzed code.
3. The generated documentation is clear and understandable.
4. The documentation explains the purpose of the analyzed code.
5. The detected design-pattern evidence helps me connect design-pattern concepts to actual C++ code.
6. The explanations help me understand why certain code structures may relate to a design pattern.
7. The generated unit-test targets help me identify what parts of the code may need testing.
8. The unit-test targets help me understand the expected behavior of the analyzed code.
9. The system would be useful during internship onboarding.
10. Overall, the system is useful for code understanding, documentation, and design-pattern learning.

### Section C. Usability and Interface Clarity

11. The system interface is easy to understand.
12. It is easy to enter or paste C++ code into the system.
13. I can understand what the system is trying to show after analysis.
14. The displayed results are organized clearly.
15. The system is easy to use even with minimal assistance.

### Section D. Performance Efficiency

16. The system loads and responds within an acceptable time.
17. The system generates analysis results without noticeable delays.
18. The system remains responsive while processing submitted C++ code.

### Section E. Reliability

19. The system works consistently when analyzing valid C++ code.
20. The system provides clear feedback when the submitted code cannot be analyzed properly.
21. The system produces stable results when similar C++ inputs are analyzed.

### Section F. Security and Data Protection

22. I feel that the system handles submitted code and user responses responsibly.
23. The system provides enough assurance that submitted information will be used only for the intended academic purpose.
24. The system protects user responses and submitted information from unauthorized disclosure.

### Section G. Open-Ended Questions

1. Which part of the system helped you understand the code the most?
2. Which part of the system was confusing or difficult to understand?
3. Did the generated documentation help you understand the code? Why or why not?
4. Did the detected design-pattern evidence help you understand the code structure? Why or why not?
5. What improvements would make the system more useful for interns or novice developers?

---

## Per-Run Quality Survey (between analysis runs)

> Shown **before** a tester triggers a *second* (and every subsequent) analysis run, while the previous run is still on screen. Tester cannot re-run until this is submitted or explicitly skipped.
>
> Pulled from Section B + per-run open-ended (B.G.3, B.G.4) so signal is tied to the run that just happened, not to the whole session.

**Star ratings (1–5, 5-star UI):**
- The generated documentation is clear and understandable. *(B.3)*
- The documentation explains the purpose of the analyzed code. *(B.4)*
- The detected design-pattern evidence helps me connect design-pattern concepts to actual C++ code. *(B.5)*
- The explanations help me understand why certain code structures may relate to a design pattern. *(B.6)*
- The generated unit-test targets help me identify what parts of the code may need testing. *(B.7)*

**Open-ended (textarea):**
- Did the generated documentation help you understand the code? Why or why not? *(B.G.3)*
- Did the detected design-pattern evidence help you understand the code structure? Why or why not? *(B.G.4)*

---

## Sign-Out Survey (full session wrap)

> Shown when the user clicks "Sign out". Cannot be skipped (devcon testers); production users see a "Skip" link.
>
> Covers everything **except** per-run items already collected above. Pulled from Sections B (overall), C, D, E, F, and the remaining open-ended items.

**Star ratings (1–5):**
- The system helps me understand unfamiliar C++ source code. *(B.1)*
- The system helps me identify important parts of the analyzed code. *(B.2)*
- The unit-test targets help me understand the expected behavior of the analyzed code. *(B.8)*
- The system would be useful during internship onboarding. *(B.9)*
- Overall, the system is useful for code understanding, documentation, and design-pattern learning. *(B.10)*
- The system interface is easy to understand. *(C.11)*
- It is easy to enter or paste C++ code into the system. *(C.12)*
- I can understand what the system is trying to show after analysis. *(C.13)*
- The displayed results are organized clearly. *(C.14)*
- The system is easy to use even with minimal assistance. *(C.15)*
- The system loads and responds within an acceptable time. *(D.16)*
- The system generates analysis results without noticeable delays. *(D.17)*
- The system remains responsive while processing submitted C++ code. *(D.18)*
- The system works consistently when analyzing valid C++ code. *(E.19)*
- The system provides clear feedback when the submitted code cannot be analyzed properly. *(E.20)*
- The system produces stable results when similar C++ inputs are analyzed. *(E.21)*
- I feel that the system handles submitted code and user responses responsibly. *(F.22)*
- The system provides enough assurance that submitted information will be used only for the intended academic purpose. *(F.23)*
- The system protects user responses and submitted information from unauthorized disclosure. *(F.24)*

**Open-ended (textarea):**
- Which part of the system helped you understand the code the most? *(B.G.1)*
- Which part of the system was confusing or difficult to understand? *(B.G.2)*
- What improvements would make the system more useful for interns or novice developers? *(B.G.5)*

---

## Where each block lives in the UI (Taglish placement plan)

| Block | Saan ipapakita | Trigger | Skippable? |
|---|---|---|---|
| **Data Privacy Notice** | Modal/page after seat-claim, before pumasok sa studio | Pagkatapos pumili ng `devcon#` tile, bago lumabas ang main UI | Hindi — kapag hindi nag-agree, babalik sa picker |
| **Questionnaire A (Pre-Test / Profile)** | Same gate as Privacy, kasunod kaagad | Pagkatapos mag-consent sa Privacy, bago mag-load ng tabs | Hindi para sa devcon testers; production users hindi makikita |
| **Per-Run Quality Survey** | Inline modal sa Tab 1 (submission) | Pinindot ng tester ang **Run analysis** ulit pagkatapos ng kahit isang completed run | Tester: hindi; production: may "Skip" |
| **Sign-Out Survey (Section C–F + remaining open-ended)** | Full-screen takeover | Pinindot ang **Sign out** | Tester: hindi; production: may "Skip" |

**Notes for implementation:**
- Lahat ng questions ay **kinokopya word-for-word** mula sa nakahalimbawang sections sa itaas. Walang paraphrase. Section IDs (e.g. B.5, C.13) are preserved sa payload para alam mo sa DB kung anong question yung sinasagot.
- Star control = 5-star clickable. Hover preview, keyboard arrows, screen-reader label = "Rating: N out of 5".
- Storage: bagong SQLite tables — `survey_consent (user_id, accepted_at, version)`, `survey_pretest (user_id, answers_json, submitted_at)`, `run_feedback (run_id, user_id, ratings_json, open_ended_json, submitted_at)`, `session_feedback (user_id, session_id, ratings_json, open_ended_json, submitted_at)`. All idempotent migrations.
- Privacy-by-default: server logs never include answer text in plaintext beyond the row itself; admin-only export endpoint behind the existing admin role.
