#!/usr/bin/env python3
"""Build the 2-layer marketing demo of the 1x1 COB panel from ../panel.kicad_pcb.

Run with KiCad's bundled Python (it provides pcbnew):
  "C:\\Program Files\\KiCad\\10.0\\bin\\python.exe" generate_demo_panel.py

The source panel is never modified. Every board gets the same finish (--finish), and
each finish is its own footprint in demo.pretty/. Zone refill and DRC are done
afterwards with kicad-cli; see README.md.

pcbnew is only used for its polygon booleans. The board itself is edited as text
because pcbnew.LoadBoard() blocks indefinitely on some KiCad 10 Windows installs.
"""

import argparse
import json
import re
import uuid
from pathlib import Path

import pcbnew

HERE = Path(__file__).resolve().parent
ASSETS = json.loads((HERE / "art" / "assets.json").read_text(encoding="utf-8"))
SOURCE_PANEL = HERE.parent / "panel.kicad_pcb"
OUTPUT_PANEL = HERE / "demo-panel.kicad_pcb"
LIB_DIR = HERE / "demo.pretty"

PADRING = "WaferSpace:waferspace_default_padring_v0.2"
UUID_NAMESPACE = uuid.UUID("7d9a7a50-3a4c-4f7e-9c55-3f1f0c2b9a10")

FINISH = "black_on_gold"
FINISH_LABELS = {"gold_on_substrate": "GOLD ON SUBSTRATE",
                 "substrate_on_gold": "SUBSTRATE ON GOLD",
                 "gold_on_black": "GOLD ON BLACK",
                 "black_on_gold": "BLACK ON GOLD"}

# Die site, relative to the padring centre (mm).
FIELD_HX, FIELD_HY = 2.85, 2.85     # Faux die.
CAVITY_HX, CAVITY_HY = 4.7, 5.1     # Mask opening in the stock padring.
FRAME_WIDTH = 0.12                  # Seal ring around the gold-on-substrate die.
LOGO_WIDTH = 5.2
LOGO_GROW = 0.01                    # Lifts the tile outlines clear of the 0.1 mm track limit.
GOLD_ON_BLACK_COPPER_GROW = 0.04    # Copper under the mask edge; the mask sets the shape.
BLACK_ON_GOLD_MASK_GROW = 0.01      # Keeps the thinnest mask lines at the 0.13 mm dam limit.
KEEPOUT_MARGIN = 0.05
DIE_SITE_HX, DIE_SITE_HY = 3.75, 4.15   # Inside the bond fingers.
NAMEPLATE = (-4.19, 5.535, 5.81, 7.535) # The stock write-on bar: x0, y0, x1, y1.
NAMEPLATE_VIA_MARGIN = 0.4

# Lead fan from the bond fingers to the die edge.
LEAD_WIDTH = 0.1
LEAD_TOP_Y, LEAD_SIDE_X = 3.1, 3.1
LEAD_SCALE = 0.8

# Frame art lives in the 14 x 7 mm cells either side of the centre V-cut, so every
# piece survives the panel being split along any score line.
STRIP_CENTRES_Y = (84.96, 91.96)
COLUMN_CENTRES_X = tuple(71.14 + 14 * i for i in range(6))
COLUMN_TEXT_WIDTH = 12.2
QR_MODULE = 0.24
PLATE_COPPER_GROW = 0.04            # Copper under the mask edge of the frame rocket plate.
VCUT_MARGIN = 0.4                   # Minimum distance from frame art to a score line.


# Geometry ------------------------------------------------------------------------------

def nm(mm):
    return pcbnew.FromMM(mm)


def poly_set(contours):
    """Union of closed contours given in mm."""
    result = pcbnew.SHAPE_POLY_SET()
    for contour in contours:
        one = pcbnew.SHAPE_POLY_SET()
        one.NewOutline()
        for x, y in contour:
            one.Append(nm(x), nm(y))
        one.Simplify()
        result.BooleanAdd(one)
    return result


def rect(x0, y0, x1, y1):
    return poly_set([[(x0, y0), (x1, y0), (x1, y1), (x0, y1)]])


def union(*sets):
    result = pcbnew.SHAPE_POLY_SET()
    for s in sets:
        result.BooleanAdd(s)
    return result


def subtract(a, b):
    result = pcbnew.SHAPE_POLY_SET(a)
    result.BooleanSubtract(b)
    return result


