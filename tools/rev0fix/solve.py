"""Move vias and free track corners as little as possible so every hole and copper clearance is met.

    python solve.py extract.json moves.json [--via 0.25] [--pth 0.31] [--hh 0.254] [--reach 0.2]

extract.json comes from tools/pcbdiff/extract.py. Variables: every via, plus every free track corner
(not inside a same-net pad or via, not on another same-net track's centreline) near a shortfall.
Track ends inside a via move with the via. Pads and footprints never move.

Aims (each + 3 um margin):
  via hole wall to other-net copper        --via
  pad (component) hole wall to other-net copper  --pth   (Rev 0 is stricter on these than on vias)
  same-net hole to hole                    --hh
  copper to copper                         0.10, or where it already is if that's tighter
Penalty method with exact gradients: min sum|d|^2 + K * sum max(0, aim - dist)^2, K raised in stages.
"""
import argparse, json, math
import numpy as np
from scipy.optimize import minimize

ap = argparse.ArgumentParser()
ap.add_argument("extract"); ap.add_argument("out")
ap.add_argument("--via", type=float, default=0.25, help="via hole to copper, mm")
ap.add_argument("--pth", type=float, default=0.31, help="pad hole to copper, mm")
ap.add_argument("--hh", type=float, default=0.254, help="same-net hole to hole, mm")
ap.add_argument("--cu", type=float, default=0.10, help="copper to copper, mm")
ap.add_argument("--edge", type=float, default=0.5, help="copper to board edge, mm")
ap.add_argument("--reach", type=float, default=0.2, help="max move per axis, mm")
ap.add_argument("--samples", type=int, default=15, help="points checked along each track")
A = ap.parse_args()

D = json.load(open(A.extract))
M = 0.003
G, PG, CU, HH = A.via + M, A.pth + M, A.cu + M, A.hh + M
NEAR = 0.15
HOT_R = 1.0

vias = D["vias"]
nv = len(vias)
pads = []
for p in D["pads"]:
    rings = {l: [np.array(poly[0]) for poly in pl] for l, pl in p["polys"].items()}
    hole = None
    if p["hole"]:
        hole = (np.array([(p["hole"][0] + p["hole"][2]) / 2, (p["hole"][1] + p["hole"][3]) / 2]), p["hole"][4] / 2)
    allr = [r for rs in rings.values() for r in rs]
    if allr or hole:
        allpts = np.vstack(allr) if allr else hole[0][None, :]
        pads.append(dict(net=p["net"], rings=rings, allrings=allr, hole=hole,
                         bb=(allpts.min(0) - 0.01, allpts.max(0) + 0.01), name=f"{p['ref']}.{p['num']}"))


def pt_seg(p, a, b):
    ab = b - a
    l2 = ab @ ab
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((p - a) @ ab) / l2))
    d = p - (a + t * ab)
    n = math.hypot(*d)
    return n, (d / n if n > 1e-12 else np.zeros(2)), t


def inside(p, ring):
    x, y = p; c = False; j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c


def seg_seg(a, b, c, d):
    """Exact distance between segments ab and cd (they never cross on one layer of a DRC-clean board)."""
    return min(pt_seg(a, c, d)[0], pt_seg(b, c, d)[0], pt_seg(c, a, b)[0], pt_seg(d, a, b)[0])


def seg_poly(a, b, ring, samples):
    """Track centreline to pad outline: points along the track, plus every pad vertex to the track."""
    return min(min(pt_poly(a + s * (b - a), ring)[0] for s in samples),
               min(pt_seg(q, a, b)[0] for q in ring))


def pt_poly(p, ring):
    best = (9e9, None)
    for i in range(len(ring)):
        d, u, _ = pt_seg(p, ring[i - 1], ring[i])
        if d < best[0]:
            best = (d, u)
    return (-best[0], -best[1]) if inside(p, ring) else best


