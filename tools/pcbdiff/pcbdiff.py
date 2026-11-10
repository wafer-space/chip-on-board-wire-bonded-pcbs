"""pcbdiff: see what changed in a KiCad board between two git revisions.

    python tools/pcbdiff/pcbdiff.py                      # HEAD vs working copy, every changed board
    python tools/pcbdiff/pcbdiff.py HEAD~1               # HEAD~1 vs working copy
    python tools/pcbdiff/pcbdiff.py 3452d41 2f0473e      # two commits
    python tools/pcbdiff/pcbdiff.py HEAD -b run-2/1x1-cob/1x1-mezzanine.kicad_pcb --open
    git pcbdiff HEAD~1 HEAD                              # same, via the repo-local git alias

Writes .pcbdiff/<board>__<A>__<B>/index.html with
  * Board Setup rule changes and zone setting changes,
  * every via / track / footprint that moved, was added or removed (matched by KiCad UUID),
  * every hole-to-copper and hole-to-hole gap that changed, before -> after, against the target,
  * per-copper-layer overlays (grey = unchanged, red = only in A, green = only in B) and
    zoomed crops of each changed area with the gap numbers printed on them.
Needs KiCad 10 (for its Python) plus matplotlib and Pillow in the Python that runs this script.
"""
import argparse, json, math, os, shutil, subprocess, sys, tempfile, html, datetime

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.path import Path
from matplotlib.patches import PathPatch, Circle
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
KICAD_PY = os.environ.get("KICAD_PYTHON", r"C:\Program Files\KiCad\10.0\bin\python.exe")
WORK = "WORK"
FULL_PX = 110          # px per mm for full-layer overlays
CROP_PX = 320          # px per mm for zoomed crops
COLORS = dict(bg=(0, 0, 0), same=(85, 85, 85), old=(235, 70, 60), new=(70, 225, 95), mark=(255, 215, 0))


# ------------------------------------------------------------------ git helpers
def git(*args, check=True):
    r = subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        sys.exit(f"git {' '.join(args)} failed:\n{r.stderr}")
    return r.stdout


def short(rev):
    return WORK if rev == WORK else git("rev-parse", "--short", rev).strip()


def materialize(rev, path, dest_dir):
    """write <board>.kicad_pcb (+ .kicad_pro) of rev into dest_dir; return board path or None."""
    os.makedirs(dest_dir, exist_ok=True)
    base = os.path.splitext(path)[0]
    out = os.path.join(dest_dir, os.path.basename(path))
    for src, dst in ((path, out), (base + ".kicad_pro", os.path.splitext(out)[0] + ".kicad_pro")):
        if rev == WORK:
            if os.path.exists(src):
                shutil.copy(src, dst)
        else:
            r = subprocess.run(["git", "show", f"{rev}:{src.replace(os.sep, '/')}"], capture_output=True)
            if r.returncode == 0:
                open(dst, "wb").write(r.stdout)
    return out if os.path.exists(out) else None


def changed_boards(a, b):
    args = ["diff", "--name-only", a] + ([] if b == WORK else [b]) + ["--", "*.kicad_pcb", "*.kicad_pro"]
    names = set()
    for n in git(*args).split():
        root = os.path.splitext(n)[0]
        if os.path.exists(root + ".kicad_pcb") or n.endswith(".kicad_pcb"):
            names.add(root + ".kicad_pcb")
    return sorted(names)


def extract(board, out_json):
    r = subprocess.run([KICAD_PY, os.path.join(HERE, "extract.py"), board, out_json],
                       capture_output=True, text=True, timeout=600)
    if r.returncode != 0 or not os.path.exists(out_json):
        sys.exit(f"extract failed for {board}:\n{r.stderr[-2000:]}")
    return json.load(open(out_json))


def pro_rules(board):
    p = os.path.splitext(board)[0] + ".kicad_pro"
    if not os.path.exists(p):
        return {}
    try:
        return json.load(open(p, encoding="utf-8"))["board"]["design_settings"]["rules"]
    except Exception:
        return {}


