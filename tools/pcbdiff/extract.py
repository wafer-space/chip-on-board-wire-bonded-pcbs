"""Dump a .kicad_pcb to JSON for pcbdiff. Runs under KiCad 10's bundled Python.

    "C:/Program Files/KiCad/10.0/bin/python.exe" extract.py board.kicad_pcb out.json

Writes: board outline bbox, copper layers, design rules, tracks, vias, pads (with copper
polygons), footprints, zones (settings + filled copper), and every hole-wall-to-copper gap
and hole-to-hole gap under GAP_MM, keyed by KiCad UUIDs so two revisions can be matched.
"""
import sys, json, math

import wx
_app = wx.App(False)
wx.Log.SetActiveTarget(wx.LogStderr())   # missing fonts otherwise pop a modal box and hang
import pcbnew

GAP_MM = 0.30
src, dst = sys.argv[1], sys.argv[2]
mm = pcbnew.ToMM
b = pcbnew.LoadBoard(src)
ds = b.GetDesignSettings()
cu_layers = list(b.GetEnabledLayers().CuStack())
L = pcbnew.LayerName
uid = lambda o: o.m_Uuid.AsString()


def pts_of(chain):
    return [(round(mm(chain.CPoint(i).x), 5), round(mm(chain.CPoint(i).y), 5))
            for i in range(chain.PointCount())]


def polyset(sps):
    """SHAPE_POLY_SET -> list of polygons, each [outline, hole, hole...]."""
    out = []
    for oi in range(sps.OutlineCount()):
        poly = [pts_of(sps.COutline(oi))]
        for hi in range(sps.HoleCount(oi)):
            poly.append(pts_of(sps.CHole(oi, hi)))
        out.append(poly)
    return out


bb = b.GetBoardEdgesBoundingBox()
out = {
    "file": src,
    "bbox": [mm(bb.GetLeft()), mm(bb.GetTop()), mm(bb.GetRight()), mm(bb.GetBottom())],
    "layers": [L(l) for l in cu_layers],
    "rules": {
        "min_clearance": mm(ds.m_MinClearance), "min_track_width": mm(ds.m_TrackMinWidth),
        "min_hole_clearance": mm(ds.m_HoleClearance), "min_hole_to_hole": mm(ds.m_HoleToHoleMin),
        "min_through_hole": mm(ds.m_MinThroughDrill), "min_via_annular": mm(ds.m_ViasMinAnnularWidth),
        "min_via_diameter": mm(ds.m_ViasMinSize), "copper_edge_clearance": mm(ds.m_CopperEdgeClearance),
    },
    "tracks": [], "vias": [], "pads": [], "footprints": [], "zones": [], "gaps": [],
}

tracks, vias = [], []
for t in b.GetTracks():
    c = t.GetClass()
    if c == "PCB_VIA":
        vias.append(t)
        p = t.GetPosition()
        out["vias"].append(dict(uuid=uid(t), x=mm(p.x), y=mm(p.y), d=mm(t.GetWidth(pcbnew.F_Cu)),
                                drill=mm(t.GetDrillValue()), net=t.GetNetname(),
                                layers=[L(l) for l in cu_layers if t.FlashLayer(l)]))
    elif c in ("PCB_TRACK", "PCB_ARC"):
        tracks.append(t)
        s, e = t.GetStart(), t.GetEnd()
        row = dict(uuid=uid(t), layer=t.GetLayerName(), net=t.GetNetname(), w=mm(t.GetWidth()),
                   x1=mm(s.x), y1=mm(s.y), x2=mm(e.x), y2=mm(e.y))
        if c == "PCB_ARC":
            m = t.GetMid(); row["mid"] = (mm(m.x), mm(m.y))
            try:
                row["pts"] = pts_of(pcbnew.SHAPE_ARC(s, m, e, 0).ConvertToPolyline())
            except Exception:
                row["pts"] = [(row["x1"], row["y1"]), row["mid"], (row["x2"], row["y2"])]
        out["tracks"].append(row)