# ---------------- variables: vias first, then free corners
X0 = [np.array([v["x"], v["y"]]) for v in vias]
vtype = ["via"] * nv
vinfo = [dict(uuid=v["uuid"], net=v["net"]) for v in vias]
raw = [t for t in D["tracks"] if not t.get("mid")]
corner_ix = {}


def via_of(x, y, net):
    best = None
    for i, v in enumerate(vias):
        if v["net"] == net:
            d = math.hypot(x - v["x"], y - v["y"])
            if d <= v["d"] / 2 - 0.01 and (best is None or d < best[1]):
                best = (i, d)
    return None if best is None else best[0]


def in_pad(x, y, net, layer):
    for p in pads:
        if p["net"] == net and layer in p["rings"]:
            if any(inside((x, y), r) for r in p["rings"][layer]):
                return True
    return False


def on_centreline(x, y, net, layer):
    for t in raw:
        if t["net"] == net and t["layer"] == layer:
            a, b = np.array([t["x1"], t["y1"]]), np.array([t["x2"], t["y2"]])
            if (abs(a - (x, y)).max() < 1e-6) or (abs(b - (x, y)).max() < 1e-6):
                continue
            if pt_seg(np.array([x, y]), a, b)[0] < 0.001:
                return True
    return False


tracks = []
for t in raw:
    ends = []
    for x, y in ((t["x1"], t["y1"]), (t["x2"], t["y2"])):
        k = via_of(x, y, t["net"])
        if k is not None:
            ends.append((k, np.array([x, y]) - X0[k]))
        elif in_pad(x, y, t["net"], t["layer"]) or on_centreline(x, y, t["net"], t["layer"]):
            ends.append((None, np.array([x, y])))
        else:
            key = (t["layer"], round(x, 6), round(y, 6))
            if key not in corner_ix:
                corner_ix[key] = len(X0)
                X0.append(np.array([x, y])); vtype.append("corner"); vinfo.append(dict(layer=t["layer"], net=t["net"]))
            ends.append((corner_ix[key], np.zeros(2)))
    tracks.append(dict(net=t["net"], w=t["w"], layer=t["layer"], ends=ends,
                       a0=np.array([t["x1"], t["y1"]]), b0=np.array([t["x2"], t["y2"]])))
X0 = np.array(X0)
N = len(X0)
print(f"{nv} vias, {N - nv} free corners, {len(tracks)} tracks; aims: via hole {A.via}, pad hole {A.pth}, "
      f"hole-hole {A.hh}, copper {A.cu} mm", flush=True)


def endpoints(t, P):
    return [P[k] + off if k is not None else off for k, off in t["ends"]]


def via_net(i):
    return vias[i]["net"]


S = np.linspace(0.0, 1.0, A.samples)

# ---------------- terms (built around start positions)
T_vv, T_vp, T_vh, T_vt, T_tp, T_th, T_tt = [], [], [], [], [], [], []
stuck = []   # shortfalls on tracks with no movable end: need a hand reroute
for i in range(nv):
    for j in range(i + 1, nv):
        d = np.linalg.norm(X0[i] - X0[j])
        req = (max(vias[i]["drill"] / 2 + vias[j]["d"] / 2, vias[j]["drill"] / 2 + vias[i]["d"] / 2) + G
               if via_net(i) != via_net(j) else vias[i]["drill"] / 2 + vias[j]["drill"] / 2 + HH)
        if d < req + NEAR:
            T_vv.append((i, j, req))
    for p in pads:
        lo, hi = p["bb"]
        if not (lo[0] - 1 < X0[i][0] < hi[0] + 1 and lo[1] - 1 < X0[i][1] < hi[1] + 1):
            continue
        if p["net"] != via_net(i):
            for r in p["allrings"]:
                d0 = pt_poly(X0[i], r)[0]
                req = max(vias[i]["drill"] / 2 + G, min(vias[i]["d"] / 2 + CU, d0 - 1e-6))
                if d0 < req + NEAR:
                    T_vp.append((i, r, req))
            if p["hole"]:
                T_vh.append((i, p["hole"][0], max(vias[i]["d"] / 2 + p["hole"][1] + PG,
                                                   vias[i]["drill"] / 2 + p["hole"][1] + G)))
        elif p["hole"]:
            T_vh.append((i, p["hole"][0], vias[i]["drill"] / 2 + p["hole"][1] + HH))
    for ti, t in enumerate(tracks):
        if t["net"] == via_net(i):
            continue
        d0 = pt_seg(X0[i], t["a0"], t["b0"])[0]
        req = max(vias[i]["drill"] / 2 + G + t["w"] / 2, min(vias[i]["d"] / 2 + CU + t["w"] / 2, d0 - 1e-6))
        if d0 < req + NEAR:
            T_vt.append((i, ti, req))