# ------------------------------------------------------------------ diffing
def dist(ax, ay, bx, by):
    return math.hypot(ax - bx, ay - by)


def diff_items(A, B):
    res = dict(vias=[], tracks=[], footprints=[], zones=[], teardrops=None)
    va, vb = {v["uuid"]: v for v in A["vias"]}, {v["uuid"]: v for v in B["vias"]}
    for u in va.keys() | vb.keys():
        a, b = va.get(u), vb.get(u)
        if a and b:
            d = dist(a["x"], a["y"], b["x"], b["y"])
            other = [k for k in ("d", "drill", "net") if a[k] != b[k]]
            if d > 1e-6 or other:
                res["vias"].append(dict(what="moved" if d > 1e-6 else "edited", net=b["net"], move=d,
                                        frm=(a["x"], a["y"]), to=(b["x"], b["y"]),
                                        note=", ".join(f"{k} {a[k]} → {b[k]}" for k in other), layer="all"))
        elif b:
            res["vias"].append(dict(what="added", net=b["net"], move=None, frm=None, to=(b["x"], b["y"]), note="", layer="all"))
        else:
            res["vias"].append(dict(what="removed", net=a["net"], move=None, frm=(a["x"], a["y"]), to=None, note="", layer="all"))
    ta, tb = {t["uuid"]: t for t in A["tracks"]}, {t["uuid"]: t for t in B["tracks"]}
    for u in ta.keys() | tb.keys():
        a, b = ta.get(u), tb.get(u)
        if a and b:
            d1 = dist(a["x1"], a["y1"], b["x1"], b["y1"]); d2 = dist(a["x2"], a["y2"], b["x2"], b["y2"])
            other = [k for k in ("w", "layer", "net") if a[k] != b[k]]
            if max(d1, d2) > 1e-6 or other:
                res["tracks"].append(dict(what="moved" if max(d1, d2) > 1e-6 else "edited", net=b["net"], layer=b["layer"],
                                          move=max(d1, d2), frm=((a["x1"] + a["x2"]) / 2, (a["y1"] + a["y2"]) / 2),
                                          to=((b["x1"] + b["x2"]) / 2, (b["y1"] + b["y2"]) / 2),
                                          note=", ".join(f"{k} {a[k]} → {b[k]}" for k in other),
                                          seg=((b["x1"], b["y1"]), (b["x2"], b["y2"]))))
        elif b:
            res["tracks"].append(dict(what="added", net=b["net"], layer=b["layer"], move=None, frm=None,
                                      to=((b["x1"] + b["x2"]) / 2, (b["y1"] + b["y2"]) / 2), note=f"w {b['w']}",
                                      seg=((b["x1"], b["y1"]), (b["x2"], b["y2"]))))
        else:
            res["tracks"].append(dict(what="removed", net=a["net"], layer=a["layer"], move=None,
                                      frm=((a["x1"] + a["x2"]) / 2, (a["y1"] + a["y2"]) / 2), to=None, note=f"w {a['w']}",
                                      seg=((a["x1"], a["y1"]), (a["x2"], a["y2"]))))
    fa, fb = {f["uuid"]: f for f in A["footprints"]}, {f["uuid"]: f for f in B["footprints"]}
    for u in fa.keys() | fb.keys():
        a, b = fa.get(u), fb.get(u)
        if a and b:
            d = dist(a["x"], a["y"], b["x"], b["y"])
            other = [k for k in ("rot", "side", "value") if a[k] != b[k]]
            if d > 1e-6 or other:
                res["footprints"].append(dict(what="moved" if d > 1e-6 else "edited", ref=b["ref"], move=d,
                                              frm=(a["x"], a["y"]), to=(b["x"], b["y"]),
                                              note=", ".join(f"{k} {a[k]} → {b[k]}" for k in other)))
        elif b:
            res["footprints"].append(dict(what="added", ref=b["ref"], move=None, frm=None, to=(b["x"], b["y"]), note=""))
        else:
            res["footprints"].append(dict(what="removed", ref=a["ref"], move=None, frm=(a["x"], a["y"]), to=None, note=""))
    za = {z["uuid"]: z for z in A["zones"] if not z["teardrop"]}
    zb = {z["uuid"]: z for z in B["zones"] if not z["teardrop"]}
    for u in za.keys() | zb.keys():
        a, b = za.get(u), zb.get(u)
        name = (b or a)["name"] or (b or a)["net"]
        if a and b:
            ch = [f"{k} {a[k]} → {b[k]}" for k in ("clearance", "min_thickness", "priority", "net", "layers") if a[k] != b[k]]
            if a["outline"] != b["outline"]:
                ch.append("outline edited")
            refill = [l for l in set(a["fills"]) | set(b["fills"]) if a["fills"].get(l) != b["fills"].get(l)]
            if ch or refill:
                res["zones"].append(dict(name=name, what="; ".join(ch) or "—", refill=sorted(refill)))
        else:
            res["zones"].append(dict(name=name, what="added" if b else "removed", refill=[]))
    tda = [z for z in A["zones"] if z["teardrop"]]; tdb = [z for z in B["zones"] if z["teardrop"]]
    ua, ub = {z["uuid"] for z in tda}, {z["uuid"] for z in tdb}
    same_outline = sum(1 for z in tdb if z["uuid"] in ua and z["outline"] == next(y for y in tda if y["uuid"] == z["uuid"])["outline"])
    res["teardrops"] = dict(a=len(tda), b=len(tdb), added=len(ub - ua), removed=len(ua - ub),
                            reshaped=len(ub & ua) - same_outline)
    return res


