"""Insert UseCase + Class diagrams immediately above their caption paragraphs.
Use paraId anchors (more reliable than text search since Word splits text into runs).

Captions (verified):
  Figure 5. Use Case Diagram  -> paragraph paraId="2DDF2818"
  Figure 6. Class Diagram     -> paragraph paraId="0E2F676A"

Activity was already embedded in the previous pass.
"""
from __future__ import annotations
import os, re, struct, shutil, zipfile

DOCX = r"C:\Users\Drew\Desktop\NeoTerritory\FINAL THESIS 3 PAPER.docx"
DIAG = r"C:\Users\Drew\Desktop\NeoTerritory\docs\Codebase\Diagrams"

EMU_PER_INCH = 914400
TARGET_WIDTH_INCHES = 6.0

def png_dims(p):
    with open(p,"rb") as f: data=f.read(32)
    return struct.unpack(">I", data[16:20])[0], struct.unpack(">I", data[20:24])[0]

REMAINING = [
    ("2DDF2818", os.path.join(DIAG, "CodiNeo_UseCase.png"), "neoterritory_use_case.png", "Use Case Diagram"),
    ("0E2F676A", os.path.join(DIAG, "CodiNeo_Class.png"),   "neoterritory_class.png",    "Class Diagram"),
]

with zipfile.ZipFile(DOCX, "r") as zin:
    members = {n: zin.read(n) for n in zin.namelist()}

doc_xml  = members["word/document.xml"].decode("utf-8")
rels_xml = members["word/_rels/document.xml.rels"].decode("utf-8")

# allocate rIds
existing_rids = [int(m.group(1)) for m in re.finditer(r'Id="rId(\d+)"', rels_xml)]
next_rid = max(existing_rids) + 1

# Skip re-adding media + relationship if already present (idempotency).
def has_rel_for(media_name: str) -> str | None:
    m = re.search(rf'Id="(rId\d+)"[^/]*Target="media/{re.escape(media_name)}"', rels_xml)
    return m.group(1) if m else None

new_rels_xml = rels_xml
inserts = []
for paraId, png_path, media_name, descr in REMAINING:
    rid = has_rel_for(media_name)
    if not rid:
        rid = f"rId{next_rid}"; next_rid += 1
        new_rels_xml = new_rels_xml.replace(
            "</Relationships>",
            f'<Relationship Id="{rid}" '
            f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
            f'Target="media/{media_name}"/></Relationships>'
        )
        # also add media bytes
        with open(png_path, "rb") as f:
            members[f"word/media/{media_name}"] = f.read()
    w_px, h_px = png_dims(png_path)
    cx = int(TARGET_WIDTH_INCHES * EMU_PER_INCH)
    cy = int(cx * (h_px / w_px))
    max_cy = int(8.5 * EMU_PER_INCH)
    if cy > max_cy:
        s = max_cy / cy; cx, cy = int(cx*s), int(cy*s)
    inserts.append((paraId, rid, media_name, descr, cx, cy))

def make_drawing_p(rid, cx, cy, name, descr):
    docpr_id = abs(hash(rid)) % 1000000 + 1
    pic_id = docpr_id + 1
    return (
        '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr>'
        '<w:drawing>'
        '<wp:inline distT="0" distB="0" distL="0" distR="0" '
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">'
        f'<wp:extent cx="{cx}" cy="{cy}"/>'
        '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
        f'<wp:docPr id="{docpr_id}" name="Picture {docpr_id}" descr="{descr}"/>'
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:nvPicPr><pic:cNvPr id="{pic_id}" name="{name}" descr="{descr}"/>'
        '<pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr>'
        '</pic:nvPicPr>'
        '<pic:blipFill>'
        f'<a:blip r:embed="{rid}" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>'
        '<a:srcRect/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        '<pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/>'
        f'<a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
    )

# Insert each drawing paragraph immediately before the <w:p ... paraId="..." ...>
# Sort by descending paragraph position so insertions don't shift earlier offsets.
positions = []
for paraId, rid, media_name, descr, cx, cy in inserts:
    pat = re.compile(rf'<w:p\b[^>]*paraId="{paraId}"[^>]*>')
    m = pat.search(doc_xml)
    if not m:
        print(f"WARN: paraId {paraId} not found")
        continue
    positions.append((m.start(), paraId, rid, descr, cx, cy, media_name))

positions.sort(key=lambda t: -t[0])

for pos, paraId, rid, descr, cx, cy, media_name in positions:
    drawing = make_drawing_p(rid, cx, cy, media_name, descr)
    doc_xml = doc_xml[:pos] + drawing + doc_xml[pos:]
    print(f"Inserted before paraId={paraId} ({cx}x{cy} EMU) rid={rid}")

members["word/document.xml"] = doc_xml.encode("utf-8")
members["word/_rels/document.xml.rels"] = new_rels_xml.encode("utf-8")

TMP = DOCX + ".tmp"
with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for n, d in members.items(): zout.writestr(n, d)
shutil.move(TMP, DOCX)
print("Done.")
