"""Move a footprint and drag the track ends that sit in its pads. Run under KiCad 10's Python:

    python.exe movefp.py board.kicad_pcb REF DX DY        (mm)

Used for small passives that pin a dense spot, like C108 on the 0p5x1. Run rev0fix afterwards: it
refills, rebuilds the teardrops and checks DRC.
"""
import sys
import wx
app = wx.App(False); wx.Log.SetActiveTarget(wx.LogStderr())   # stops KiCad's font pop-up
import pcbnew

board, ref, dx, dy = sys.argv[1], sys.argv[2], pcbnew.FromMM(float(sys.argv[3])), pcbnew.FromMM(float(sys.argv[4]))
b = pcbnew.LoadBoard(board)
fp = b.FindFootprintByReference(ref)
if fp is None:
    sys.exit(f"no footprint {ref}")
plan = []
for pad in fp.Pads():
    for t in b.GetTracks():
        if t.GetClass() != "PCB_TRACK" or t.GetNetCode() != pad.GetNetCode():
            continue
        for get, set_ in ((t.GetStart, t.SetStart), (t.GetEnd, t.SetEnd)):
            p = get()
            if pad.GetBoundingBox().Contains(p) and pad.GetLayerSet().Contains(t.GetLayer()):
                plan.append((set_, pcbnew.VECTOR2I(p.x + dx, p.y + dy)))
p = fp.GetPosition()
fp.SetPosition(pcbnew.VECTOR2I(p.x + dx, p.y + dy))
for set_, q in plan:
    set_(q)
pcbnew.SaveBoard(board, b)
print(f"moved {ref} by ({sys.argv[3]}, {sys.argv[4]}) mm with {len(plan)} track ends")