def gap_kind(label):
    w = label.split()[0]
    return {"track": "track", "via": "via pad", "zone": "pour", "teardrop": "teardrop"}.get(w, "pad")


def diff_gaps(A, B, target, hh_target):
    ga = {(g["a"], g["b"]): g for g in A["gaps"]}
    gb = {(g["a"], g["b"]): g for g in B["gaps"]}
    rows = []
    for k in ga.keys() | gb.keys():
        a, b = ga.get(k), gb.get(k)
        g = b or a
        lim = hh_target if g["kind"] == "hole-hole" else target
        va = a["gap"] if a else None
        vb = b["gap"] if b else None
        if va is not None and vb is not None and abs(va - vb) < 0.0005:
            continue
        bad_a = va is not None and va < lim
        bad_b = vb is not None and vb < lim
        if not (bad_a or bad_b):
            continue
        status = ("fixed" if bad_a and not bad_b else "new failure" if bad_b and not bad_a
                  else "worse" if (vb if vb is not None else 9) < (va if va is not None else 9) else "better, still under")
        # via-pair gaps show up from both sides; keep both, they are separate checks at the fab too
        rows.append(dict(kind=g["kind"], what=f"{g['a_label']}  ↔  {g['b_label']}", layer=g["layer"],
                         a=va, b=vb, lim=lim, status=status, x=g["x"], y=g["y"]))
    order = {"new failure": 0, "worse": 1, "better, still under": 2, "fixed": 3}
    rows.sort(key=lambda r: (order[r["status"]], r["b"] if r["b"] is not None else 9))
    return rows


def gap_counts(D, target, hh_target):
    c = {}
    for g in D["gaps"]:
        if g["kind"] == "hole-hole":
            if g["gap"] < hh_target:
                c["hole-hole"] = c.get("hole-hole", 0) + 1
        elif g["gap"] < target:
            k = gap_kind(g["a_label"])
            c[k] = c.get(k, 0) + 1
    return c


# ------------------------------------------------------------------ rendering
def oriented(ring, ccw):
    area = sum(ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1] for i in range(len(ring)))
    return ring if (area > 0) == ccw else ring[::-1]