for ti, t in enumerate(tracks):
    fixed = all(e[0] is None for e in t["ends"])
    lo = np.minimum(t["a0"], t["b0"]) - 1; hi = np.maximum(t["a0"], t["b0"]) + 1
    samples = [t["a0"] + s * (t["b0"] - t["a0"]) for s in S]
    for p in pads:
        if p["net"] == t["net"]:
            continue
        plo, phi = p["bb"]
        if (phi < lo).any() or (plo > hi).any():
            continue
        if p["hole"]:
            need = t["w"] / 2 + p["hole"][1] + PG
            d0 = pt_seg(p["hole"][0], t["a0"], t["b0"])[0]
            if fixed and d0 < need - M:
                stuck.append(f"track {t['net']} {t['layer']} to {p['name']} hole: {d0 - t['w'] / 2 - p['hole'][1]:.4f} mm")
            elif not fixed and d0 < need + NEAR:
                T_th.append((ti, p["hole"][0], need))
        if fixed:
            continue
        for r in p["rings"].get(t["layer"], []):
            d0 = seg_poly(t["a0"], t["b0"], r, S)
            req = min(t["w"] / 2 + CU, d0 - 1e-6)
            if d0 < t["w"] / 2 + CU + NEAR:
                T_tp.append((ti, r, req))
    if fixed:
        continue
    for tj, u in enumerate(tracks):
        if tj == ti or u["net"] == t["net"] or u["layer"] != t["layer"]:
            continue
        if tj < ti and any(e[0] is not None for e in u["ends"]):
            continue
        d0 = seg_seg(t["a0"], t["b0"], u["a0"], u["b0"])
        req = min(t["w"] / 2 + u["w"] / 2 + CU, d0 - 1e-6)
        if d0 < t["w"] / 2 + u["w"] / 2 + CU + NEAR:
            T_tt.append((ti, tj, req))

movable = np.ones(N, dtype=bool)


def add(grad, t, which, g):
    k = t["ends"][which][0]
    if k is not None and movable[k]:
        grad[k] += g


