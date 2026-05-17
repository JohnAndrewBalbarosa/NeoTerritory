"""Promote 'Project Design and System Architecture' to Heading2 and rename it to 'Diagrams'.

After this edit:
  3.4 Algorithm
    3.4.1 Time Complexity Analysis
    3.4.2 Space Complexity
  3.5 Diagrams                    <-- promoted from H3 to H2
    3.5.1 Activity Diagram
    3.5.2 Use Case Diagram
    3.5.3 Class Diagram
    3.5.4 System Architecture
"""
import re, shutil, zipfile

SRC = r"C:\Users\Drew\Desktop\NeoTerritory\FINAL THESIS 3 PAPER.docx"
DOC = r"C:\Users\Drew\Desktop\NeoTerritory\_thesis_work4\extracted\word\document.xml"

with open(DOC, "r", encoding="utf-8") as f:
    xml = f.read()

# Locate the unique paragraph containing "Project Design and System Architecture" with Heading3.
# Pattern intent:
#   <w:p ... paraId="1124557B" ...><w:pPr><w:pStyle w:val="Heading3"/>...</w:pPr>
#     <w:r ...><w:t>Project Design and System Architecture</w:t></w:r></w:p>
# Replace: change pStyle to Heading2 AND replace title text to "Diagrams"
anchor_text = "Project Design and System Architecture"
assert xml.count(anchor_text) == 1, f"expected 1 occurrence, got {xml.count(anchor_text)}"

# Strategy: regex-replace within a tight window. Find the paragraph that owns this text and
# patch (a) the pStyle and (b) the inner <w:t>.
# 1) Patch the title text -> "Diagrams"
xml_new = xml.replace(
    f"<w:t>{anchor_text}</w:t>",
    "<w:t>Diagrams</w:t>",
    1,
)
assert xml_new != xml, "text replacement failed"
xml = xml_new

# 2) Patch the pStyle for that paragraph only. The paragraph block is identifiable by paraId "1124557B".
# Replace its first pStyle Heading3 occurrence with Heading2.
# Bound to the paragraph by anchoring on the paraId.
paraid = "1124557B"
pat = re.compile(
    rf'(<w:p [^>]*paraId="{paraid}"[^>]*>\s*<w:pPr>)<w:pStyle w:val="Heading3"/>',
    re.DOTALL,
)
m = pat.search(xml)
assert m, "could not locate paraId paragraph"
xml = xml[:m.start()] + m.group(1) + '<w:pStyle w:val="Heading2"/>' + xml[m.end():]

with open(DOC, "w", encoding="utf-8") as f:
    f.write(xml)

# Repack
TMP = SRC + ".tmp"
with zipfile.ZipFile(SRC, "r") as zin:
    names = zin.namelist()
    with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            zout.writestr(n, xml if n == "word/document.xml" else zin.read(n))
shutil.move(TMP, SRC)
print("Wrote:", SRC)
print("Promoted Project Design and System Architecture -> H2 'Diagrams'.")