def grow(s, amount):
    result = pcbnew.SHAPE_POLY_SET(s)
    result.Inflate(nm(amount), pcbnew.CORNER_STRATEGY_ROUND_ALL_CORNERS, nm(0.002))
    return result


def contour_area(contour):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(contour, contour[1:] + contour[:1])) / 2


def outlines_mm(s):
    """Fracture to hole-free single contours, as KiCad stores filled polygons."""
    fractured = pcbnew.SHAPE_POLY_SET(s)
    fractured.Fracture()
    contours = []
    for i in range(fractured.OutlineCount()):
        line = fractured.Outline(i)
        contours.append([(pcbnew.ToMM(line.CPoint(j).x), pcbnew.ToMM(line.CPoint(j).y))
                         for j in range(line.PointCount())])
    expected = s.Area() / 1e12
    actual = sum(abs(contour_area(c)) for c in contours)
    if abs(actual - expected) > max(0.001 * expected, 1e-4):
        raise ValueError(f"fracture changed polygon area: {expected:.4f} to {actual:.4f} mm2")
    return contours


def text_width(text, em):
    font = ASSETS["font"]
    return sum(font["glyphs"][c]["advance"] for c in text) * em / font["units_per_em"]


def text_em_for_width(text, width):
    return width / text_width(text, 1.0)


def text_set(text, em, place):
    """Audiowide outlines; place(s, t) maps along-baseline/up-from-baseline mm to the board."""
    font = ASSETS["font"]
    scale = em / font["units_per_em"]
    outer, holes = [], []
    cursor = 0.0
    for char in text:
        glyph = font["glyphs"][char]
        for contour in glyph["contours"]:
            pts = [(cursor + x * scale, y * scale) for x, y in contour]
            area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))
            # TrueType winds outer contours clockwise in its y-up space.
            (outer if area < 0 else holes).append([place(s, t) for s, t in pts])
        cursor += glyph["advance"] * scale
    return subtract(poly_set(outer), poly_set(holes))


def logo_set(width, cx=0.0, cy=0.0, mirror=False):
    contours = ASSETS["logo"]
    xs = [x for c in contours for x, _ in c]
    ys = [y for c in contours for _, y in c]
    x0, y0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    scale = width / (max(xs) - min(xs))
    flip = -1 if mirror else 1
    return poly_set([[(cx + flip * (x - x0) * scale, cy + (y - y0) * scale) for x, y in c]
                     for c in contours])


def qr_contours(module, cx, cy, mirror=False, quiet=2):
    """White silk rectangles for the light modules; the mask reads as the dark ones.

    Drawn as solid runs rather than a field with holes, because dark modules touching at
    a corner make holes that Fracture() can silently drop.
    """
    rows = ASSETS["qr"]["rows"]
    n = len(rows)
    half = n * module / 2
    margin = quiet * module
    overlap = 0.002             # Keeps abutting silk rectangles from leaving a hairline.

    def box(x0, y0, x1, y1):
        return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

    left, right = cx - half - margin, cx + half + margin
    top, bottom = cy - half - margin, cy + half + margin
    contours = [box(left, top, right, cy - half + overlap),
                box(left, cy + half - overlap, right, bottom),
                box(left, top, cx - half + overlap, bottom),
                box(cx + half - overlap, top, right, bottom)]
    for r, row in enumerate(rows):
        # Back-side art is flipped in board coordinates to read true from behind.
        bits = row[::-1] if mirror else row
        y0, y1 = cy - half + r * module, cy - half + (r + 1) * module
        for match in re.finditer("0+", bits):
            contours.append(box(cx - half + match.start() * module, y0 - overlap,
                                cx - half + match.end() * module, y1 + overlap))
    return contours


def centred_x(text, em, cx, baseline_y):
    x0 = cx - text_width(text, em) / 2
    return lambda s, t: (x0 + s, baseline_y - t)


def back_line(text, em, baseline_x, centre_y=0.0):
    """Text on the back, reading bottom-to-top when the board is viewed from behind."""
    y0 = centre_y + text_width(text, em) / 2
    return text_set(text, em, lambda s, t: (baseline_x + t, y0 - s))


# Finish footprints ---------------------------------------------------------------------

