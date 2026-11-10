# pcbdiff

Shows what changed in a KiCad board between two git revisions: what moved, by how much, and what that did to the hole clearances NextPCB checks.

## Run it

From anywhere in the repo:

```
git pcbdiff                    # HEAD vs your unsaved-to-git working copy, every changed board
git pcbdiff HEAD~1 HEAD        # the last commit
git pcbdiff 3452d41 2f0473e    # any two commits
git pcbdiff HEAD -b run-2/1x1-cob/1x1-mezzanine.kicad_pcb --open
```

`git pcbdiff` is a repo-local alias for `python tools/pcbdiff/pcbdiff.py`. To set it up in a fresh clone, run `git config alias.pcbdiff "!python tools/pcbdiff/pcbdiff.py"`.

Options:
- `-b` names a board (repeatable). Without it, every `.kicad_pcb` whose board or project file changed is diffed.
- `--target 0.23` sets the hole-to-copper target in mm.
- `--hole-hole 0.254` sets the hole-to-hole target in mm.
- `--open` opens the report in the browser.

It takes about 40 s per board.

## What you get

`.pcbdiff/<board>__<A>__<B>/index.html` (git ignores this folder), with:

- **Gaps under target, A vs B**, by copper type: track, via pad, footprint pad, GND pour, teardrop, and hole to hole.
- **Board Setup rule changes**, read from the `.kicad_pro`, and **zone changes** (settings and which layers' fill changed).
- **Vias, tracks and footprints** that moved, were added or were removed, with the distance moved. Items are matched by KiCad's UUIDs. A track that was split shows up as moved plus added.
- **Every hole gap that changed** and was under target on either side, before → after. Each is marked new failure, worse, better but still under, or fixed.
- **One overlay per copper layer:** grey is unchanged, red is copper only in A (removed), green is copper only in B (added). Yellow boxes mark the zoomed crops. Each crop prints each hole's smallest changed gap A→B: white if it passes in B, yellow if it's still under.

## How it works

- `pcbdiff.py` pulls the board and its `.kicad_pro` out of each revision with `git show`. The `.kicad_pro` matters: without it KiCad falls back to default rules.
- It runs `extract.py` under KiCad 10's Python, which dumps all copper, the rules, and every hole gap under 0.30 mm. Then it compares the two dumps.
- Gaps are hole wall to copper edge, the same measure KiCad's `hole_clearance` DRC uses. A via pair counts twice: each via's pad to the other's hole.
- It needs KiCad 10 at `C:\Program Files\KiCad\10.0` (or set `KICAD_PYTHON`), plus `matplotlib` and `Pillow` in the Python that runs `pcbdiff.py`.
