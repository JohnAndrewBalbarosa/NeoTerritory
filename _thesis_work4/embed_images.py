"""Embed UseCase / Activity / Class PNGs into the thesis docx, each placed
immediately above its 'Figure N.' caption paragraph.

Steps:
 1. Copy the 3 PNGs into the docx zip's word/media/ folder.
 2. Add 3 Relationship entries to word/_rels/document.xml.rels.
 3. For each caption paragraph (Figure 4/5/6), insert a new <w:p> immediately
    before it that contains a centred inline <w:drawing> pointing to the rId.

The drawing block follows the OOXML inline-picture template used by Word.
"""
from __future__ import annotations
import re, os, shutil, zipfile, struct
from pathlib import Path

DOCX = r"C:\Users\Drew\Desktop\NeoTerritory\FINAL THESIS 3 PAPER.docx"
DIAG = r"C:\Users\Drew\Desktop\NeoTerritory\docs\Codebase\Diagrams"

# Image dimensions in pixels — read from PNG header (IHDR chunk) ----
def png_dims(path: str) -> tuple[int, int]:
    with open(path, "rb") as f:
        data = f.read(32)
    # PNG signature 8 bytes, then IHDR length(4) + "IHDR"(4) + width(4) + height(4)
    w = struct.unpack(">I", data[16:20])[0]
    h = struct.unpack(">I", data[20:24])[0]
    return w, h

# EMU per inch
EMU_PER_INCH = 914400
TARGET_WIDTH_INCHES = 6.0  # fits the body text column comfortably

# Diagram set: (anchor caption text, PNG path, media filename, target rId hint)
DIAGRAMS = [
    ("Figure 4. Activity Diagram",
     os.path.join(DIAG, "CodiNeo_Activity.png"),
     "neoterritory_activity.png"),
    ("Figure 5. Use Case Diagram",
     os.path.join(DIAG, "CodiNeo_UseCase.png"),
     "neoterritory_use_case.png"),
    ("Figure 6. Class Diagram",
     os.path.join(DIAG, "CodiNeo_Class.png"),
     "neoterritory_class.png"),
]

for _, p, _ in DIAGRAMS:
    assert os.path.exists(p), f"missing: {p}"

# ---- Read docx into memory ----
with zipfile.ZipFile(DOCX, "r") as zin:
    members = {n: zin.read(n) for n in zin.namelist()}

doc_xml = members["word/document.xml"].decode("utf-8")
rels_xml = members["word/_rels/document.xml.rels"].decode("utf-8")

# ---- Allocate new rIds (next available beyond highest existing) ----
existing_rids = [int(m.group(1)) for m in re.finditer(r'Id="rId(\d+)"', rels_xml)]
next_rid = max(existing_rids) + 1

# Build relationships
new_rels = []
img_rids = {}  # anchor -> (rId, media_name, dims_emu)
for (anchor, png_path, media_name) in DIAGRAMS:
    rid = f"rId{next_rid}"
    next_rid += 1
    new_rels.append(
        f'<Relationship Id="{rid}" '
        f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
        f'Target="media/{media_name}"/>'
    )
    w_px, h_px = png_dims(png_path)
    # scale to target width
    cx_emu = int(TARGET_WIDTH_INCHES * EMU_PER_INCH)
    cy_emu = int(cx_emu * (h_px / w_px))
    # cap height to keep on one page (max ~8 inches)
    max_cy = int(8.5 * EMU_PER_INCH)
    if cy_emu > max_cy:
        scale = max_cy / cy_emu
        cy_emu = int(cy_emu * scale)
        cx_emu = int(cx_emu * scale)
    img_rids[anchor] = (rid, media_name, cx_emu, cy_emu)

# Insert relationships before </Relationships>
rels_xml = rels_xml.replace("</Relationships>", "".join(new_rels) + "</Relationships>")

# ---- Build inline-drawing paragraph for each diagram ----
def make_drawing_paragraph(rid: str, cx: int, cy: int, name: str, descr: str) -> str:
    docpr_id = abs(hash(rid)) % 1000000 + 1
    pic_id = docpr_id + 1
    return f'''<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="{cx}" cy="{cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="{docpr_id}" name="Picture {docpr_id}" descr="{descr}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="{pic_id}" name="{name}" descr="{descr}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="{rid}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'''

# ---- Insert each drawing paragraph BEFORE the paragraph containing the caption text ----
# For each anchor, find the <w:p> that contains the caption's <w:t>...caption text...</w:t>,
# and insert the drawing paragraph immediately before that <w:p>'s opening tag.
for anchor, (rid, media_name, cx, cy) in img_rids.items():
    # Find anchor text occurrence
    needle = anchor
    pos = doc_xml.find(needle)
    if pos < 0:
        # Word may split the text into multiple runs. Fallback: search for "Figure N." prefix
        # captured by docx splitting.
        prefix = anchor.split(".")[0] + "."  # e.g. "Figure 4."
        # find the first occurrence of "Figure N." that is NOT inside the TOC line
        # Heuristic: look for the body occurrence — the caption pStyle="Caption" tag.
        caption_re = re.compile(rf'<w:p\b[^>]*>(?:(?!</w:p>).)*?<w:pStyle w:val="Caption"/>(?:(?!</w:p>).)*?{re.escape(prefix)}', re.DOTALL)
        m = caption_re.search(doc_xml)
        if m:
            pos = m.start()
            anchor_start_of_p = pos
        else:
            print(f"WARN: anchor not found for {anchor}")
            continue
    else:
        # walk back to find the start of the enclosing <w:p
        anchor_start_of_p = doc_xml.rfind("<w:p ", 0, pos)
        alt = doc_xml.rfind("<w:p>", 0, pos)
        anchor_start_of_p = max(anchor_start_of_p, alt)
        if anchor_start_of_p < 0:
            print(f"WARN: couldn't find paragraph start for {anchor}")
            continue
    drawing_p = make_drawing_paragraph(rid, cx, cy, media_name, anchor)
    doc_xml = doc_xml[:anchor_start_of_p] + drawing_p + doc_xml[anchor_start_of_p:]
    print(f"Inserted {anchor} ({cx}x{cy} EMU) as {rid}")

# ---- Ensure document.xml declares the pic namespace if not already (it usually does indirectly) ----
# Word tolerates xmlns:pic injected inline, but if the <w:document> root lacks it we add it.
# Search root document tag
m_root = re.search(r"<w:document\b[^>]*>", doc_xml)
if m_root and "xmlns:pic=" not in m_root.group(0):
    new_root = m_root.group(0).replace(
        "<w:document ",
        '<w:document xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ',
        1,
    )
    doc_xml = doc_xml[:m_root.start()] + new_root + doc_xml[m_root.end():]

# ---- Repack the zip ----
members["word/document.xml"] = doc_xml.encode("utf-8")
members["word/_rels/document.xml.rels"] = rels_xml.encode("utf-8")
for (_, png_path, media_name) in DIAGRAMS:
    with open(png_path, "rb") as f:
        members[f"word/media/{media_name}"] = f.read()

TMP = DOCX + ".tmp"
with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for name, data in members.items():
        zout.writestr(name, data)
shutil.move(TMP, DOCX)
print("Wrote:", DOCX)
print("Done.")
