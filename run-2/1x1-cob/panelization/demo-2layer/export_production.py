#!/usr/bin/env python3
"""Export production/demo-panel.zip: gerbers and drill files for the refilled board.

Run with KiCad's bundled Python, after generate_demo_panel.py and the zone refill:
  "C:\\Program Files\\KiCad\\10.0\\bin\\python.exe" export_production.py

Matches what Fabrication Toolkit produced for ../panel.kicad_pcb, including merging the
User.1 score lines into Edge_Cuts so the fab can see the V-cuts. Assembly files are
left out because the demo boards are not assembled.
"""

import os
import subprocess
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
PANEL = HERE / "demo-panel.kicad_pcb"
OUTPUT = HERE / "production" / "demo-panel.zip"
KICAD_BIN = Path(os.environ.get("KICAD_BIN", r"C:\Program Files\KiCad\10.0\bin"))
LAYERS = "F.Cu,B.Cu,F.Paste,B.Paste,F.Silkscreen,B.Silkscreen,F.Mask,B.Mask"


def kicad_cli(*args):
    subprocess.run([str(KICAD_BIN / "kicad-cli.exe"), *args, str(PANEL)], check=True,
                   capture_output=True, text=True)


def main():
    OUTPUT.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        folder = f"{tmp}{os.sep}"
        kicad_cli("pcb", "export", "gerbers", "--layers", LAYERS, "--use-drill-file-origin",
                  "-o", folder)
        kicad_cli("pcb", "export", "gerbers", "--layers", "Edge.Cuts", "--common-layers", "User.1",
                  "--use-drill-file-origin", "-o", folder)
        kicad_cli("pcb", "export", "drill", "--excellon-separate-th", "--drill-origin", "plot",
                  "--generate-map", "--map-format", "gerberx2", "-o", folder)
        with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(Path(tmp).iterdir()):
                if path.suffix != ".gbrjob":
                    archive.write(path, path.name)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
