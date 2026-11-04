#!/usr/bin/env python3
"""Render the demo panel, a close-up of one board, and a simulated glob top.

Run with KiCad's bundled Python, after generate_demo_panel.py and the zone refill:
  "C:\\Program Files\\KiCad\\10.0\\bin\\python.exe" render_demo.py

The glob top is a render-only 3D model added to a temporary copy of the board, so it
never reaches demo-panel.kicad_pcb or the fab outputs. Single boards are built from
../../1x1-mezzanine.kicad_pcb, which is the same layout as one panel cell.
"""

import math
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
RENDERS = HERE / "renders"
PANEL = HERE / "demo-panel.kicad_pcb"
SINGLE_SOURCE = HERE.parent.parent / "1x1-mezzanine.kicad_pcb"
KICAD_BIN = Path(os.environ.get("KICAD_BIN", r"C:\Program Files\KiCad\10.0\bin"))
FINISH = "black_on_gold"

# The source boards reference the connector through this variable; pass it through.
MODEL_DIR = os.environ.get("KICAD9_3DMODEL_DIR")

GLOB_HX, GLOB_HY = 5.0, 5.4     # Just over the mask opening (mm).
GLOB_HEIGHT = 1.1
VRML_UNITS_PER_MM = 1 / 2.54    # KiCad reads VRML in tenths of an inch.

ISO = "-45,0,18"


def kicad_cli(*args):
    cmd = [str(KICAD_BIN / "kicad-cli.exe"), *args]
    if MODEL_DIR:
        cmd[-1:-1] = ["-D", f"KICAD9_3DMODEL_DIR={MODEL_DIR}"]
    print("  " + " ".join(str(a) for a in args[-3:]), flush=True)
    subprocess.run(cmd, check=True, capture_output=True, text=True)


def render(board, output, side="top", width=1600, height=1200, zoom=1.0, rotate=None, floor=False):
    args = ["pcb", "render", "--side", side, "--width", str(width), "--height", str(height),
            "--quality", "high", "--background", "opaque", "--zoom", str(zoom)]
    if rotate:
        args += ["--perspective", "--rotate", rotate]
    if floor:
        args += ["--floor"]
    kicad_cli(*args, "-o", str(output), str(board))


def glob_vrml(path):
    """A superelliptical epoxy dome as a smooth, glassy VRML mesh."""
    rings, spokes = 28, 96
    points, normals, faces = [], [], []

    def surface(u, v):
        # u runs from the rim to the apex, v around the dome.
        c, s = math.cos(v), math.sin(v)
        x = math.copysign(abs(c) ** 0.35, c) * math.cos(u) * GLOB_HX
        y = math.copysign(abs(s) ** 0.35, s) * math.cos(u) * GLOB_HY
        return x, y, math.sin(u) * GLOB_HEIGHT

    for ring in range(rings + 1):
        u = (math.pi / 2) * ring / rings
        for spoke in range(spokes):
            v = 2 * math.pi * spoke / spokes
            x, y, z = surface(u, v)
            points.append((x, y, z))
            nx, ny = x / GLOB_HX ** 2, y / GLOB_HY ** 2
            nz = z / GLOB_HEIGHT ** 2
            length = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            normals.append((nx / length, ny / length, nz / length))
    for ring in range(rings):
        for spoke in range(spokes):
            a = ring * spokes + spoke
            b = ring * spokes + (spoke + 1) % spokes
            c = (ring + 1) * spokes + (spoke + 1) % spokes
            d = (ring + 1) * spokes + spoke
            faces.append(f"{a},{b},{c},-1,{a},{c},{d},-1")

    scale = VRML_UNITS_PER_MM
    path.write_text(
        "#VRML V2.0 utf8\nShape {\n appearance Appearance { material Material {\n"
        "  diffuseColor 0.96 0.97 0.98\n  specularColor 1 1 1\n  ambientIntensity 0.2\n"
        "  shininess 0.95\n  transparency 0.95\n } }\n"
        " geometry IndexedFaceSet {\n  solid FALSE\n  creaseAngle 3.14\n"
        "  coord Coordinate { point ["
        + ",".join(f"{x * scale:.5f} {y * scale:.5f} {z * scale:.5f}" for x, y, z in points)
        + "] }\n  normal Normal { vector ["
        + ",".join(f"{x:.4f} {y:.4f} {z:.4f}" for x, y, z in normals)
        + "] }\n  coordIndex [" + ",".join(faces) + "]\n }\n}\n",
        encoding="utf-8")