def energy(x, K, collect=None):
    P = x.reshape(-1, 2)
    grad = np.zeros_like(P)
    dP = P - X0
    E = float((dP ** 2).sum())
    grad += 2 * dP

    def pen(short, fn, label):
        nonlocal E
        if short > 0:
            E += K * short * short
            fn(-2 * K * short)
            if collect is not None:
                collect.append((short, label))

    for i, j, req in T_vv:
        d = P[i] - P[j]; n = math.hypot(*d)
        if n < req:
            u = d / max(n, 1e-9)
            def g(c, i=i, j=j, u=u):
                if movable[i]: grad[i] += c * u
                if movable[j]: grad[j] -= c * u
            pen(req - n, g, ("vv", i, j))
    for i, r, req in T_vp:
        d, u = pt_poly(P[i], r)
        if d < req:
            def g(c, i=i, u=u):
                if movable[i]: grad[i] += c * u
            pen(req - d, g, ("vp", i))
    for i, c0, req in T_vh:
        d = P[i] - c0; n = math.hypot(*d)
        if n < req:
            u = d / max(n, 1e-9)
            def g(c, i=i, u=u):
                if movable[i]: grad[i] += c * u
            pen(req - n, g, ("vh", i))
    for i, ti, req in T_vt:
        t = tracks[ti]; a, b = endpoints(t, P)
        d, u, s = pt_seg(P[i], a, b)
        if d < req:
            def g(c, i=i, t=t, u=u, s=s):
                if movable[i]: grad[i] += c * u
                add(grad, t, 0, -c * (1 - s) * u); add(grad, t, 1, -c * s * u)
            pen(req - d, g, ("vt", i, ti))
    for ti, r, req in T_tp:
        t = tracks[ti]; a, b = endpoints(t, P)
        for s in S:
            d, u = pt_poly(a + s * (b - a), r)
            if d < req:
                def g(c, t=t, u=u, s=s):
                    add(grad, t, 0, c * (1 - s) * u); add(grad, t, 1, c * s * u)
                pen(req - d, g, ("tp", ti))
        for q in r:                       # pad corners against the track
            d, u, s = pt_seg(q, a, b)
            if d < req:
                def g(c, t=t, u=u, s=s):
                    add(grad, t, 0, -c * (1 - s) * u); add(grad, t, 1, -c * s * u)
                pen(req - d, g, ("tp", ti))
    for ti, c0, req in T_th:
        t = tracks[ti]; a, b = endpoints(t, P)
        d, u, s = pt_seg(c0, a, b)
        if d < req:
            def g(c, t=t, u=u, s=s):
                add(grad, t, 0, -c * (1 - s) * u); add(grad, t, 1, -c * s * u)
            pen(req - d, g, ("th", ti))
    for ti, tj, req in T_tt:
        t, w = tracks[ti], tracks[tj]
        a, b = endpoints(t, P); c1, c2 = endpoints(w, P)
        # exact segment-segment distance: each end of one track against the other track
        for (p, which, own, other, o1, o2) in ((a, 0, t, w, c1, c2), (b, 1, t, w, c1, c2),
                                               (c1, 0, w, t, a, b), (c2, 1, w, t, a, b)):
            d, u, s2 = pt_seg(p, o1, o2)
            if d < req:
                def g(c, own=own, other=other, which=which, u=u, s2=s2):
                    add(grad, own, which, c * u)
                    add(grad, other, 0, -c * (1 - s2) * u); add(grad, other, 1, -c * s2 * u)
                pen(req - d, g, ("tt", ti, tj))
    for k in range(N):
        if not movable[k]:
            grad[k] = 0
    return E, grad.ravel()


init = []
energy(X0.ravel(), 1.0, init)
hot = []
for sh, k in init:
    if k[0] == "vv":
        hot += [X0[k[1]], X0[k[2]]]
    elif k[0] in ("vp", "vh"):
        hot.append(X0[k[1]])
    elif k[0] == "vt":
        hot += [X0[k[1]], tracks[k[2]]["a0"], tracks[k[2]]["b0"]]
    else:
        for ti in k[1:]:
            hot += [tracks[ti]["a0"], tracks[ti]["b0"]]
hot = np.array(hot) if hot else np.zeros((0, 2))
for k in range(N):
    movable[k] = len(hot) > 0 and (np.linalg.norm(hot - X0[k], axis=1) < HOT_R).any()
mv = set(np.nonzero(movable)[0])
live = lambda t: any(e[0] in mv for e in t["ends"])
T_vv[:] = [t for t in T_vv if t[0] in mv or t[1] in mv]
T_vp[:] = [t for t in T_vp if t[0] in mv]
T_vh[:] = [t for t in T_vh if t[0] in mv]
T_vt[:] = [t for t in T_vt if t[0] in mv or live(tracks[t[1]])]
T_tp[:] = [t for t in T_tp if live(tracks[t[0]])]
T_th[:] = [t for t in T_th if live(tracks[t[0]])]
T_tt[:] = [t for t in T_tt if live(tracks[t[0]]) or live(tracks[t[1]])]
print(f"initial shortfalls {len(init)}; movable: {sum(1 for k in mv if k < nv)} vias, {sum(1 for k in mv if k >= nv)} corners",
      flush=True)