def finish_layers(finish):
    """(F.Cu, F.Mask opening or None to keep the padring's own opening) for a finish."""
    art = grow(logo_set(LOGO_WIDTH), LOGO_GROW)
    field = rect(-FIELD_HX, -FIELD_HY, FIELD_HX, FIELD_HY)
    cavity = rect(-CAVITY_HX, -CAVITY_HY, CAVITY_HX, CAVITY_HY)
    if finish == "gold_on_substrate":
        frame = subtract(field, rect(-FIELD_HX + FRAME_WIDTH, -FIELD_HY + FRAME_WIDTH,
                                     FIELD_HX - FRAME_WIDTH, FIELD_HY - FRAME_WIDTH))
        return union(art, frame), None
    if finish == "substrate_on_gold":
        return subtract(field, art), None
    if finish == "gold_on_black":
        return grow(art, GOLD_ON_BLACK_COPPER_GROW), union(subtract(cavity, field), art)
    if finish == "black_on_gold":
        return field, subtract(cavity, grow(art, BLACK_ON_GOLD_MASK_GROW))
    raise ValueError(finish)


def marketing_silk():
    """(F.SilkS, B.SilkS) for one board."""
    # Front: the stock write-on bar becomes a wafer.space nameplate.
    x0, y0, x1, y1 = NAMEPLATE
    bar_em = text_em_for_width("wafer.space", 9.2)
    name = text_set("wafer.space", bar_em, centred_x("wafer.space", bar_em, (x0 + x1) / 2, 6.95))
    demo = text_set("DEMO", 1.0, centred_x("DEMO", 1.0, -2.3, -5.6))
    front = union(subtract(rect(x0, y0, x1, y1), name), demo)

    # Back: the left block when viewed from behind is +x, the right block is -x.
    # Baselines sit in the channels between the connector pads and the via fans.
    back = union(
        back_line("wafer.space", text_em_for_width("wafer.space", 11.5), 3.3),
        back_line("https://wafer.space", text_em_for_width("https://wafer.space", 12.0), 2.05),
        back_line("Your design.", 1.2, -2.75),
        back_line("Your silicon.", 1.2, -3.9),
        back_line("GF180MCU 180 nm", 1.0, -5.0),
    )
    return front, back


def fp_poly_lines(contours, layer):
    out = []
    for contour in contours:
        pts = " ".join(f"(xy {x:.4f} {y:.4f})" for x, y in contour)
        out.append(f'\t(fp_poly\n\t\t(pts {pts})\n\t\t(stroke\n\t\t\t(width 0)\n\t\t\t(type solid)\n'
                   f'\t\t)\n\t\t(fill yes)\n\t\t(layer "{layer}")\n\t)')
    return out


def write_footprint(finish, copper, mask, front_silk, back_silk):
    label = FINISH_LABELS[finish].lower()
    lines = [f'(footprint "ws_demo_die_{finish}"',
             '\t(version 20260206)', '\t(generator "generate_demo_panel")',
             '\t(layer "F.Cu")',
             f'\t(descr "wafer.space demo die, {label}. Not a real die site.")',
             '\t(attr board_only exclude_from_pos_files exclude_from_bom)']
    for prop, value in (("Reference", "ART**"), ("Value", finish)):
        lines.append(f'\t(property "{prop}" "{value}"\n\t\t(at 0 0 0)\n\t\t(layer "F.Fab")\n'
                     '\t\t(hide yes)\n\t\t(effects\n\t\t\t(font\n\t\t\t\t(size 1 1)\n'
                     '\t\t\t\t(thickness 0.15)\n\t\t\t)\n\t\t)\n\t)')
    lines += fp_poly_lines(outlines_mm(copper), "F.Cu")
    if mask is not None:
        lines += fp_poly_lines(outlines_mm(mask), "F.Mask")
    lines += fp_poly_lines(outlines_mm(front_silk), "F.SilkS")
    lines += fp_poly_lines(outlines_mm(back_silk), "B.SilkS")
    lines.append(")")
    (LIB_DIR / f"ws_demo_die_{finish}.kicad_mod").write_text("\n".join(lines) + "\n",
                                                             encoding="utf-8", newline="\n")


def build_footprints():
    LIB_DIR.mkdir(exist_ok=True)
    front, back = marketing_silk()
    for finish in FINISH_LABELS:
        copper, mask = finish_layers(finish)
        write_footprint(finish, copper, mask, front, back)