def with_glob_top(board, output, model):
    """A copy of a board with the dome added to every finish footprint."""
    text = board.read_text(encoding="utf-8")
    block = (f'\t\t(model "{model.as_posix()}"\n\t\t\t(offset\n\t\t\t\t(xyz 0 0 0)\n\t\t\t)\n'
             '\t\t\t(scale\n\t\t\t\t(xyz 1 1 1)\n\t\t\t)\n'
             '\t\t\t(rotate\n\t\t\t\t(xyz 0 0 0)\n\t\t\t)\n\t\t)\n')
    parts = re.split(r"(?m)^(?=\t\()", text)
    for i, part in enumerate(parts):
        if part.startswith('\t(footprint "demo:'):
            parts[i] = part[:part.rindex("\t)")] + block + part[part.rindex("\t)"):]
    output.write_text("".join(parts), encoding="utf-8", newline="\n")
    shutil.copy(board.with_suffix(".kicad_pro"), output.with_suffix(".kicad_pro"))


def build_single(finish, folder):
    output = folder / f"{finish}.kicad_pcb"
    subprocess.run([str(KICAD_BIN / "python.exe"), str(HERE / "generate_demo_panel.py"),
                    "--source", str(SINGLE_SOURCE), "--output", str(output),
                    "--finish", finish], check=True, capture_output=True, text=True)
    kicad_cli("pcb", "drc", "--refill-zones", "--save-board", "--format", "json",
              "-o", str(folder / f"{finish}.json"), str(output))
    return output


def main():
    RENDERS.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        model = folder / "glob_top.wrl"
        glob_vrml(model)

        render(PANEL, RENDERS / "panel-top.png", width=2000, height=1900, zoom=1.0)
        render(PANEL, RENDERS / "panel-bottom.png", side="bottom", width=2000, height=1900, zoom=1.0)
        render(PANEL, RENDERS / "panel-iso.png", width=2400, height=1600, zoom=0.72,
               rotate=ISO, floor=True)
        glob_panel = folder / "panel_glob.kicad_pcb"
        with_glob_top(PANEL, glob_panel, model)
        render(glob_panel, RENDERS / "panel-iso-glob.png", width=2400, height=1600, zoom=0.72,
               rotate=ISO, floor=True)

        board = build_single(FINISH, folder)
        render(board, RENDERS / "board-top.png", width=1200, height=1300, zoom=1.1)
        render(board, RENDERS / "board-bottom.png", side="bottom", width=1200, height=1300, zoom=1.1)
        glob = folder / "board_glob.kicad_pcb"
        with_glob_top(board, glob, model)
        render(glob, RENDERS / "board-glob.png", width=1400, height=1100, zoom=0.72,
               rotate=ISO, floor=True)

        # Score lines over the silkscreen, to check nothing straddles them.
        for side, layers, extra in (("front", "F.Silkscreen,User.1,Edge.Cuts", []),
                                    ("back", "B.Silkscreen,User.1,Edge.Cuts", ["--mirror"])):
            kicad_cli("pcb", "export", "svg", "--layers", layers, "--mode-single",
                      "--page-size-mode", "2", "--exclude-drawing-sheet", *extra,
                      "-o", str(RENDERS / f"vcut-check-{side}.svg"), str(PANEL))


if __name__ == "__main__":
    main()
