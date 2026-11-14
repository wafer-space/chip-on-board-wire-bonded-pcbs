"""Hand fix: move a via or a track corner by a small offset, dragging the track ends that sit on it.

    "C:\\Program Files\\KiCad\\10.0\\bin\\python.exe" nudge.py board.kicad_pcb X,Y,DX,DY [X,Y,DX,DY ...]

Every via centred at (X, Y) and every track end at (X, Y) (within 1 um) moves by (DX, DY) mm.
Run `kicad-cli pcb drc --refill-zones --save-board` afterwards to refill the pour and rebuild teardrops.
"""
import sys
import wx
app = wx.App(False); wx.Log.SetActiveTarget(wx.LogStderr())   # keeps KiCad's font pop-up from hanging the run
import pcbnew

board_path = sys.argv[1]
b = pcbnew.LoadBoard(board_path)
F = pcbnew.FromMM
TOL = F(0.001)


def near(p, x, y):
    return abs(p.x - x) <= TOL and abs(p.y - y) <= TOL


for arg in sys.argv[2:]:
    x, y, dx, dy = (float(v) for v in arg.split(","))
    X, Y, DX, DY = F(x), F(y), F(dx), F(dy)
    nv = nt = 0
    for t in b.GetTracks():
        if t.GetClass() == "PCB_VIA":
            if near(t.GetPosition(), X, Y):
                t.SetPosition(pcbnew.VECTOR2I(X + DX, Y + DY)); nv += 1
            continue
        if near(t.GetStart(), X, Y):
            t.SetStart(pcbnew.VECTOR2I(t.GetStart().x + DX, t.GetStart().y + DY)); nt += 1
        if near(t.GetEnd(), X, Y):
            t.SetEnd(pcbnew.VECTOR2I(t.GetEnd().x + DX, t.GetEnd().y + DY)); nt += 1
    print(f"({x}, {y}) by ({dx}, {dy}): {nv} via, {nt} track ends")
    if nv + nt == 0:
        sys.exit(f"nothing found at ({x}, {y})")
pcbnew.SaveBoard(board_path, b)
