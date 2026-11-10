#!/usr/bin/env python3
"""Check run-2 COB boards and panels against NextPCB's published limits.

    python planning/nextpcb_redesign/check/check_board.py --designs
    python planning/nextpcb_redesign/check/check_board.py --panels
    python planning/nextpcb_redesign/check/check_board.py run-2/1x1-cob/1x1-mezzanine.kicad_pcb

Exit 0 when every board passes, 1 when any fails. Boards are copied to a temporary folder
first, so nothing in the repo changes. It checks saved copper and never refills zones.

Set KICAD_CLI if kicad-cli isn't at the default Windows path.
"""
import argparse
import collections
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
DECK = os.path.join(HERE, "nextpcb.kicad_dru")
KICAD_CLI = os.environ.get("KICAD_CLI", r"C:\Program Files\KiCad\10.0\bin\kicad-cli.exe")

DESIGNS = [
    "run-2/1x1-cob/1x1-mezzanine.kicad_pcb",
    "run-2/1x0p5-cob/mezzanine-1x0p5.kicad_pcb",
    "run-2/0p5x1-cob/mezzanine-0p5x1.kicad_pcb",
    "run-2/0p5x0p5-cob/0p5x0p5-cob.kicad_pcb",
]
PANELS = [
    "run-2/1x1-cob/panelization/panel.kicad_pcb",
    "run-2/1x0p5-cob/panelization/panel.kicad_pcb",
    "run-2/0p5x1-cob/panelization/panel.kicad_pcb",
    "run-2/0p5x0p5-cob/panelization/panel.kicad_pcb",
]

MIN_MASK_EXPANSION = 0.0381   # 1.5 mil
MIN_ANNULAR = 0.0889          # 3.5 mil
MIN_PTH_ANNULAR = 0.2         # from NextPCB's PTH diagram
REPORT_CAPS = {199, 499, 500} # KiCad stops reporting a type at these counts

# Hits here don't fail a board. They're printed so they stay visible.
ADVISORY = {"silk_over_copper", "silk_overlap", "silk_edge_clearance", "text_thickness"}
# Library and schematic housekeeping, with no effect on the Gerbers.
IGNORED = {"lib_footprint_issues", "missing_courtyard", "footprint_type_mismatch",
           "footprint_symbol_mismatch", "track_not_centered_on_via", "pth_inside_courtyard",
           "npth_inside_courtyard", "footprint_filters_mismatch"}
# Waiting on NextPCB: do the die-pad holes count as PTH or as vias? (Q2 on the board)
ASK_RULES = {"np_pth_wall_to_cu_9mil"}