def poly_path(poly):
    verts, codes = [], []
    for i, ring in enumerate(poly):
        if len(ring) < 3:
            continue
        r = oriented(ring, i == 0)
        verts += list(r) + [r[0]]
        codes += [Path.MOVETO] + [Path.LINETO] * (len(r) - 1) + [Path.CLOSEPOLY]
    return Path(verts, codes) if verts else None


def render(D, layer, box, px):
    """boolean copper mask of one layer inside box=(x0,y0,x1,y1) mm at px per mm."""
    x0, y0, x1, y1 = box
    W, H = max(1, int(round((x1 - x0) * px))), max(1, int(round((y1 - y0) * px)))
    fig = plt.figure(figsize=(W / 72, H / 72), dpi=72)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_axis_off()
    ax.set_xlim(x0, x1); ax.set_ylim(y1, y0)
    ax.add_patch(plt.Rectangle((x0, y0), x1 - x0, y1 - y0, color="black", zorder=0))
    for z in D["zones"]:
        for poly in z["fills"].get(layer, []):
            p = poly_path(poly)
            if p:
                ax.add_patch(PathPatch(p, fc="white", ec="none", lw=0, zorder=1))
    for t in D["tracks"]:
        if t["layer"] != layer:
            continue
        pts = t.get("pts") or [(t["x1"], t["y1"]), (t["x2"], t["y2"])]
        ax.plot([p[0] for p in pts], [p[1] for p in pts], color="white", lw=t["w"] * px,
                solid_capstyle="round", solid_joinstyle="round", zorder=2)
    for p in D["pads"]:
        for poly in p["polys"].get(layer, []):
            pp = poly_path(poly)
            if pp:
                ax.add_patch(PathPatch(pp, fc="white", ec="none", lw=0, zorder=2))
    for v in D["vias"]:
        if layer in v["layers"]:
            ax.add_patch(Circle((v["x"], v["y"]), v["d"] / 2, fc="white", ec="none", zorder=3))
    for v in D["vias"]:
        ax.add_patch(Circle((v["x"], v["y"]), v["drill"] / 2, fc="black", ec="none", zorder=4))
    for p in D["pads"]:
        if p["hole"]:
            hx1, hy1, hx2, hy2, w = p["hole"]
            ax.plot([hx1, hx2], [hy1, hy2], color="black", lw=w * px, solid_capstyle="round", zorder=4)
    fig.canvas.draw()
    img = np.asarray(fig.canvas.buffer_rgba())[:, :, 0]
    plt.close(fig)
    return img > 127


def overlay(ma, mb):
    out = np.zeros(ma.shape + (3,), dtype=np.uint8)
    out[:] = COLORS["bg"]
    out[ma & mb] = COLORS["same"]
    out[ma & ~mb] = COLORS["old"]
    out[~ma & mb] = COLORS["new"]
    return Image.fromarray(out)


def font(size):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except Exception:
        try:
            return ImageFont.load_default(size=size)
        except Exception:
            return ImageFont.load_default()


