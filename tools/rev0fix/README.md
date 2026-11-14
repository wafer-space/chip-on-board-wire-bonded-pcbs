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
| `--reach` | 0.2 | most a via or corner may move per axis, per round |
| `--near` | 0.15 | how far beyond its aim a pair is still watched. Raise it (to about 2 to 3 × reach) on dense boards, so tracks that start far apart can't be moved into each other. Slower. |
| `--ignore-fp REF` | none | disregard hole spacing (hole clearance, hole to hole) to this footprint. Repeatable. Used for `U102` on the 0p5x1. |
| `--ignore-cu MM` | 0.10 | copper clearance to the `--ignore-fp` footprints. Lowers Board Setup's minimum clearance to match, because custom rules can't go under it. The netclass clearance still holds everywhere else. A pad's own larger clearance (the die-pad holes' 0.18) is kept. |

| `--edge MM` | board's own (0.5) | copper-to-edge clearance for vias and tracks. Zones keep the board's original value through a custom rule, so the pour doesn't move. NextPCB's own limit to a V-cut is 0.4 mm. |

Copper graphics, such as the rocket logo, are fixed obstacles that need copper clearance. Each pad's own clearance is kept if it is larger than 0.10.

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

Two guards keep the pour connected. A via may not move closer to a pad that only the pour feeds. An item near the board edge may move toward it only while the pour strip between them stays 0.25 mm wide, or as wide as it is now if it is already narrower.

### Hand fixes

- `movefp.py board REF DX DY` moves a footprint and drags the track ends on its pads. On the 0p5x1 it moved C108 0.095 mm left, so the solver had room.
- `nudge.py board X,Y,DX,DY ...` moves the via or track corner at (X, Y) and drags the track ends on it. Run `kicad-cli pcb drc --refill-zones --save-board` afterwards.
- When DRC is already clean, `rev0fix.py --export TAG` runs no rounds. It exports the board as it is, so the hand fixes are kept.

Work files go to `.rev0fix/<board>/`. Run `git pcbdiff` afterwards to see what moved.

Needs KiCad 10 at `C:\Program Files\KiCad\10.0` (or set `KICAD_BIN`), `numpy` and `scipy`, and Fabrication Toolkit for `--export`.