# Board text edits ----------------------------------------------------------------------

def new_uuid(seed):
    """Stable across runs, so regenerating gives a reviewable diff."""
    return str(uuid.uuid5(UUID_NAMESPACE, seed))


def top_level_items(text):
    """Split a .kicad_pcb into its header and tab-indented top-level items."""
    return re.split(r"(?m)^(?=\t\()", text)


def child_items(item):
    return re.split(r"(?m)^(?=\t\t\()", item)


def bbox(item):
    points = re.findall(r"\((?:xy|start|end) ([-\d.]+) ([-\d.]+)\)", item)
    xs, ys = [float(p[0]) for p in points], [float(p[1]) for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def item_uuid(item):
    return re.search(r'\(uuid "([^"]+)"\)', item).group(1)


def on_layer(item, layer):
    return f'(layer "{layer}")' in item


def is_stale_silk(item):
    """Row/column labels, title blocks, the old back text and the write-on bars."""
    if not (on_layer(item, "F.SilkS") or on_layer(item, "B.SilkS")):
        return False
    if item.startswith("\t(gr_text"):
        return re.match(r'\t\(gr_text "(R\dC\d|wafer\.space[^"]*|1x1)"', item) is not None
    if on_layer(item, "F.SilkS") and item.startswith(("\t(gr_poly", "\t(gr_rect")):
        x0, y0, x1, y1 = bbox(item)
        # Nameplates are redrawn per board.
        return x1 - x0 > 9.5 and y1 - y0 < 2.5
    return False


def lead_fan_items(pad_nets, centre, seed):
    """One track from each bond finger towards the die, standing in for the wire bonds."""
    items = []
    for number, (dx, dy, net) in pad_nets.items():
        if abs(dy) > 4.5:       # Top and bottom rows.
            sign = 1 if dy > 0 else -1
            path = [(dx, dy), (dx, sign * 4.2), (dx * LEAD_SCALE, sign * LEAD_TOP_Y)]
        else:                   # Left and right rows.
            sign = 1 if dx > 0 else -1
            path = [(dx, dy), (sign * 3.8, dy), (sign * LEAD_SIDE_X, dy * LEAD_SCALE)]
        for i, ((x0, y0), (x1, y1)) in enumerate(zip(path, path[1:])):
            items.append(f'\t(segment\n\t\t(start {centre[0] + x0:.4f} {centre[1] + y0:.4f})\n'
                         f'\t\t(end {centre[0] + x1:.4f} {centre[1] + y1:.4f})\n'
                         f'\t\t(width {LEAD_WIDTH})\n\t\t(layer "F.Cu")\n\t\t(net "{net}")\n'
                         f'\t\t(uuid "{new_uuid(f"{seed}/lead/{number}/{i}")}")\n\t)\n')
    return items


def convert_padring(item, finish):
    """Strip the die paddle and GND vias (no paste, no die); return item, centre and nets."""
    x, y, rotation = re.search(r"\n\t\t\(at ([-\d.]+) ([-\d.]+) (\d+)\)", item).groups()
    assert rotation == "180", "padring is expected at 180 degrees on every board"
    kept, removed, pad_nets = [], [], {}
    for child in child_items(item):
        pad = re.match(r'\t\t\(pad "(\d+)"', child)
        if pad and int(pad.group(1)) > 74:
            removed.append(item_uuid(child))
            continue
        if pad:
            px, py = re.search(r"\(at ([-\d.]+) ([-\d.]+)", child).groups()
            net = re.search(r'\(net "([^"]*)"\)', child).group(1)
            pad_nets[int(pad.group(1))] = (-float(px), -float(py), net)
        if finish in ("gold_on_black", "black_on_gold") and child.startswith("\t\t(fp_poly") \
                and on_layer(child, "F.Mask"):
            removed.append(item_uuid(child))
            continue
        kept.append(child)
    return "".join(kept), (float(x), float(y)), pad_nets, removed


def art_footprint(finish, centre, index):
    """The finish footprint from demo.pretty, placed on the board."""
    name = f"ws_demo_die_{finish}"
    body = (LIB_DIR / f"{name}.kicad_mod").read_text(encoding="utf-8").rstrip()
    body = body[:body.rindex(")")]                  # Closing paren of the footprint.
    body = re.sub(r'\A\(footprint "[^"]+"\n\t\(version \d+\)\n\t\(generator "[^"]+"\)\n'
                  r'\t\(layer "F\.Cu"\)\n', "", body)
    body = body.replace('"ART**"', f'"ART{index}"')
    seed = f"{finish}/{index}"
    counter = iter(range(1 << 30))
    body = re.sub(r'(\(layer "[^"]+"\))\n\t\)',
                  lambda m: f'{m.group(1)}\n\t\t(uuid "{new_uuid(f"{seed}/{next(counter)}")}")\n\t)',
                  body)
    body = "\n".join("\t" + line for line in body.splitlines())
    return (f'\t(footprint "demo:{name}"\n\t\t(layer "F.Cu")\n'
            f'\t\t(uuid "{new_uuid(seed)}")\n\t\t(at {centre[0]:.4f} {centre[1]:.4f})\n{body}\n\t)\n')


def grown_keepout(item, centre):
    """Grow a die keepout over the whole mask opening, so the pour leaves the cavity."""
    hx, hy = CAVITY_HX + KEEPOUT_MARGIN, CAVITY_HY + KEEPOUT_MARGIN
    pts = " ".join(f"(xy {centre[0] + px:.4f} {centre[1] + py:.4f})"
                   for px, py in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)))
    return re.sub(r"\(polygon\s*\(pts.*?\)\s*\)\s*\)", f"(polygon\n\t\t\t(pts {pts})\n\t\t)",
                  item, count=1, flags=re.S)


