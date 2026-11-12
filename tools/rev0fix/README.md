# rev0fix

Moves vias and track corners just enough for a board to pass NextPCB Rev 0's hole checks. It then refills, rebuilds the teardrops, checks the result with KiCad's DRC, and can export the upload zip.

```
python tools/rev0fix/rev0fix.py run-2/1x1-cob/1x1-mezzanine.kicad_pcb --export v3
```

Options (all in mm):

| option | default | what |
|---|---|---|
| `--via` | 0.25 | via hole wall to other-net copper |
| `--pth` | 0.31 | pad (component) hole wall to other-net copper |
| `--hh` | 0.254 | hole to hole, same net |
| `--hh-diff` | 0.3048 | hole to hole, different nets |
| `--rounds` | 4 | solve, apply and DRC rounds before giving up |
| `--export TAG` | off | write `production/<board>_REV0-UPLOAD_<date>_<TAG>.zip` |

## Why two hole clearances

Rev 0 flagged component (pad) holes at 0.233 mm and then at 0.253 mm from a trace, while vias at 0.23 mm passed. NextPCB's standard limits also split these: 7 mil from a via hole wall, 9 mil from a component-hole wall. KiCad's Board Setup has only one hole clearance. So the via value goes in the `.kicad_pro`, and the pad-hole value goes in a custom rule in the board's `.kicad_dru`, between `rev0fix` markers.

## What it does

1. **Rules.** Writes the values above into the `.kicad_pro` and `.kicad_dru`. KiCad's DRC and zone filler use them from then on.
2. **Rounds.**
   - `tools/pcbdiff/extract.py` dumps the geometry.
   - `solve.py` finds the smallest moves of vias and free track corners that meet every aim. The aims are the hole clearances above plus 0.10 mm copper clearance, each with a 3 µm margin. Track ends in a via move with the via. Pads and footprints never move. Nothing moves more than 0.2 mm per axis.
   - `apply.py` writes the moves.
   - `kicad-cli pcb drc --refill-zones --save-board` refills the zones and rebuilds the teardrops to fit the moved tracks. Some teardrops may be dropped if they no longer fit.
   - The loop stops when DRC shows none of the blocking types (hole, copper and edge clearance, connection width and similar).
3. **Export.** Runs Fabrication Toolkit with zone fill off, so the Gerbers are exactly what DRC checked. It then drops the drill maps and an empty NPTH file, which matches the zip Rev 0 accepted, and removes the toolkit's BOM, position and backup files.

If the solver reports `NEEDS HAND REROUTE`, a track that runs pad to pad sits too close to a hole and has no free corner to move. Fix those in KiCad and run again.

Work files go to `.rev0fix/<board>/`. Run `git pcbdiff` afterwards to see what moved.

Needs KiCad 10 at `C:\Program Files\KiCad\10.0` (or set `KICAD_BIN`), `numpy` and `scipy`, and Fabrication Toolkit for `--export`.
