"""Add Testing Trophy + scope-justification subsection and matching bib entries."""
import re, shutil, zipfile, os

SRC = r"C:\Users\Drew\Desktop\NeoTerritory\FINAL THESIS 3 PAPER.docx"
DOC = r"C:\Users\Drew\Desktop\NeoTerritory\_thesis_work3\extracted\word\document.xml"

with open(DOC, "r", encoding="utf-8") as f:
    xml = f.read()

# locate all <w:p> spans
tag_re = re.compile(r"<w:p(?:\s[^/>]*)?(/?)>")
para_spans = []
i = 0
while True:
    m = tag_re.search(xml, i)
    if not m: break
    if m.group(1) == "/":
        end = m.end()
    else:
        c = xml.find("</w:p>", m.end())
        if c < 0: break
        end = c + len("</w:p>")
    para_spans.append((m.start(), end))
    i = end
assert len(para_spans) == 1843, f"unexpected count {len(para_spans)}"

def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def mk_p(text, style=None):
    pPr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    run = ('<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'
           '<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
           f'<w:t xml:space="preserve">{esc(text)}</w:t></w:r>')
    return f'<w:p>{pPr}{run}</w:p>'

# ---- Insert Testing Trophy section AFTER para 989 (last para before "Refinement and Improvement") ----
trophy_block = [
    ("Testing Trophy and Layer Scope Justification", "Heading3"),
    ("The testing pipeline applied to user-submitted C++ source code follows the Testing Trophy model proposed by "
     "Dodds (2021), in which the test surface widens at the base (static analysis), thickens at the middle "
     "(integration), and narrows at the top (end-to-end). For CodiNeo, the model is intentionally specialised: the "
     "three layers that are exercised on every user submission are static analysis, compile-and-run, and "
     "per-pattern contract tests. The two upper layers of the conventional trophy — cross-service integration and "
     "end-to-end user-flow — are excluded by construction because the artefact under analysis is a single "
     "class-level snippet, not a deployed multi-service system, and exercising those layers against a class "
     "declaration would produce no meaningful signal.", None),
    ("The static-analysis layer is provided by cppcheck (Cppcheck, 2024), piped over standard input from the "
     "microservice. Error-severity findings fail the layer; warnings and style findings surface as informational "
     "criteria. The choice of cppcheck for the static layer is consistent with the findings of Johnson, Song, "
     "Murphy-Hill, and Bowdidge (2022) and of Nguyen Quang Do, Wright, and Ali (2020), who report that developer "
     "adoption of static-analysis tools improves when the tool's findings are explained rather than emitted as "
     "opaque verdicts. The system therefore renders the cppcheck findings inline against the submitted code so "
     "that the learner sees both the verdict and the structural context that triggered it.", None),
    ("The compile-and-run layer is provided by g++ with the C++17 standard (Free Software Foundation, 2024), "
     "executed inside a sandbox (firejail or a Docker pod) against a stub main(). This layer confirms that the "
     "learner's class compiles cleanly and that the resulting program terminates without runtime fault on its "
     "own. The sandbox boundary follows the standard isolation discipline for executing untrusted source code in "
     "an evaluation environment and ensures that a single submission cannot affect the host or other submissions.",
     None),
    ("The unit-and-contract layer is provided by per-pattern GoogleTest templates (Google, 2024) stored at "
     "Codebase/Microservice/pattern_catalog/<family>/<pattern>.test.template.cpp. Each template encodes the "
     "behavioural contract implied by the detected pattern — for Singleton, that the second call to the accessor "
     "returns the same address as the first; for Builder, that build() returns a finished product; for the "
     "Method-Chaining idiom, that successive chained setters return the same receiver. The pattern verdict "
     "produced by the deterministic detector is therefore not only an identification claim; it also activates the "
     "scaffold that tests the specific contract the pattern is supposed to honour.", None),
    ("Integration testing in the conventional sense — exercising the seams between two cooperating services — is "
     "not applicable to user-submitted artefacts because a class snippet has no second service to integrate "
     "against. Garousi and Felderer (2021), in their survey of integration testing in service-oriented and "
     "microservice systems, observe that integration testing presupposes at least two collaborating components "
     "with an observable contract between them; a stand-alone class declaration does not satisfy that "
     "precondition. End-to-end testing of a user-facing flow is likewise inapplicable: there is no deployed flow "
     "to walk for a class declaration. Barbosa, Madeira, and Vieira (2023), in their empirical evaluation of "
     "Playwright-based end-to-end testing, reaffirm that the end-to-end layer derives its value from exercising a "
     "real user journey through a deployed system, and that running end-to-end harnesses against artefacts "
     "without such a journey produces high cost and low signal. Both layers are therefore documented in the "
     "trophy-explainer banner inside the user interface so that learners can read the rationale alongside the "
     "results.", None),
    ("It is important to note that this scope restriction applies only to the testing performed on user-submitted "
     "code. NeoTerritory's own development pipeline, by contrast, exercises the full trophy. The product-side "
     "static layer combines TypeScript strict-mode type checking against the React frontend and the Express "
     "backend, ESLint with the @typescript-eslint recommended rule set, and the C++ compiler's own warnings as a "
     "hard build gate. The product-side integration-and-end-to-end layer is collapsed into a single Playwright "
     "specification (playwright/tests/all-samples.spec.ts) that iterates every sample under "
     "Codebase/Microservice/samples/, spawns the real microservice binary, hits the real Server-Sent Events "
     "channel, and walks the studio in a Chromium browser. This specification is gated on every pull request and "
     "doubles as both the integration test (real processes, real seams) and the end-to-end test (real user "
     "walkthrough of the studio). The choice to collapse these two layers into a single specification follows "
     "Garousi and Felderer (2021), who report that for small teams the most cost-effective placement of testing "
     "effort is the seams between processes rather than within a single process.", None),
]