def clusters(points, gap=0.9):
    cl = []
    for x, y in points:
        for c in cl:
            if c[0] - gap <= x <= c[2] + gap and c[1] - gap <= y <= c[3] + gap:
                c[0], c[1], c[2], c[3] = min(c[0], x), min(c[1], y), max(c[2], x), max(c[3], y)
                break
        else:
            cl.append([x, y, x, y])
    merged = True  # noqa
    while merged:                                   # merge clusters that grew into each other
        merged = False
        for i in range(len(cl)):
            for j in range(i + 1, len(cl)):
                a, b = cl[i], cl[j]
                if a[0] - gap <= b[2] and b[0] - gap <= a[2] and a[1] - gap <= b[3] and b[1] - gap <= a[3]:
                    cl[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    del cl[j]; merged = True; break
            if merged:
                break
    return cl


def tiles(points, span=3.0):
    """clusters of change points, split so no crop is wider or taller than span mm."""
    out = []
    for c in clusters(points):
        nx = max(1, math.ceil((c[2] - c[0]) / span)); ny = max(1, math.ceil((c[3] - c[1]) / span))
        w, h = (c[2] - c[0]) / nx or 1, (c[3] - c[1]) / ny or 1
        for i in range(nx):
            for j in range(ny):
                inn = [(x, y) for x, y in points
                       if c[0] + i * w - 1e-9 <= x <= c[0] + (i + 1) * w + 1e-9 and c[1] + j * h - 1e-9 <= y <= c[1] + (j + 1) * h + 1e-9]
                if inn:
                    out.append([min(p[0] for p in inn), min(p[1] for p in inn), max(p[0] for p in inn), max(p[1] for p in inn)])
    return out


# ------------------------------------------------------------------ report
def fmt(v):
    return "≥0.30" if v is None else f"{v:.4f}"   # extract.py only records gaps under 0.30 mm


def esc(s):
    return html.escape(str(s))


def report(board, ra, rb, A, B, items, gaps, rules_a, rules_b, target, hh_target, outdir):
    os.makedirs(outdir, exist_ok=True)
    x0, y0, x1, y1 = B["bbox"]
    box = (x0 - 0.3, y0 - 0.3, x1 + 0.3, y1 + 0.3)
    layers = [l for l in B["layers"] if l in A["layers"]]
    lines = []
    w = lines.append

    # change points per layer, for crops
    pts = {l: [] for l in layers}
    for v in items["vias"]:
        for p in (v["frm"], v["to"]):
            if p:
                for l in layers:
                    pts[l].append(p)
    for t in items["tracks"]:
        for p in (t["frm"], t["to"]):
            if p and t["layer"] in pts:
                pts[t["layer"]].append(p)
    for f in items["footprints"]:
        for p in (f["frm"], f["to"]):
            if p:
                for l in layers:
                    pts[l].append(p)
    for g in gaps:
        for l in (layers if g["layer"] == "all" else [g["layer"]]):
            if l in pts:
                pts[l].append((g["x"], g["y"]))

    imgs = {}
    for l in layers:
        ma, mb = render(A, l, box, FULL_PX), render(B, l, box, FULL_PX)
        changed = int((ma ^ mb).sum())
        im = overlay(ma, mb)
        dr = ImageDraw.Draw(im)
        cls = tiles(pts[l])
        crops = []
        for i, c in enumerate(cls):
            cx0, cy0, cx1, cy1 = c[0] - 0.55, c[1] - 0.55, c[2] + 0.55, c[3] + 0.55
            if cx1 - cx0 < 1.6:
                m = (cx0 + cx1) / 2; cx0, cx1 = m - 0.8, m + 0.8
            if cy1 - cy0 < 1.6:
                m = (cy0 + cy1) / 2; cy0, cy1 = m - 0.8, m + 0.8
            px = CROP_PX if (cx1 - cx0) * CROP_PX < 1400 else 1400 / (cx1 - cx0)
            cb = (cx0, cy0, cx1, cy1)
            ca, cbm = render(A, l, cb, px), render(B, l, cb, px)
            if not (ca ^ cbm).any() and not any(g for g in gaps if cx0 <= g["x"] <= cx1 and cy0 <= g["y"] <= cy1):
                continue
            ci = overlay(ca, cbm)
            cd = ImageDraw.Draw(ci)
            f = font(max(12, int(px * 0.06)))
            worst = {}   # one label per hole: the pair with the smallest gap after the change
            for g in gaps:
                if (g["layer"] in ("all", l)) and cx0 <= g["x"] <= cx1 and cy0 <= g["y"] <= cy1:
                    k = (g["x"], g["y"]); vb = g["b"] if g["b"] is not None else 9
                    if k not in worst or vb < (worst[k]["b"] if worst[k]["b"] is not None else 9):
                        worst[k] = g
            for g in worst.values():
                gx, gy = (g["x"] - cx0) * px, (g["y"] - cy0) * px
                ok = g["b"] is None or g["b"] >= g["lim"]
                cd.text((gx - 2.2 * f.size, gy - 0.5 * f.size), f"{fmt(g['a'])}→{fmt(g['b'])}",
                        fill=(255, 255, 255) if ok else (255, 215, 0), font=f, stroke_width=2, stroke_fill=(0, 0, 0))
            name = f"{l.replace('.', '_')}_crop{i + 1}.png"
            ci.save(os.path.join(outdir, name))
            crops.append((name, cb))
            bx0, by0 = (cx0 - box[0]) * FULL_PX, (cy0 - box[1]) * FULL_PX
            bx1, by1 = (cx1 - box[0]) * FULL_PX, (cy1 - box[1]) * FULL_PX
            dr.rectangle([bx0, by0, bx1, by1], outline=COLORS["mark"], width=2)
            dr.text((bx0 + 3, by0 + 2), str(len(crops)), fill=COLORS["mark"], font=font(16))
        name = f"{l.replace('.', '_')}.png"
        im.save(os.path.join(outdir, name))
        imgs[l] = (name, changed, crops)

    ca, cb = gap_counts(A, target, hh_target), gap_counts(B, target, hh_target)
    kinds = ["track", "via pad", "pad", "pour", "teardrop", "hole-hole"]

    w(f"<!doctype html><html><head><meta charset='utf-8'><title>pcbdiff {esc(os.path.basename(board))}</title>")
    w("""<style>
    :root{--bg:#111;--fg:#ddd;--mut:#999;--line:#333;--red:#eb463c;--grn:#46e15f;--yel:#ffd700}
    body{background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,Segoe UI,sans-serif;margin:0;padding:16px 20px 60px}
    h1{font-size:20px;margin:0 0 4px} h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
    .mut{color:var(--mut)} table{border-collapse:collapse;margin:6px 0} td,th{border-bottom:1px solid var(--line);padding:3px 10px 3px 0;text-align:left;vertical-align:top}
    th{color:var(--mut);font-weight:600} td.n{text-align:right;font-variant-numeric:tabular-nums}
    .fixed{color:var(--grn)} .new.failure,.worse{color:var(--red)} .better{color:var(--yel)}
    .key span{display:inline-block;width:12px;height:12px;margin:0 4px -2px 12px}
    img{max-width:100%;border:1px solid var(--line)} .crops{display:flex;flex-wrap:wrap;gap:10px}
    .crops figure{margin:0;max-width:460px} .crops img{max-width:460px} figcaption{color:var(--mut);font-size:12px}
    details summary{cursor:pointer;color:var(--mut)}
    </style></head><body>""")
    w(f"<h1>{esc(board)}</h1><div class='mut'>A = <b>{esc(ra)}</b> &nbsp;→&nbsp; B = <b>{esc(rb)}</b>"
      f" &nbsp;·&nbsp; target hole-to-copper {target} mm, hole-to-hole {hh_target} mm"
      f" &nbsp;·&nbsp; generated {datetime.datetime.now():%Y-%m-%d %H:%M}</div>")
    w("<div class='key mut'>Overlays:<span style='background:#555'></span>unchanged"
      "<span style='background:var(--red)'></span>only in A (removed)<span style='background:var(--grn)'></span>only in B (added)"
      "<span style='border:2px solid var(--yel)'></span>numbered crop</div>")

    w("<h2>Gaps under target</h2><table><tr><th>copper near a hole</th><th>A</th><th>B</th></tr>")
    for k in kinds:
        if ca.get(k) or cb.get(k):
            w(f"<tr><td>{k}</td><td class=n>{ca.get(k, 0)}</td><td class=n>{cb.get(k, 0)}</td></tr>")
    w("</table><div class='mut'>Counted per copper item and hole, so a via pair counts twice (each via's pad to the other's hole). "
      "Pour and teardrop gaps count once per layer.</div>")

    rch = [(k, rules_a.get(k), rules_b.get(k)) for k in sorted(set(rules_a) | set(rules_b)) if rules_a.get(k) != rules_b.get(k)]
    w("<h2>Board Setup rules</h2>")
    if rch:
        w("<table><tr><th>rule</th><th>A</th><th>B</th></tr>" + "".join(
            f"<tr><td>{esc(k)}</td><td>{esc(a)}</td><td>{esc(b)}</td></tr>" for k, a, b in rch) + "</table>")
    else:
        w("<div class='mut'>No change.</div>")
    w("<h2>Zones</h2>")
    if items["zones"]:
        w("<table><tr><th>zone</th><th>settings</th><th>fill changed on</th></tr>" + "".join(
            f"<tr><td>{esc(z['name'])}</td><td>{esc(z['what'])}</td><td>{esc(', '.join(z['refill']) or '—')}</td></tr>"
            for z in items["zones"]) + "</table>")
    else:
        w("<div class='mut'>No change.</div>")
    td = items["teardrops"]
    w(f"<div class='mut'>Teardrops: {td['a']} → {td['b']} ({td['added']} added, {td['removed']} removed, {td['reshaped']} reshaped). "
      "Teardrops that were not regenerated after their track moved keep their old shape.</div>")

    def move_table(title, rows, cols):
        w(f"<h2>{title} <span class='mut'>({len(rows)})</span></h2>")
        if not rows:
            w("<div class='mut'>None.</div>"); return
        w("<table><tr>" + "".join(f"<th>{c}</th>" for c in cols) + "</tr>")
        for r in rows:
            w("<tr>" + "".join(f"<td{' class=n' if isinstance(v, float) else ''}>{esc(v)}</td>" for v in r) + "</tr>")
        w("</table>")

    def pos(p):
        return "—" if p is None else f"({p[0]:.3f}, {p[1]:.3f})"

    vr = sorted(items["vias"], key=lambda r: -(r["move"] or 0))
    move_table("Vias", [(r["what"], r["net"], "—" if r["move"] is None else f"{r['move']:.4f}", pos(r["frm"]), pos(r["to"]), r["note"])
                        for r in vr], ["change", "net", "moved mm", "from", "to", "other"])
    tr = sorted(items["tracks"], key=lambda r: (r["what"], r["net"], r["layer"]))
    move_table("Tracks", [(r["what"], r["net"], r["layer"], "—" if r["move"] is None else f"{r['move']:.4f}", pos(r["to"] or r["frm"]), r["note"])
                          for r in tr], ["change", "net", "layer", "max end moved mm", "at (midpoint)", "other"])
    move_table("Footprints", [(r["what"], r["ref"], "—" if r["move"] is None else f"{r['move']:.4f}", pos(r["frm"]), pos(r["to"]), r["note"])
                              for r in items["footprints"]], ["change", "ref", "moved mm", "from", "to", "other"])

    w(f"<h2>Hole gaps that changed <span class='mut'>({len(gaps)}: only pairs under target on either side)</span></h2>")
    if gaps:
        w("<table><tr><th>status</th><th>copper ↔ hole</th><th>layer</th><th>A mm</th><th>B mm</th><th>at</th></tr>")
        for g in gaps:
            w(f"<tr><td class='{g['status'].split(',')[0]}'>{esc(g['status'])}</td><td>{esc(g['what'])}</td><td>{esc(g['layer'])}</td>"
              f"<td class=n>{fmt(g['a'])}</td><td class=n>{fmt(g['b'])}</td><td>({g['x']:.3f}, {g['y']:.3f})</td></tr>")
        w("</table>")
    else:
        w("<div class='mut'>None.</div>")

    for l in layers:
        name, changed, crops = imgs[l]
        w(f"<h2>{esc(l)} <span class='mut'>({changed} px changed at {FULL_PX} px/mm, {len(crops)} crops)</span></h2>")
        w(f"<a href='{name}'><img src='{name}' loading='lazy'></a>")
        if crops:
            w("<div class='crops'>")
            for i, (cn, cbx) in enumerate(crops):
                w(f"<figure><a href='{cn}'><img src='{cn}' loading='lazy'></a><figcaption>{i + 1}: x {cbx[0]:.2f}–{cbx[2]:.2f}, "
                  f"y {cbx[1]:.2f}–{cbx[3]:.2f} mm. Label per hole: its smallest changed gap A→B (white = passes in B, yellow = still under).</figcaption></figure>")
            w("</div>")
    w("</body></html>")
    open(os.path.join(outdir, "index.html"), "w", encoding="utf-8").write("\n".join(lines))
    return ca, cb


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("revs", nargs="*", help="A [B]; default HEAD and the working copy")
    ap.add_argument("-b", "--board", action="append", help="board file(s); default every changed .kicad_pcb")
    ap.add_argument("--target", type=float, default=0.23, help="hole-to-copper target, mm (default 0.23)")
    ap.add_argument("--hole-hole", type=float, default=0.254, help="hole-to-hole target, mm (default 0.254)")
    ap.add_argument("--out", default=None, help="output folder (default .pcbdiff/ at the repo root)")
    ap.add_argument("--open", action="store_true", help="open the report(s) in the browser")
    a = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252
    except Exception:
        pass
    os.chdir(git("rev-parse", "--show-toplevel").strip())
    revs = a.revs or ["HEAD"]
    if len(revs) > 2:
        sys.exit("give at most two revisions")
    ra = revs[0]
    rb = revs[1] if len(revs) == 2 else WORK
    sa, sb = short(ra), short(rb)
    boards = [os.path.normpath(p) for p in (a.board or changed_boards(ra, rb))]
    if not boards:
        print(f"no .kicad_pcb / .kicad_pro changes between {sa} and {sb}"); return
    out_root = a.out or ".pcbdiff"
    tmp = tempfile.mkdtemp(prefix="pcbdiff_")
    try:
        for board in boards:
            ba = materialize(ra, board, os.path.join(tmp, "A"))
            bb = materialize(rb, board, os.path.join(tmp, "B"))
            if not ba or not bb:
                print(f"{board}: only exists on one side ({'A' if ba else 'B'}), skipped"); continue
            print(f"{board}: {sa} → {sb}")
            A = extract(ba, os.path.join(tmp, "A.json"))
            B = extract(bb, os.path.join(tmp, "B.json"))
            items = diff_items(A, B)
            gaps = diff_gaps(A, B, a.target, a.hole_hole)
            outdir = os.path.join(out_root, f"{os.path.splitext(os.path.basename(board))[0]}__{sa}__{sb}")
            if os.path.isdir(outdir):
                shutil.rmtree(outdir)
            ca, cb = report(board, sa, sb, A, B, items, gaps, pro_rules(ba), pro_rules(bb), a.target, a.hole_hole, outdir)
            mv = lambda rows: sum(1 for r in rows if r["what"] == "moved")
            ad = lambda rows: sum(1 for r in rows if r["what"] == "added")
            rm = lambda rows: sum(1 for r in rows if r["what"] == "removed")
            print(f"  vias: {mv(items['vias'])} moved, {ad(items['vias'])} added, {rm(items['vias'])} removed")
            print(f"  tracks: {mv(items['tracks'])} moved, {ad(items['tracks'])} added, {rm(items['tracks'])} removed")
            print(f"  footprints: {mv(items['footprints'])} moved;  zones changed: {len(items['zones'])};  "
                  f"teardrops {items['teardrops']['a']}→{items['teardrops']['b']} ({items['teardrops']['reshaped']} reshaped)")
            print("  under target (A → B): " + ", ".join(f"{k} {ca.get(k, 0)}→{cb.get(k, 0)}"
                                                        for k in ["track", "via pad", "pad", "pour", "teardrop", "hole-hole"]
                                                        if ca.get(k) or cb.get(k)) or "  none")
            st = {}
            for g in gaps:
                st[g["status"]] = st.get(g["status"], 0) + 1
            print("  gap changes: " + (", ".join(f"{k} {v}" for k, v in st.items()) or "none"))
            print(f"  report: {os.path.abspath(os.path.join(outdir, 'index.html'))}")
            if a.open:
                os.startfile(os.path.abspath(os.path.join(outdir, "index.html")))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