def is_die_site_gnd_track(item, centres):
    """GND straps that fed the paddle and were hidden under the pour until now."""
    if not (item.startswith("\t(segment") and on_layer(item, "F.Cu") and '(net "GND")' in item):
        return False
    start, end = (re.search(rf"\({key} ([-\d.]+) ([-\d.]+)\)", item).groups()
                  for key in ("start", "end"))
    points = [(float(x), float(y)) for x, y in (start, end)]
    return any(abs(x - cx) < DIE_SITE_HX and abs(y - cy) < DIE_SITE_HY
               for x, y in points for cx, cy in centres)


def gr_polys(polys, layer, seed):
    return gr_contours(outlines_mm(polys), layer, seed)


def gr_contours(contours, layer, seed):
    items = []
    for i, contour in enumerate(contours):
        pts = " ".join(f"(xy {x:.4f} {y:.4f})" for x, y in contour)
        items.append(f'\t(gr_poly\n\t\t(pts {pts})\n\t\t(stroke\n\t\t\t(width 0)\n\t\t\t(type solid)\n'
                     f'\t\t)\n\t\t(fill yes)\n\t\t(layer "{layer}")\n'
                     f'\t\t(uuid "{new_uuid(f"{seed}/{i}")}")\n\t)\n')
    return items


def frame_line(text, em, cx, baseline, back):
    """One line of frame text, centred on a column and reading true from its own side."""
    half = text_width(text, em) / 2
    if back:
        return text_set(text, em, lambda s, t: (cx + half - s, baseline - t))
    return text_set(text, em, lambda s, t: (cx - half + s, baseline - t))


def fitted_em(text, em):
    return min(em, text_em_for_width(text, COLUMN_TEXT_WIDTH))


def frame_block(top, top_em, bottom, bottom_em, cx, cy, back):
    return union(frame_line(top, fitted_em(top, top_em), cx, cy - 0.3, back),
                 frame_line(bottom, fitted_em(bottom, bottom_em), cx, cy + 1.7, back))