def run_drc(work, board_text):
    pcb = os.path.join(work, "panel.kicad_pcb")
    with open(pcb, "w", encoding="utf-8") as f:
        f.write(board_text)
    out = os.path.join(work, "drc.json")
    if os.path.exists(out):
        os.remove(out)
    r = subprocess.run([KICAD_CLI, "pcb", "drc", "--format", "json", "--severity-all",
                        "--units", "mm", "--output", out, pcb],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if not os.path.exists(out):
        sys.exit("kicad-cli produced no report:\n" + r.stdout + r.stderr)
    with open(out, encoding="utf-8") as f:
        return json.load(f)


def prepare_project(work, pro_path):
    """Zero the board-setup minimums, which would otherwise hide the deck's limits, and turn every check on."""
    with open(pro_path, encoding="utf-8") as f:
        pro = json.load(f)
    settings = pro["board"]["design_settings"]
    settings["rules"].update({
        "min_clearance": 0.0, "min_connection": 0.0, "min_track_width": 0.0,
        "min_via_annular_width": 0.0, "min_via_diameter": 0.0, "min_through_hole_diameter": 0.0,
        "min_hole_clearance": 0.0, "min_hole_to_hole": 0.0, "min_copper_edge_clearance": 0.0,
        "min_silk_clearance": 0.0, "min_text_height": 0.762, "min_text_thickness": 0.0762,
    })
    for key in settings["rule_severities"]:
        settings["rule_severities"][key] = "error"
    with open(os.path.join(work, "panel.kicad_pro"), "w", encoding="utf-8") as f:
        json.dump(pro, f, indent=2)
    shutil.copy(DECK, os.path.join(work, "panel.kicad_dru"))


def promote_vcuts(text):
    """Move the V-cut lines on User.1 to Edge.Cuts so DRC measures copper against them."""
    count = 0

    def swap(m):
        nonlocal count
        if '(layer "User.1")' in m.group(0):
            count += 1
            return m.group(0).replace('(layer "User.1")', '(layer "Edge.Cuts")')
        return m.group(0)

    return re.sub(r"^\t\(gr_line\n.*?^\t\)", swap, text, flags=re.M | re.S), count


def rule_of(v):
    m = re.search(r"rule '([^']+)'", v["description"])
    return m.group(1) if m else "-"


def actual_of(v):
    m = re.search(r"actual ([\d.]+) ?mm", v["description"])
    return float(m.group(1)) if m else None


def classify(v, is_panel):
    kind = v["type"]
    if kind in IGNORED or kind == "invalid_outline":
        return "ignored"
    if kind in ADVISORY:
        return "advisory"
    if rule_of(v) in ASK_RULES:
        return "ask"
    names = [i["description"] for i in v["items"]]
    if kind == "solder_mask_bridge" and any(re.search(r"Polygon of \S+ on F\.Mask", n) for n in names):
        return "ignored"   # the wire-bond opening, which has to be open
    if kind == "zones_intersect":
        nets = {m.group(1) for n in names for m in [re.search(r"\[([^\]]*)\]", n)] if m}
        if len(nets) == 1:
            return "ignored"   # two zones on one net
    return "required"


def geometry_facts(text):
    """Things DRC doesn't report, or caps. Read straight from the saved board."""
    facts = {"vias": collections.Counter(), "pth": collections.Counter()}
    for m in re.finditer(r"^\t\(via\n\s*\(at [-\d.]+ [-\d.]+\)\n\s*\(size ([\d.]+)\)\n\s*\(drill ([\d.]+)\)", text, re.M):
        facts["vias"][(float(m.group(1)), float(m.group(2)))] += 1
    for m in re.finditer(r'\(pad "[^"]*" thru_hole \w+\s*\n?(.*?)\(uuid', text, re.S):
        s = re.search(r"\(size ([\d.]+) ([\d.]+)\)", m.group(1))
        d = re.search(r"\(drill ([\d.]+)", m.group(1))
        if s and d:
            facts["pth"][(float(s.group(1)), float(d.group(1)))] += 1
    mask = re.search(r"\(pad_to_mask_clearance ([\d.]+)\)", text)
    facts["mask"] = float(mask.group(1)) if mask else 0.0
    facts["stackups"] = len(re.findall(r'\(type "Top Solder Mask"\)', text))
    finish = re.search(r"\(copper_finish ([^)]*)\)", text)
    facts["finish"] = finish.group(1).strip('"') if finish else "not set"
    thick = re.search(r"\(general\s*\(thickness ([\d.]+)\)", text)
    facts["thickness"] = float(thick.group(1)) if thick else None
    return facts


def check(path):
    full = path if os.path.isabs(path) else os.path.join(REPO, path)
    with open(full, encoding="utf-8") as f:
        text = f.read()
    pro_path = os.path.splitext(full)[0] + ".kicad_pro"
    work = tempfile.mkdtemp(prefix="nextpcb_check_")
    try:
        prepare_project(work, pro_path)
        report = run_drc(work, text)
        promoted, vcuts = promote_vcuts(text)
        violations = list(report["violations"])
        if vcuts:   # panels only. A second run, because crossing lines invalidate the outline.
            edge_run = run_drc(work, promoted)
            violations = [v for v in violations if v["type"] != "copper_edge_clearance"]
            violations += [v for v in edge_run["violations"] if v["type"] == "copper_edge_clearance"]
    finally:
        shutil.rmtree(work, ignore_errors=True)

    is_panel = vcuts > 0
    buckets = collections.defaultdict(lambda: collections.defaultdict(list))
    for v in violations:
        buckets[classify(v, is_panel)][(v["type"], rule_of(v))].append(actual_of(v))

    facts = geometry_facts(text)
    rows, fails = [], 0
    def fail(label):
        nonlocal fails
        fails += 1
        rows.append("  FAIL  " + label)

    for (kind, rule), vals in sorted(buckets["required"].items()):
        nums = [x for x in vals if x is not None]
        n = len(vals)
        capped = "+" if n in REPORT_CAPS else ""
        worst = f"  worst {min(nums):.4f} mm" if nums else ""
        fail(f"{kind} {'' if rule == '-' else rule}: {n}{capped}{worst}")
    if report["unconnected_items"] and not is_panel:
        fail(f"unconnected items: {len(report['unconnected_items'])}")

    if facts["mask"] < MIN_MASK_EXPANSION:
        fail(f"solder mask expansion {facts['mask']} mm, needs at least {MIN_MASK_EXPANSION} mm")
    if facts["stackups"] != 1:
        fail(f"{facts['stackups']} stackup definitions in the board file, needs 1")

    # DRC caps annular hits at 199, so this count comes from the board file.
    small = sum(n for (size, drill), n in facts["vias"].items() if (size - drill) / 2 < MIN_ANNULAR - 1e-6)
    via_text = ", ".join(f"{n} at {s}/{d}" for (s, d), n in sorted(facts["vias"].items()))
    pth_small = sum(n for (size, drill), n in facts["pth"].items() if (size - drill) / 2 < MIN_PTH_ANNULAR - 1e-6)

    ask = [f"{r}: {len(v)}" + (f"  worst {min(x for x in v if x is not None):.4f} mm" if any(x is not None for x in v) else "")
           for (k, r), v in sorted(buckets["ask"].items())]
    if pth_small:
        ask.append(f"PTH pads with a ring under {MIN_PTH_ANNULAR} mm: {pth_small}")
    advisory = [f"{k}: {len(v)}" for (k, r), v in sorted(buckets["advisory"].items())]

    print(f"\n{'PASS' if not fails else 'FAIL'}  {path}")
    print(f"  vias {via_text or 'none'} ({small} under the {MIN_ANNULAR} mm ring)  |  "
          f"thickness {facts['thickness']} mm  |  finish {facts['finish']}")
    for row in rows:
        print(row)
    for row in ask:
        print("  ASK   " + row + "  (waiting on NextPCB, Q2)")
    if advisory:
        print("  note  silk and text: " + ", ".join(advisory))
    if is_panel:
        print(f"  note  {vcuts} V-cut lines checked. Unconnected items between boards are expected on a panel.")
    return not fails


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("boards", nargs="*", help=".kicad_pcb files, each with a .kicad_pro beside it")
    parser.add_argument("--designs", action="store_true", help="the four single COB designs")
    parser.add_argument("--panels", action="store_true", help="the four panels")
    args = parser.parse_args()
    boards = list(args.boards) + (DESIGNS if args.designs else []) + (PANELS if args.panels else [])
    if not boards:
        parser.error("name a board, or use --designs or --panels")
    if not os.path.exists(KICAD_CLI):
        sys.exit(f"kicad-cli not found at {KICAD_CLI}. Set KICAD_CLI to its path.")
    results = [(b, check(b)) for b in boards]
    passed = sum(1 for _, ok in results if ok)
    print(f"\n{passed} of {len(results)} pass")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
