"""
Post-edit pass:
 1. Rename the Ch5 title block from
      "SUMMARY OF FINDINGS, CONCLUSIONS, AND RECOMMENDATIONS"
    to
      "SUMMARY OF FINDINGS AND CONCLUSIONS"
 2. Promote the inserted Recommendations Heading2 paragraph into a NEW
    chapter header block (Chapter 6 / RECOMMENDATIONS) so the document
    now contains two distinct chapters per the user's format.

Strategy: surgical string replace in document.xml. The two anchors are
unique strings, so we can target them directly. For the Recommendations
upgrade, we replace the single Heading2 paragraph with a 3-paragraph
chapter-header sequence (empty Heading1, "Chapter 6" Heading1, then
"RECOMMENDATIONS" Heading1).
"""
import re, shutil, zipfile, os

SRC = r"C:\Users\Drew\Desktop\NeoTerritory\FINAL THESIS 3 PAPER.docx"
WORK_XML = r"C:\Users\Drew\Desktop\NeoTerritory\_thesis_work2\extracted\word\document.xml"

with open(WORK_XML, "r", encoding="utf-8") as f:
    xml = f.read()

# (1) Retitle Ch5 -------------------------------------------------------
xml_before = xml
xml = xml.replace(
    "SUMMARY OF FINDINGS, CONCLUSIONS, AND RECOMMENDATIONS",
    "SUMMARY OF FINDINGS AND CONCLUSIONS",
)
assert xml != xml_before, "Ch5 retitle missed"

# (2) Locate the Recommendations Heading2 paragraph and replace with
#     three Heading1 paragraphs (chapter header pattern matching Ch5/Ch4 above).
# The paragraph was authored by edit.py as:
#   <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
#     <w:r>...<w:t xml:space="preserve">Recommendations</w:t></w:r>
#   </w:p>
recs_para_pattern = re.compile(
    r'<w:p>'
    r'<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>'
    r'<w:r>(?:(?!</w:r>).)*?<w:t xml:space="preserve">Recommendations</w:t></w:r>'
    r'</w:p>',
    re.DOTALL,
)

m = recs_para_pattern.search(xml)
assert m, "Recommendations Heading2 paragraph not located"

def make_h1(text: str) -> str:
    safe = (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    return (
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>'
        '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'
        '<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
        f'<w:t xml:space="preserve">{safe}</w:t></w:r></w:p>'
    )

ch6_header = make_h1("") + make_h1("Chapter 6") + make_h1("RECOMMENDATIONS")

# Also add a short Overview Heading2 + intro paragraph so Ch6 reads as a
# self-contained chapter rather than a header sitting on top of a list.
def make_h2(text: str) -> str:
    safe = (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    return (
        '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>'
        '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'
        '<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
        f'<w:t xml:space="preserve">{safe}</w:t></w:r></w:p>'
    )

def make_p(text: str) -> str:
    safe = (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    return (
        '<w:p>'
        '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'
        '<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
        f'<w:t xml:space="preserve">{safe}</w:t></w:r></w:p>'
    )

ch6_overview = make_h2("Overview") + make_p(
    "This chapter presents the recommendations addressed forward to the parties who will continue, extend, or "
    "apply the work reported in this study. Each recommendation is presented as a self-contained, actionable "
    "proposal and is read independently of the others. The recommendations follow from the conclusions reported "
    "in Chapter 5 but do not introduce new findings; they translate those findings into forward-facing actions "
    "for future researchers, instructors and DEVCON Luzon coordinators, learners using the system, maintainers "
    "and contributors to CodiNeo, and institutional users adopting the system outside the present context."
)

replacement = ch6_header + ch6_overview
xml = xml[:m.start()] + replacement + xml[m.end():]

with open(WORK_XML, "w", encoding="utf-8") as f:
    f.write(xml)

# Repack
TMP = SRC + ".tmp"
with zipfile.ZipFile(SRC, "r") as zin:
    names = zin.namelist()
    with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
        for name in names:
            if name == "word/document.xml":
                zout.writestr(name, xml)
            else:
                zout.writestr(name, zin.read(name))

shutil.move(TMP, SRC)
print("Wrote:", SRC)
print("Ch5/Ch6 split applied.")