def frame_strip_items(cy, back):
    """One 7 mm strip: title, tagline, rocket, URL, process and QR, one per V-cut cell."""
    side = "B" if back else "F"
    seed = f"frame/{side}/{cy}"
    # Columns run left to right as seen from the side being printed.
    title_x, tagline_x, rocket_x, url_x, process_x, qr_x = (
        tuple(reversed(COLUMN_CENTRES_X)) if back else COLUMN_CENTRES_X)
    url_em = fitted_em("https://wafer.space", 2.0)
    silk = union(
        frame_block("wafer.space", 1.9, "DEMO: no silicon", 1.2, title_x, cy, back),
        frame_block("Your design.", 1.5, "Your silicon.", 1.5, tagline_x, cy, back),
        frame_line("https://wafer.space", url_em, url_x, cy + 0.4, back),
        frame_block("COB 1x1", 1.7, "GF180MCU 180 nm", 1.2, process_x, cy, back),
    )
    # The rocket is the same black-on-gold plate as the die on each board.
    plate = rect(rocket_x - FIELD_HX, cy - FIELD_HY, rocket_x + FIELD_HX, cy + FIELD_HY)
    logo = grow(logo_set(LOGO_WIDTH, rocket_x, cy, mirror=back),
                LOGO_GROW + BLACK_ON_GOLD_MASK_GROW)
    return (gr_polys(silk, f"{side}.SilkS", f"{seed}/silk")
            + gr_contours(qr_contours(QR_MODULE, qr_x, cy, mirror=back), f"{side}.SilkS", f"{seed}/qr")
            + gr_polys(grow(plate, PLATE_COPPER_GROW), f"{side}.Cu", f"{seed}/cu")
            + gr_polys(subtract(plate, logo), f"{side}.Mask", f"{seed}/mask"))


def vcut_positions(text):
    """(x positions, y positions) of the score lines drawn on User.1."""
    xs, ys = set(), set()
    for part in top_level_items(text):
        if part.startswith("\t(gr_line") and on_layer(part, "User.1"):
            x0, y0, x1, y1 = bbox(part)
            if x0 == x1:
                xs.add(x0)
            else:
                ys.add(y0)
    return sorted(xs), sorted(ys)


def check_clear_of_vcuts(items, xs, ys):
    """Fail the build rather than let frame art straddle a score line."""
    for item in items:
        x0, y0, x1, y1 = bbox(item)
        for x in xs:
            if x0 - VCUT_MARGIN < x < x1 + VCUT_MARGIN:
                raise ValueError(f"frame art {x0:.2f}..{x1:.2f} crosses the V-cut at x={x}")
        for y in ys:
            if y0 - VCUT_MARGIN < y < y1 + VCUT_MARGIN:
                raise ValueError(f"frame art {y0:.2f}..{y1:.2f} crosses the V-cut at y={y}")


def panel_art_items(source_text):
    """Frame graphics, only on the full panel. These live in the break-away rails."""
    items = []
    for cy in STRIP_CENTRES_Y:
        items += frame_strip_items(cy, back=False)
        items += frame_strip_items(cy, back=True)
    check_clear_of_vcuts(items, *vcut_positions(source_text))
    return items


def two_layer_stackup():
    def layer(name, kind, extra=""):
        return f'\t\t\t(layer "{name}"\n\t\t\t\t(type "{kind}")\n{extra}\t\t\t)\n'

    def prop(key, value):
        return f"\t\t\t\t({key} {value})\n"

    body = (layer("F.SilkS", "Top Silk Screen", prop("color", '"White"'))
            + layer("F.Paste", "Top Solder Paste")
            + layer("F.Mask", "Top Solder Mask", prop("color", '"Black"') + prop("thickness", "0.01"))
            + layer("F.Cu", "copper", prop("thickness", "0.035"))
            + layer("dielectric 1", "core", prop("color", '"FR4 natural"') + prop("thickness", "0.71")
                    + prop("material", '"FR4"') + prop("epsilon_r", "4.5")
                    + prop("loss_tangent", "0.02"))
            + layer("B.Cu", "copper", prop("thickness", "0.035"))
            + layer("B.Mask", "Bottom Solder Mask", prop("color", '"Black"') + prop("thickness", "0.01"))
            + layer("B.Paste", "Bottom Solder Paste")
            + layer("B.SilkS", "Bottom Silk Screen", prop("color", '"White"')))
    return ('(stackup\n' + body + '\t\t\t(copper_finish "ENIG")\n'
            '\t\t\t(dielectric_constraints no)\n\t\t)')


def balanced_end(text, start):
    depth = 0
    in_string = False
    for i in range(start, len(text)):
        ch = text[i]
        if ch == '"' and text[i - 1] != "\\":
            in_string = not in_string
        elif not in_string and ch == "(":
            depth += 1
        elif not in_string and ch == ")":
            depth -= 1
            if depth == 0:
                return i + 1
    raise ValueError("unbalanced s-expression")