pads = []
for fp in b.GetFootprints():
    p = fp.GetPosition()
    out["footprints"].append(dict(uuid=uid(fp), ref=fp.GetReference(), value=fp.GetValue(),
                                  x=mm(p.x), y=mm(p.y), rot=fp.GetOrientationDegrees(),
                                  side="B" if fp.IsFlipped() else "F"))
    for pad in fp.Pads():
        pads.append(pad)
        pp = pad.GetPosition()
        polys = {}
        for l in cu_layers:
            if pad.IsOnLayer(l) and pad.FlashLayer(l):
                polys[L(l)] = polyset(pad.GetEffectivePolygon(l, pcbnew.ERROR_INSIDE))
        hole = None
        if pad.GetDrillSize().x > 0:
            hs = pad.GetEffectiveHoleShape(); sg = hs.GetSeg()
            hole = [mm(sg.A.x), mm(sg.A.y), mm(sg.B.x), mm(sg.B.y), mm(hs.GetWidth())]
        clr = 0.0
        for l in cu_layers:
            if pad.IsOnLayer(l):
                try:
                    clr = max(clr, mm(pad.GetOwnClearance(l)))
                except Exception:
                    pass
        out["pads"].append(dict(uuid=uid(pad), ref=fp.GetReference(), num=pad.GetNumber(),
                                x=mm(pp.x), y=mm(pp.y), net=pad.GetNetname(), polys=polys, hole=hole, clr=clr))

# copper graphics (logos, shapes, text on copper layers) in footprints and on the board: fixed obstacles
out["graphics"] = []
_cu_ids = set(cu_layers)
for owner, items in [(fp.GetReference(), list(fp.GraphicalItems())) for fp in b.GetFootprints()] + \
                    [("", list(b.GetDrawings()))]:
    for g in items:
        l = g.GetLayer()
        if l not in _cu_ids:
            continue
        sps = pcbnew.SHAPE_POLY_SET()
        try:
            g.TransformShapeToPolygon(sps, l, 0, pcbnew.FromMM(0.002), pcbnew.ERROR_INSIDE)
        except Exception:
            continue
        try:
            sps.Simplify()
        except Exception:
            pass
        if sps.OutlineCount():
            out["graphics"].append(dict(uuid=uid(g), ref=owner, layer=L(l), net=g.GetNetname() if hasattr(g, "GetNetname") else "",
                                        polys=polyset(sps)))

for z in b.Zones():
    fills = {}
    for l in z.GetLayerSet().CuStack():
        if z.HasFilledPolysForLayer(l):
            fills[L(l)] = polyset(z.GetFilledPolysList(l))
    out["zones"].append(dict(uuid=uid(z), name=z.GetZoneName(), net=z.GetNetname(),
                             teardrop=z.IsTeardropArea(), layers=[L(l) for l in z.GetLayerSet().CuStack()],
                             clearance=mm(z.GetLocalClearance()) if z.GetLocalClearance() is not None else None,
                             min_thickness=mm(z.GetMinThickness()), priority=z.GetAssignedPriority(),
                             outline=polyset(z.Outline()), fills=fills))


# ---------------- hole gaps (same maths as the shove script)
def pt_seg(px, py, x1, y1, x2, y2):
    vx, vy = x2 - x1, y2 - y1
    l2 = vx * vx + vy * vy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((px - x1) * vx + (py - y1) * vy) / l2))
    return math.hypot(px - x1 - t * vx, py - y1 - t * vy)