x = X0.ravel().copy()
# board edge: keep copper inside the outline (never tighter than where it already is).
# + half the 0.05 mm outline stroke: KiCad measures to its centreline.
EDGE = A.edge + 0.01 + 0.025
L0, T0, R0, B0 = D["bbox"]
reach = np.zeros(N)
for i in range(nv):
    reach[i] = vias[i]["d"] / 2
for t in tracks:
    for k, _ in t["ends"]:
        if k is not None and k >= nv:
            reach[k] = max(reach[k], t["w"] / 2)
bounds = []
R = A.reach
for k in range(N):
    if not movable[k]:
        bounds += [(X0[k][0], X0[k][0]), (X0[k][1], X0[k][1])]
        continue
    lo_x, hi_x = L0 + EDGE + reach[k], R0 - EDGE - reach[k]
    lo_y, hi_y = T0 + EDGE + reach[k], B0 - EDGE - reach[k]
    px_, py_ = X0[k]
    bounds.append((max(px_ - R, min(lo_x, px_)), min(px_ + R, max(hi_x, px_))))
    bounds.append((max(py_ - R, min(lo_y, py_)), min(py_ + R, max(hi_y, py_))))
if init:
    for K in (1e3, 1e5, 1e6):
        r = minimize(energy, x, args=(K,), jac=True, method="L-BFGS-B", bounds=bounds, options=dict(maxiter=1500))
        x = r.x
        viol = []
        energy(x, K, viol)
        print(f"K={K:g}: iters {r.nit}, worst {max([v[0] for v in viol], default=0):.4f} mm", flush=True)

P = x.reshape(-1, 2)
viol = []
energy(x, 1.0, viol)
moves = []
for k in range(N):
    d = float(np.linalg.norm(P[k] - X0[k]))
    if d > 0.0005:
        moves.append(dict(kind=vtype[k], x0=float(X0[k][0]), y0=float(X0[k][1]), x=round(float(P[k][0]), 5),
                          y=round(float(P[k][1]), 5), move=round(d, 4), **vinfo[k]))
moves.sort(key=lambda m: -m["move"])
print(f"{sum(1 for m in moves if m['kind'] == 'via')} vias and {sum(1 for m in moves if m['kind'] == 'corner')} corners move"
      f"{', largest %.4f mm' % moves[0]['move'] if moves else ''}")


def lab(v):
    k = v[1]
    nm = lambda i: via_net(i) if i < nv else "?"
    if k[0] == "vv": return f"via {nm(k[1])} / via {nm(k[2])}"
    if k[0] in ("vp", "vh"): return f"via {nm(k[1])} / pad"
    if k[0] == "vt": return f"via {nm(k[1])} / track {tracks[k[2]]['net']} {tracks[k[2]]['layer']}"
    if k[0] in ("tp", "th"): return f"track {tracks[k[1]]['net']} {tracks[k[1]]['layer']} / pad"
    return f"track {tracks[k[1]]['net']} / track {tracks[k[2]]['net']} {tracks[k[1]]['layer']}"


left = {}
for v in viol:
    if v[0] > 0.0015:
        left[lab(v)] = max(left.get(lab(v), 0), v[0])
print(f"shortfalls over 1.5 um left: {len(left)}")
for k, s in sorted(left.items(), key=lambda kv: -kv[1]):
    print(f"  short {s:.4f}  {k}")
for s in stuck:
    print(f"  NEEDS HAND REROUTE (track has no movable end): {s}")
json.dump(dict(moves=moves, left=len(left), stuck=stuck), open(A.out, "w"), indent=1)