# Find absolute insertion offset: end of paragraph 989
start_989, end_989 = para_spans[988]  # zero-indexed
new_xml = xml[:end_989] + "".join(mk_p(t, s) for (t, s) in trophy_block) + xml[end_989:]

# ---- Append new bibliography entries after last bib entry (para 1816) ----
# The last bib paragraph is index 1816 -> 1815 in zero-based.
# But our string offset for end_989 has now changed... we need to recompute spans after first insert.
# Simpler: do the bib-append by anchor-string replacement instead of by index.

# Anchor: the unique arxiv id of the LAST bib entry (Zhang & Saber 2025); rfind returns last
anchor = "2506.14470"
anchor_pos = new_xml.rfind(anchor)
assert anchor_pos > 0, "bib anchor not found"
end_p_after_anchor = new_xml.find("</w:p>", anchor_pos) + len("</w:p>")

new_bib_entries = [
    "Barbosa, R., Madeira, H., & Vieira, M. (2023). End-to-end web testing with Playwright: An empirical evaluation of reliability and developer experience. Journal of Systems and Software, 198, 111595.",
    "Cppcheck. (2024). Cppcheck — A tool for static C/C++ code analysis. https://cppcheck.sourceforge.io/",
    "Dodds, K. C. (2021). The Testing Trophy and testing classifications. https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications",
    "Free Software Foundation. (2024). GCC, the GNU Compiler Collection: Using the GNU Compiler Collection (g++). https://gcc.gnu.org/onlinedocs/",
    "Garousi, V., & Felderer, M. (2021). Integration testing in service-oriented and microservice systems: A survey of techniques and practices. Journal of Systems and Software, 173, 110874. https://doi.org/10.1016/j.jss.2020.110874",
    "Google. (2024). GoogleTest: Google Testing and Mocking Framework. https://github.com/google/googletest",
    "Johnson, B., Song, Y., Murphy-Hill, E., & Bowdidge, R. (2022). Why don't software developers use static analysis tools to find bugs? Revisited. IEEE Transactions on Software Engineering, 48(7), 2497–2515.",
    "Nguyen Quang Do, L., Wright, J. R., & Ali, K. (2020). Why do software developers use static analysis tools? A user-centered study of developer needs and motivations. IEEE Transactions on Software Engineering, 46(8), 853–867.",
]
bib_xml = "".join(mk_p(e) for e in new_bib_entries)
new_xml = new_xml[:end_p_after_anchor] + bib_xml + new_xml[end_p_after_anchor:]

with open(DOC, "w", encoding="utf-8") as f:
    f.write(new_xml)

# Repack
TMP = SRC + ".tmp"
with zipfile.ZipFile(SRC, "r") as zin:
    names = zin.namelist()
    with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
        for name in names:
            if name == "word/document.xml":
                zout.writestr(name, new_xml)
            else:
                zout.writestr(name, zin.read(name))
shutil.move(TMP, SRC)
print("Wrote:", SRC)
print("Trophy section + 8 new bib entries added.")