def seg_seg(a, b_, c, d):
    def orient(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    if a != b_ and c != d:
        if orient(a, b_, c) * orient(a, b_, d) < 0 and orient(c, d, a) * orient(c, d, b_) < 0:
            return 0.0
    return min(pt_seg(*a, *c, *d), pt_seg(*b_, *c, *d), pt_seg(*c, *a, *b_), pt_seg(*d, *a, *b_))


def inside(pt, ring):
    x, y = pt; c = False; j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


holes = []   # (owner uuid, label, net, a, b, r)
for v in vias:
    p = v.GetPosition()
    holes.append((uid(v), f"via {v.GetNetname()}", v.GetNetname(), (mm(p.x), mm(p.y)), (mm(p.x), mm(p.y)),
                  mm(v.GetDrillValue()) / 2))
for pr, pad in zip([r for r in out["pads"]], pads):
    if pr["hole"]:
        h = pr["hole"]
        holes.append((pr["uuid"], f"{pr['ref']}.{pr['num']} hole", pr["net"], (h[0], h[1]), (h[2], h[3]), h[4] / 2))

feats = []   # (uuid, kind, label, net, layer, kind-specific)
for r in out["tracks"]:
    feats.append((r["uuid"], "track", f"track {r['net']} {r['layer']}", r["net"], r["layer"],
                  ((r["x1"], r["y1"]), (r["x2"], r["y2"]), r["w"] / 2)))
for r in out["vias"]:
    feats.append((r["uuid"], "via", f"via {r['net']} pad", r["net"], "all", ((r["x"], r["y"]), (r["x"], r["y"]), r["d"] / 2)))
for r in out["pads"]:
    rings = [poly[0] for pl in r["polys"].values() for poly in pl]
    if rings:
        feats.append((r["uuid"], "pad", f"{r['ref']}.{r['num']} pad", r["net"], "all", rings))


def near(fa, fb, hole, m):
    xs = [p[0] for p in (fa, fb)]; ys = [p[1] for p in (fa, fb)]
    return not (max(xs) < min(hole[3][0], hole[4][0]) - m or min(xs) > max(hole[3][0], hole[4][0]) + m or
                max(ys) < min(hole[3][1], hole[4][1]) - m or min(ys) > max(hole[3][1], hole[4][1]) + m)


for f in feats:
    fu, kind, flab, fnet, flayer, geo = f
    for h in holes:
        hu, hlab, hnet, ha, hb, hr = h
        if hu == fu or (hnet == fnet and fnet != ""):
            continue
        if kind in ("track", "via"):
            a, bb_, w2 = geo
            if not near(a, bb_, h, w2 + hr + GAP_MM):
                continue
            g = seg_seg(ha, hb, a, bb_) - hr - w2
        else:
            xs = [p[0] for ring in geo for p in ring]; ys = [p[1] for ring in geo for p in ring]
            if not near((min(xs), min(ys)), (max(xs), max(ys)), h, hr + GAP_MM):
                continue
            if any(inside(ha, ring) for ring in geo):
                g = -hr
            else:
                g = min(seg_seg(ha, hb, ring[i - 1], ring[i]) for ring in geo for i in range(len(ring))) - hr
        if g < GAP_MM:
            out["gaps"].append(dict(kind="hole-copper", a=fu, b=hu, a_label=flab, b_label=hlab, layer=flayer,
                                    gap=round(g, 5), x=round((ha[0] + hb[0]) / 2, 3), y=round((ha[1] + hb[1]) / 2, 3)))
# zone fills (GND pour, teardrops) vs other-net holes, via a 0.5 mm grid of fill edges
CELL = 0.5
for z in out["zones"]:
    for lname, polys in z["fills"].items():
        grid = {}
        for poly in polys:
            for ring in poly:
                for i in range(len(ring)):
                    p, q = ring[i - 1], ring[i]
                    for gx in range(int(min(p[0], q[0]) // CELL), int(max(p[0], q[0]) // CELL) + 1):
                        for gy in range(int(min(p[1], q[1]) // CELL), int(max(p[1], q[1]) // CELL) + 1):
                            grid.setdefault((gx, gy), []).append((p, q))
        for h in holes:
            hu, hlab, hnet, ha, hb, hr = h
            if hnet == z["net"] and hnet != "":
                continue
            reach = hr + GAP_MM
            cand = set()
            for gx in range(int((min(ha[0], hb[0]) - reach) // CELL), int((max(ha[0], hb[0]) + reach) // CELL) + 1):
                for gy in range(int((min(ha[1], hb[1]) - reach) // CELL), int((max(ha[1], hb[1]) + reach) // CELL) + 1):
                    cand.update(grid.get((gx, gy), []))
            if not cand:
                continue
            filled = any(inside(ha, poly[0]) and not any(inside(ha, hole_r) for hole_r in poly[1:]) for poly in polys)
            g = -hr if filled else min(seg_seg(ha, hb, p, q) for p, q in cand) - hr
            if g < GAP_MM:
                kind = "teardrop" if z["teardrop"] else "zone"
                out["gaps"].append(dict(kind="hole-copper", a=z["uuid"] + ":" + lname, b=hu,
                                        a_label=f"{kind} {z['net']} {lname}", b_label=hlab, layer=lname,
                                        gap=round(g, 5), x=round((ha[0] + hb[0]) / 2, 3), y=round((ha[1] + hb[1]) / 2, 3)))

for i, h1 in enumerate(holes):
    for h2 in holes[i + 1:]:
        if abs(h1[3][0] - h2[3][0]) > 3 or abs(h1[3][1] - h2[3][1]) > 3:
            continue
        g = seg_seg(h1[3], h1[4], h2[3], h2[4]) - h1[5] - h2[5]
        if g < GAP_MM:
            out["gaps"].append(dict(kind="hole-hole", a=h1[0], b=h2[0], a_label=h1[1], b_label=h2[1], layer="all",
                                    gap=round(g, 5), x=round((h1[3][0] + h2[3][0]) / 2, 3),
                                    y=round((h1[3][1] + h2[3][1]) / 2, 3)))

json.dump(out, open(dst, "w"), separators=(",", ":"))
print(f"tracks {len(out['tracks'])}, vias {len(out['vias'])}, pads {len(out['pads'])}, "
      f"zones {len(out['zones'])}, gaps<{GAP_MM} {len(out['gaps'])}")
