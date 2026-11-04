#!/usr/bin/env python3
"""Rebuild art/assets.json: the rocket outlines, text glyphs and QR matrix.

Only needed when the logo, font or QR target changes. generate_demo_panel.py reads
the JSON, so it runs on KiCad's bundled Python with no extra packages.

Needs: pip install fonttools qrcode, plus Audiowide-Regular.ttf from Google Fonts.

Usage:
  python prepare_assets.py path/to/Audiowide-Regular.ttf
"""

import json
import re
import string
import sys
from pathlib import Path

import qrcode
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
SOURCE_PANEL = HERE.parent / "panel.kicad_pcb"
OUTPUT = HERE / "art" / "assets.json"

QR_TEXT = "HTTPS://WAFER.SPACE"     # Upper case fits QR alphanumeric mode, so version 1.
GLYPHS = string.ascii_letters + string.digits + " .,:/-_&'"
CURVE_STEPS = 4


def logo_polygons():
    """Rocket artwork from the Symbol:waferspace_pin1_silk footprint, in mm."""
    text = SOURCE_PANEL.read_text(encoding="utf-8")
    start = text.index('(footprint "Symbol:waferspace_pin1_silk"')
    footprint = text[start:text.index("\n\t(footprint ", start + 1)]
    polygons = []
    for chunk in footprint.split("(fp_poly")[1:]:
        points = re.findall(r"\(xy ([-\d.e]+) ([-\d.e]+)\)", chunk)
        polygons.append([[float(x), float(y)] for x, y in points])
    return polygons


def flatten_glyph(glyph_set, name):
    """Glyph contours as polylines, with quadratic and cubic curves sampled."""
    pen = DecomposingRecordingPen(glyph_set)
    glyph_set[name].draw(pen)
    contours, current = [], []

    def sample(p0, controls):
        # De Casteljau on the control polygon, skipping the first point.
        for step in range(1, CURVE_STEPS + 1):
            t = step / CURVE_STEPS
            pts = [p0, *controls]
            while len(pts) > 1:
                pts = [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
                       for a, b in zip(pts, pts[1:])]
            current.append(pts[0])

    for op, args in pen.value:
        if op == "moveTo":
            current = [args[0]]
        elif op == "lineTo":
            current.append(args[0])
        elif op == "qCurveTo":
            # TrueType implied on-curve points between consecutive off-curve points.
            off = list(args[:-1])
            for i, ctrl in enumerate(off):
                if i < len(off) - 1:
                    nxt = off[i + 1]
                    end = ((ctrl[0] + nxt[0]) / 2, (ctrl[1] + nxt[1]) / 2)
                else:
                    end = args[-1]
                sample(current[-1], [ctrl, end])
        elif op == "curveTo":
            sample(current[-1], list(args))
        elif op in ("closePath", "endPath"):
            if len(current) > 2:
                contours.append([[round(x, 2), round(y, 2)] for x, y in current])
            current = []
    return contours


def font_outlines(path):
    font = TTFont(path)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    glyphs = {}
    for char in GLYPHS:
        name = cmap[ord(char)]
        glyphs[char] = {"advance": font["hmtx"][name][0],
                        "contours": flatten_glyph(glyph_set, name)}
    return {"units_per_em": font["head"].unitsPerEm, "glyphs": glyphs}


def qr_matrix():
    code = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M,
                         border=0)
    code.add_data(QR_TEXT, optimize=0)
    code.make(fit=False)
    return ["".join("1" if m else "0" for m in row) for row in code.get_matrix()]


def main():
    assets = {"logo": logo_polygons(),
              "font": font_outlines(sys.argv[1]),
              "qr": {"text": QR_TEXT, "rows": qr_matrix()}}
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps(assets, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size // 1024} kB)")


if __name__ == "__main__":
    main()