def to_two_layers(text):
    """Drop the inner layers. They only ever held the GND pour, which stays on F and B."""
    start = text.index("(stackup")
    text = text[:start] + two_layer_stackup() + text[balanced_end(text, start):]
    text = re.sub(r"\(thickness [\d.]+\)(\s*\(legacy_teardrops)", r"(thickness 0.8)\1", text, count=1)
    text = re.sub(r'\t\t\(\d+ "In[12]\.Cu" signal\)\n', "", text)
    text = text.replace('(layers "F.Cu" "B.Cu" "In1.Cu" "In2.Cu")', '(layers "F.Cu" "B.Cu")')
    text = re.sub(r'\t\t\(zone_layer_connections "In1\.Cu" "In2\.Cu"\)\n', "", text)
    text = re.sub(r'\t\t\(filled_polygon\n\t\t\t\(layer "In[12]\.Cu"\).*?\n\t\t\)\n', "", text,
                  flags=re.S)
    return text


def nameplate_via_position(item, centres):
    """Position of a via that would punch through the nameplate, else None."""
    if not item.startswith("\t(via"):
        return None
    x, y = (float(v) for v in re.search(r"\(at ([-\d.]+) ([-\d.]+)\)", item).groups())
    x0, y0, x1, y1 = NAMEPLATE
    for cx, cy in centres:
        if (x0 - NAMEPLATE_VIA_MARGIN < x - cx < x1 + NAMEPLATE_VIA_MARGIN
                and y0 - NAMEPLATE_VIA_MARGIN < y - cy < y1 + NAMEPLATE_VIA_MARGIN):
            return x, y
    return None


def is_teardrop_on(item, positions):
    """A via's teardrop zones have to go with it."""
    if not (item.startswith("\t(zone") and "(teardrop" in item):
        return False
    x0, y0, x1, y1 = bbox(item.split("(filled_polygon")[0])
    return any(x0 - 0.1 < x < x1 + 0.1 and y0 - 0.1 < y < y1 + 0.1 for x, y in positions)


def convert_board(text, finish):
    centres, new_items, removed, kept = [], [], [], []
    index = 0
    for part in top_level_items(to_two_layers(text)):
        if is_stale_silk(part):
            removed.append(item_uuid(part))
            continue
        if part.startswith(f'\t(footprint "{PADRING}"'):
            index += 1
            part, centre, pad_nets, gone = convert_padring(part, finish)
            removed += gone
            centres.append(centre)
            new_items += lead_fan_items(pad_nets, centre, f"board/{index}")
            new_items.append(art_footprint(finish, centre, index))
        kept.append(part)

    drop = {part for part in kept if is_die_site_gnd_track(part, centres)}
    vias = {part: nameplate_via_position(part, centres) for part in kept if part.startswith("\t(via")}
    positions = [p for p in vias.values() if p]
    drop |= {part for part, p in vias.items() if p}
    drop |= {part for part in kept if is_teardrop_on(part, positions)}
    # Teardrop zones carry no uuid and are never group members.
    gone = set(removed) | {item_uuid(part) for part in drop if "(uuid" in part}
    result = []
    for part in kept:
        if part in drop:
            continue
        if part.startswith("\t(zone") and "(keepout" in part:
            box = bbox(part.split("(filled_polygon")[0])
            cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
            part = grown_keepout(part, min(centres, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2))
        if part.startswith("\t(group"):
            part = re.sub(r'"([0-9a-f-]{36})"\s*',
                          lambda m: "" if m.group(1) in gone else m.group(0), part)
        if part.startswith("\t(embedded_fonts"):
            result += new_items
            if len(centres) > 1:
                result += panel_art_items(text)
        result.append(part)
    return "".join(result), len(centres)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--source", type=Path, default=SOURCE_PANEL,
                    help="a panel, or one board for the close-up renders")
    ap.add_argument("--output", type=Path, default=OUTPUT_PANEL)
    ap.add_argument("--finish", choices=list(FINISH_LABELS), default=FINISH)
    args = ap.parse_args()

    build_footprints()
    text, boards = convert_board(args.source.read_text(encoding="utf-8"), args.finish)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, encoding="utf-8", newline="\n")

    project = args.source.with_suffix(".kicad_pro").read_text(encoding="utf-8")
    args.output.with_suffix(".kicad_pro").write_text(
        project.replace(f'"{args.source.stem}.kicad_pro"', f'"{args.output.stem}.kicad_pro"'),
        encoding="utf-8", newline="\n")
    print(f"Wrote {args.output} with {boards} boards in {args.finish}")


if __name__ == "__main__":
    main()
