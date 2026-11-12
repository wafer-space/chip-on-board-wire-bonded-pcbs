"""Apply solve.py moves to a board. Run under KiCad 10's Python:
    python.exe apply.py board.kicad_pcb moves.json

Vias are found by UUID and drag the track ends inside them. Corners are found by layer and position.
All new points are computed from the original positions, then applied.
"""
import sys, json, math
import wx
app = wx.App(False); wx.Log.SetActiveTarget(wx.LogStderr())   # stops KiCad's font pop-up
import pcbnew

F = pcbnew.FromMM
b = pcbnew.LoadBoard(sys.argv[1])
moves = json.load(open(sys.argv[2]))["moves"]
tracks = [t for t in b.GetTracks() if t.GetClass() == "PCB_TRACK"]
vias = {t.m_Uuid.AsString(): t for t in b.GetTracks() if t.GetClass() == "PCB_VIA"}
nv = nc = 0
plan = []
for m in moves:
    if m["kind"] == "via":
        v = vias[m["uuid"]]
        old = v.GetPosition(); old = (old.x, old.y)
        dx, dy = F(m["x"]) - old[0], F(m["y"]) - old[1]
        r = v.GetWidth(pcbnew.F_Cu) / 2 - F(0.01)
        for t in tracks:
            if t.GetNetCode() != v.GetNetCode():
                continue
            for get, set_ in ((t.GetStart, t.SetStart), (t.GetEnd, t.SetEnd)):
                p = get()
                if math.hypot(p.x - old[0], p.y - old[1]) <= r:
                    plan.append((set_, pcbnew.VECTOR2I(p.x + dx, p.y + dy)))
        plan.append((v.SetPosition, pcbnew.VECTOR2I(F(m["x"]), F(m["y"])))); nv += 1
    else:
        x0, y0 = F(m["x0"]), F(m["y0"])
        hit = 0
        for t in tracks:
            if t.GetLayerName() != m["layer"]:
                continue
            for get, set_ in ((t.GetStart, t.SetStart), (t.GetEnd, t.SetEnd)):
                p = get()
                if abs(p.x - x0) <= 100 and abs(p.y - y0) <= 100:   # within 0.1 um
                    plan.append((set_, pcbnew.VECTOR2I(F(m["x"]), F(m["y"])))); hit += 1
        if hit == 0:
            sys.exit(f"corner not found: {m}")
        nc += 1
for set_, p in plan:
    set_(p)
pcbnew.SaveBoard(sys.argv[1], b)
print(f"moved {nv} vias, {nc} corners, {len(plan) - nv} track ends")
