/* ============================================================================
   NextPCB Redesign — board DATA. Loaded before
   ../_planning_tools/board.engine.js, which reads window.DOC and renders. plan.html
   also loads this file and builds its task list from actions[] and phases[], so
   tasks live in one place. Schema + chapter-folding protocol:
   ../_planning_tools/PROTOCOL.md
   ========================================================================== */
window.DOC = {
  boardId: "nextpcb_redesign",
  title: "NextPCB Redesign",
  about: "Get the four run 2 single COB designs through NextPCB's **Rev 0** DFM check, starting with the 1x1. Tick tasks in the **Current Plan** tab. Answer the open questions there or on the cards, then paste the copied JSON into the chat.",
  chapterLegend: [
    {ch:1, t:"task list from the NextPCB check on all four designs and panels. 0 of 4 designs and 0 of 4 panels pass today. Three questions open, one for later."},
    {ch:2, t:"Rev 0 is the target and its DFM is the gate. Via drill stays at 0.30 mm. The 1x1 is down to hole-to-trace errors: the plan is a 0.23 mm hole clearance on all four designs. Panels parked."},
    {ch:3, t:"Decided: Edit the file on Rev 0's errors (Q5), and order ENIG at 1.0 mm (Q3). Nothing open now."},
    {ch:4, t:"1x1: rules set to 0.23 mm, tracks shoved, refilled. KiCad's hole errors at 0.23 mm went from 200+ to 34. The last 12 track spots wait on the via spacing."},
    {ch:5, t:"1x1: vias spread and tracks finished, so KiCad's hole errors are 0. The Rev 0 errors from 2026-11-10 came from last night's zip; the fixed board hasn't been exported yet. Next: regenerate the teardrops, re-run DRC, export, upload. New tool: `git pcbdiff` shows what each change moved."},
    {ch:6, t:"Rev 0 flagged component (pad) holes at 0.233 and then 0.253 mm, while vias at 0.23 mm passed. KiCad had only one hole clearance, so our DRC missed them. New rules: **vias 0.25 mm, pad holes 0.31 mm**. The 1x1 was restarted from the original and fixed in one run of the new `tools/rev0fix`: DRC clean, teardrops rebuilt by KiCad, v3 zip exported. The other three designs are one command each."},
    {ch:7, t:"The 1x1 passed Rev 0. The same fix ran on the other three, and all are DRC clean with v1 upload zips. The 0p5x1 needed the U102 hole-spacing waiver you gave, plus two choices of mine that wait on your OK (Q7): C108 moved 0.095 mm, and vias/tracks 0.45 mm from the edge. Change report with diffs: `rev0fix_changes/index.html`."},
  ],
  chapter: 7,
  planDoc: {href:"plan.html", ch:3},

  cards: [

  {id:"GOAL", title:"Goal: pass Rev 0's DFM, one design at a time", status:"info",
    state:"Get each single COB design through NextPCB Rev 0's DFM check, starting with the 1x1. Rev 0 takes a single design and panelizes it itself, so our own panels are parked.",
    changes:[{ch:1, t:"framing"}, {ch:2, t:"target is now Rev 0, judged by its own DFM check; panels parked"}],
    stream:[
      {ch:1, by:"user", t:"We are going to have to change all of these files. Basically here we need a task list. The first things on the task are to go through each one of these and to change our designs to meet the new specifications. These designs are going to be for the single COB versions. From there, once we get all of the individual ones to pass their tests, we are going to want to panelize all of these, so we have another set of tasks that is to do this."},
      {ch:1, by:"claude", t:"Set up that way: phases 1 to 4 are the designs, and phases 5 to 8 are the panels and depend on all four. A design or panel passes when [check_board.py](check/check_board.py) prints PASS for it. Today that's 0 of 4 and 0 of 4. See [the tasks](plan.html#tasks)."},
      {ch:2, by:"user", t:"Getting the design through NextPCB Rev 0 is non-negotiable. I just sent the latest version through the pipeline and we are down to two remaining errors: \"The space between the hole and trace is not enough\", twice."},
      {ch:2, by:"claude", t:"Rewritten around that. A design is done when Rev 0's DFM shows no errors for its single-board zip. KiCad's own DRC, with the hole clearance raised to 0.23 mm, is the check before each upload. The panel upload failed with \"features not supported by Rev 0 PCBA\", and Rev 0 says it panelizes a single design itself, so phases 5 to 8 are parked ([Q6](plan.html#questions))."},
    ]},

  {id:"LIMITS", title:"The limits we're designing to", status:"info",
    state:"Rev 0 publishes 3.5 mil line/space, a 0.2 mm minimum via and ENIG (no ENEPIG). It doesn't publish hole-to-copper, so we design to 0.23 mm. check_board.py still uses the Standard PCB limits and is no longer the gate.",
    changes:[{ch:1, t:"framing"}, {ch:2, t:"Rev 0 limits; 0.23 mm hole clearance target; check_board.py demoted"}],
    stream:[
      {ch:1, by:"claude", t:"The full table is in [section 3](plan.html#limits). Both the table and the rule file come from NextPCB's page and its diagrams, read on 2026-11-09. These are published limits, not an engineering review of our files, so the final Gerbers should still go through NextPCB's own DFM check."},
      {ch:2, by:"claude", t:"Rev 0's page (https://www.nextpcb.com/rev0-pcba) gives 3.5 mil line/space, a 0.2 mm minimum via, and ENIG but not ENEPIG. Rev 0 flagged hole-to-trace gaps of 0.200 and 0.201 mm, so its hole limit is above that. The target is **0.23 mm from the hole wall**. That's NextPCB's published 0.229 mm plated-hole limit, and it's also their 0.178 mm via limit plus room for the drill to grow 0.1 mm. [check_board.py](check/check_board.py) still checks the Standard limits, so it will always fail on things Rev 0 accepted, like the 0.075 mm via ring. Use it only to measure copper to V-cuts."},
    ]},

  {id:"HOLES", title:"Hole-to-copper clearance: Rev 0's last errors", status:"open",
    state:"`tools/rev0fix` sets via hole 0.25 mm, pad hole 0.31 mm and hole to hole 0.254 / 0.3048 mm, then moves vias and track corners until KiCad's DRC is clean. That passed Rev 0 on the 1x1. The 1x0p5 and 0p5x0p5 are clean and exported. The 0p5x1 is clean and exported too, with U102's hole spacing waived. Its upload waits on Q7.",
    changes:[{ch:2, t:"new: the remaining Rev 0 errors and how to clear them"}, {ch:3, t:"decided: Edit the file"}, {ch:7, t:"1x1 passed; other three fixed and exported; Q7 open on two 0p5x1 choices"}],
    stream:[
      {ch:2, by:"user", t:"In the error section they give you two options: 1) Allow the cut trace, 2) Edit the file. Edit the file lets you upload a new gerber file. That seems easy enough. I cannot decipher the former."},
      {ch:2, by:"claude", t:"\"Allow the cut trace\" lets NextPCB's engineers shave copper off the trace beside the hole until it meets their limit. We wouldn't see what they cut, and about 150 spots on the 1x1 sit as close as the two they named, some next to the die. So I'd pick **Edit the file** ([Q5](plan.html#questions)).\n\nA scan of the 1x1 at 0.23 mm from the hole wall, counting each pair once:\n\n| What's too close to a hole | Pairs | Worst | Fix |\n|---|--:|--:|---|\n| GND pour | 54+ | 0.2005 | Board Setup + zone clearance, then refill |\n| Neighbouring via | 21 | 0.1999 | Move vias about 0.03 mm apart |\n| Track | 47 | 0.2000 | Nudge or narrow the track |\n| Teardrop | 25 | 0.2005 | Refill; delete any still too close |\n| Pad | 1 | 0.2074 | Move the via |\n\nThe pour comes from two settings. Inner-layer knockouts follow the 0.20 mm hole clearance in Board Setup, and on the outer layers the pour sits 0.15 mm from a 0.45 mm via pad, which leaves 0.225 mm to the hole. Raising those to 0.23 mm and 0.16 mm costs nothing. Once Board Setup says 0.23 mm, KiCad's DRC lists everything left to move."},
      {ch:3, by:"user", t:"We have decided to edit the file."},
      {ch:3, by:"claude", t:"Recorded. The upload task on each design now says to choose Edit the file and upload the fixed zip. Nothing on this card waits on anything: the 1x1 tasks can start with the Board Setup change."},
      {ch:7, by:"user", t:"The changes we made for the 1x1 worked. I would like for us to do the same thing for the other 3 boards. For the 0p5x1 we can disregard the spacing on the main footprint. Please also create a local html file that details the changes including the diff."},
      {ch:7, by:"claude", t:"Done on all three, each DRC clean with a v1 zip in its `production/` folder:\n\n| Board | Hole errors before → after | Vias moved | Largest via move |\n|---|--:|--:|--:|\n| 1x0p5 | 140 → 0 | 61 | 0.227 mm |\n| 0p5x1 | 194 → 0 | 75 | 0.209 mm |\n| 0p5x0p5 | 88 → 0 | 51 | 0.084 mm |\n\nOn the 0p5x1, U102's hole spacing is waived as you said. Seven via-to-U102-pad gaps stay under 0.25 mm, the smallest 0.177 mm, and copper clearance still passes. Even with the waiver, the solver found no way through. It needed two more things, which I chose and you should OK before upload ([Q7](plan.html#questions)): **C108 moved 0.095 mm left**, and **vias and tracks 0.45 mm from the board edge** instead of 0.5. That is still above NextPCB's 0.4 mm V-cut limit, and the pour stays at 0.5. The report with the rule diffs, tool diffs and per-board geometry diffs is [rev0fix_changes/index.html](rev0fix_changes/index.html)."},
    ]},

  {id:"VIAS", title:"Vias: keep the 0.30 mm drill", status:"resolved",
    state:"Decided: the via drill stays at 0.30 mm with the 0.45 mm pad, because a smaller drill raises the price. Rev 0 didn't flag the via ring.",
    changes:[{ch:1, t:"framing"}, {ch:2, t:"decided: keep 0.30 mm; via-drill tasks removed"}],
    stream:[
      {ch:1, by:"claude", t:"Every via on all four designs has a 0.075 mm ring, against a 0.089 mm minimum, and 10 to 32 hole pairs per design sit closer than 0.305 mm. A smaller drill fixes both: the ring becomes 0.10 mm and each hole-to-hole gap grows by 0.05 mm. I also tried it with a 0.04 mm mask expansion: no new mask bridges appeared outside the bond opening on any design. It may cost more, and NextPCB's note about holes being enlarged in production is part of [Q3](plan.html#questions)."},
      {ch:2, by:"user", t:"We already said we cannot shrink the via drill."},
      {ch:2, by:"claude", t:"Done: the drill stays at 0.30 mm on all four designs, and the via-drill tasks are gone. Hole clearance is fixed by moving copper instead."},
    ]},

  {id:"FINGERS", title:"Bond fingers on the three half-size designs", status:"later",
    state:"0.2 mm fingers at 0.3 mm pitch leave a 0.10 mm gap. That breaks the Standard 0.15 mm pad-to-pad limit but clears Rev 0's 3.5 mil (0.089 mm). Leave them until Rev 0's DFM says otherwise.",
    changes:[{ch:1, t:"new question from the check on all four designs"}, {ch:2, t:"parked: within Rev 0's published spacing"}],
    stream:[
      {ch:1, by:"claude", t:"This is the biggest open item, and it holds up finger and trace tasks on phases 2 to 4. NextPCB's stated reason for the 0.15 mm rule is solder mask coverage and bridging, and these fingers sit in an open mask window where neither applies. Its general spacing limit is 0.076 mm, so a 0.10 mm gap may be fine there. If NextPCB says no, the fingers go to 0.15 mm wide at the same pitch, and I can't tell from here whether that still bonds well. See [section 2](plan.html#fingers)."},
      {ch:2, by:"claude", t:"Moved to later. Rev 0 publishes 3.5 mil line/space, and the 0.10 mm gap clears that. The 0.15 mm rule was from the Standard PCB page. If Rev 0's DFM flags the fingers when a half-size design goes up, we narrow them then."},
    ]},

  {id:"DIE_HOLES", title:"Die-pad holes: PTH or vias?", status:"later",
    state:"On the 1x1, Rev 0 flagged a trace 0.201 mm from die-pad hole pad 77, so the fix is moving the PWR_AUX traces, whatever the holes are called. The 1x0p5's pad-to-pad question waits for its own Rev 0 result.",
    changes:[{ch:1, t:"new question"}, {ch:2, t:"1x1 part folded into the hole-clearance work; rest parked"}],
    stream:[
      {ch:1, by:"claude", t:"Three designs have 6 of these holes: 1x1 and 0p5x1 at 0.5/0.3, and 1x0p5 at 0.6/0.3. The 0p5x0p5 has none. On the 1x1 there are also 7 hole-to-track hits, worst 0.201 mm. On the 1x0p5, the holes are 0.225 to 0.348 mm from the nearest bond fingers, against a 0.40 mm pad-to-pad limit, and that one fails the check whichever way this goes until we settle it. If NextPCB treats them as vias, I'd drop that rule for these holes."},
      {ch:2, by:"claude", t:"One of Rev 0's two errors on the 1x1 is `PWR_AUX_1` on B.Cu, 0.201 mm from `U102` pad 77. `PWR_AUX_0` sits the same distance from pad 80. That's under the via limit as well, so asking NextPCB to treat these holes as vias wouldn't clear it. Both traces are in the 1x1 track task. The rest of this question waits until a half-size design goes through Rev 0."},
    ]},

  {id:"ORDER", title:"What goes on the NextPCB order", status:"resolved",
    state:"Decided: ENIG, 1.0 mm finished, 1 oz outer copper. Set on the Rev 0 order form; the Gerbers don't carry thickness or finish.",
    changes:[{ch:1, t:"new question"}, {ch:2, t:"Rev 0 has no ENEPIG; message to NextPCB withdrawn"}, {ch:3, t:"decided: ENIG, 1.0 mm"}],
    stream:[
      {ch:1, by:"claude", t:"All four designs and panels have the finish set to `None` and a thickness of 0.747 mm, which isn't a NextPCB option. 0.8 mm ±0.1 covers it. The zip has no stackup file, so all of this goes on the order form. There's a ready-to-send message in [section 5](plan.html#questions). I haven't contacted anyone."},
      {ch:2, by:"claude", t:"Rev 0's published finishes include ENIG but not ENEPIG, so the order is ENIG. I've withdrawn the drafted message to NextPCB: most of it asked about the via drill and the Standard limits, and Rev 0's DFM now answers those."},
      {ch:3, by:"user", t:"Let's go ahead and change the thickness to 1.0 mm, and we will also be using ENIG."},
      {ch:3, by:"claude", t:"Recorded: ENIG, 1.0 mm, and 1 oz outer copper as before. Each design's upload task now lists these for the order form. The exported zips have no stackup file, so the order form is what sets them. All four KiCad files still say 0.747 mm in Board Setup. That changes nothing in the Gerbers, but it's worth setting to 1.0 mm when convenient so the files and 3D renders match the order. If anything mates against the board's thickness, check it against 1.0 mm."},
    ]},

  {id:"PANEL_FLOW", title:"Panels", status:"later",
    state:"Parked. Rev 0 doesn't take pre-panelized files, and it panelizes a single design itself. If we panelize again later, don't refill zones on a panel.",
    changes:[{ch:1, t:"framing"}, {ch:2, t:"parked under Rev 0"}],
    stream:[
      {ch:1, by:"claude", t:"I found no panelization script in this repo, and each panel file holds 5 to 9 stackup definitions, so I've written the tasks without assuming a tool. One hard rule from the check: don't refill zones on a panel. `Edge.Cuts` is only the outer rectangle, so a refill runs GND copper straight to the V-cuts (0.0 mm against a 0.4 mm limit, seen on the 1x1 panel). Saved panels hold 0.5 mm or more today."},
      {ch:2, by:"claude", t:"Phases 5 to 8 are parked. The 1x1 panel upload failed with \"features not supported by Rev 0 PCBA\", and Rev 0's route is one design that NextPCB panelizes. The two test zips that passed hid the V-cuts, so they aren't order files."},
    ]},

  ],

  questions: [
    {id:"Q1", card:"FINGERS", ch:1, status:"later", q:"The half-size bond fingers have 0.10 mm gaps. Ask NextPCB to accept that inside the open mask window, or narrow the fingers to 0.15 mm wide now?"},
    {id:"Q2", card:"DIE_HOLES", ch:1, status:"later", q:"Should the die-pad holes count as vias, as long as NextPCB agrees, or be redesigned to meet the PTH limits?"},
    {id:"Q3", card:"ORDER", ch:1, status:"answered", ach:3, q:"Are ENIG, 0.8 mm and 1 oz outer copper right for the Rev 0 order? (Rev 0 has no ENEPIG.)", answer:"ENIG, but 1.0 mm finished instead of 0.8 mm. 1 oz outer copper unchanged."},
    {id:"Q4", card:"PANEL_FLOW", ch:1, status:"later", q:"How were the panels built, and do you want that scripted so the four rebuilds match?"},
    {id:"Q5", card:"HOLES", ch:2, status:"answered", ach:3, q:"For Rev 0's hole-to-trace errors, pick \"Allow the cut trace\" or \"Edit the file\"?", answer:"Edit the file: fix the copper in KiCad and upload a new zip."},
    {id:"Q6", card:"PANEL_FLOW", ch:2, status:"later", q:"Rev 0 panelizes a single design itself. Do we still need our own panels, for another fab or a later run?"},
    {id:"Q7", card:"HOLES", ch:7, status:"open", q:"OK to upload the 0p5x1 with C108 moved 0.095 mm left, and vias and tracks 0.45 mm from the board edge (pour still 0.5 mm, NextPCB's V-cut limit 0.4 mm)?"},
  ],

  actions: [
    /* ---- Phase 1: 1x1 ---- */
    {id:"D1-DUP", ch:1, status:"done", what:"Delete the **2 duplicate vias**: `/pad_3` at (165.250, 87.804) and `/pad_4` at (165.790, 88.210). Done 2026-11-10; it cleared Rev 0's two hole-spacing errors."},
    {id:"D1-RULES", ch:6, status:"done", what:"Restarted from the original board (3088e84, duplicates removed) on 2026-11-10. `tools/rev0fix` sets the rules: **via hole 0.25 mm** in Board Setup, and **pad (component) hole 0.31 mm** plus **0.3048 mm different-net hole to hole** in `1x1-mezzanine.kicad_dru`. Rev 0 flagged pad holes at 0.233 and 0.253 mm but passed vias at 0.23, and KiCad has only one hole clearance in Board Setup, so the pad-hole rule lives in the `.kicad_dru`. That is why our DRC missed pad 77."},
    {id:"D1-VIAVIA", ch:6, status:"done", what:"One solver round from the original: **64 vias** moved (7 over 0.1 mm), with their tracks dragged along. 0 hole-to-hole spots under 0.30 mm (was 21 errors)."},
    {id:"D1-TRACKS", ch:6, status:"done", what:"Same round: **81 track corners** moved, 322 tracks touched in all. Track-to-track distance is now measured exactly, not sampled. A sampled check missed a 0.083 mm `/pad_24` to `PWR_AUX_0` spot on the first try."},
    {id:"D1-TEARS", ch:6, status:"done", what:"**Rebuilt by KiCad**, not shifted: `kicad-cli pcb drc --refill-zones --save-board` regenerates teardrops to fit the moved tracks. 160 → 153 teardrops, because KiCad drops the ones that no longer fit."},
    {id:"D1-DRC", ch:6, status:"done", what:"Clean: 0 hole, hole-to-hole and copper errors, 0 unconnected, and only the 24 old library, courtyard, silk and text items. Every pad hole is ≥ 0.31 mm from other copper, and every via hole ≥ 0.2505 mm. Diff vs original: `git pcbdiff 3088e84 --target 0.25`."},
    {id:"D1-EXPORT", ch:6, status:"done", what:"**`run-2/1x1-cob/production/1x1-mezzanine_REV0-UPLOAD_2026-11-10_v3.zip`** (16:27), the only zip in `production/`. 12 files: no drill maps and no empty NPTH file, same as the zips that reached Rev 0. The v1 and v2 zips were removed; v2 was flagged at pad 77."},
    {id:"D1-REV0", ch:7, status:"done", what:"Uploaded **the v3 zip** to Rev 0 with **ENIG, 1.0 mm, 1 oz outer copper**. **Passed: its DFM showed no errors.**"},

    /* ---- Phase 2: 1x0p5 ---- */
    {id:"D2-RULES", ch:7, status:"done", what:"`rev0fix` set the Rev 0 rules (via hole 0.25 mm, pad hole 0.31 mm, hole to hole 0.254 / 0.3048 mm) in `mezzanine-1x0p5.kicad_pro` and `.kicad_dru`."},
    {id:"D2-COPPER", ch:7, status:"done", what:"Two rounds: **61 vias** (largest 0.227 mm) and 334 track pieces moved. DRC hole errors **140 → 0**, 0 unconnected. One new harmless warning: a 0.35 mm GND stub off U101's MP pad no longer ends in the pour."},
    {id:"D2-REV0", ch:7, status:"ready", what:"Upload **`run-2/1x0p5-cob/production/mezzanine-1x0p5_REV0-UPLOAD_2026-11-12_v1.zip`** to Rev 0 (ENIG, 1.0 mm, 1 oz; Edit the file on errors). **Done when its DFM shows no errors.** Fix anything new it raises, such as the bond fingers (Q1) or the die-pad holes (Q2)."},

    /* ---- Phase 3: 0p5x1 ---- */
    {id:"D3-RULES", ch:7, status:"done", what:"Same Rev 0 rules, plus `rev0_ignore_U102` (hole spacing at U102 waived, by request) and vias/tracks **0.45 mm** from the edge with the pour kept at 0.5 mm (Q7)."},
    {id:"D3-COPPER", ch:7, status:"done", what:"**C108 moved 0.095 mm left** (Q7), then four solver rounds: **75 vias** (largest 0.209 mm) and 426 track pieces moved. Two hand fixes after: a VDD_CORE_1 corner 4 µm off U102 pad 78, and the /bidir_22 via moved 0.2 mm to close a 0.088 mm GND spur. DRC hole errors **194 → 0**, 0 unconnected."},
    {id:"D3-REV0", ch:7, status:"blocked", waiting:["Q7"], what:"Upload **`run-2/0p5x1-cob/production/mezzanine-0p5x1_REV0-UPLOAD_2026-11-14_v1.zip`** to Rev 0 (ENIG, 1.0 mm, 1 oz; Edit the file on errors). **Done when its DFM shows no errors.** Watch for U102: its hole spacing is waived, the smallest via-to-pad hole gap 0.177 mm."},

    /* ---- Phase 4: 0p5x0p5 ---- */
    {id:"D4-RULES", ch:7, status:"done", what:"`rev0fix` set the Rev 0 rules (via hole 0.25 mm, pad hole 0.31 mm, hole to hole 0.254 / 0.3048 mm) in `0p5x0p5-cob.kicad_pro` and `.kicad_dru`."},
    {id:"D4-COPPER", ch:7, status:"done", what:"One round: **51 vias** (largest 0.084 mm) and 270 track pieces moved. DRC hole errors **88 → 0**, 0 unconnected, no new warnings."},
    {id:"D4-REV0", ch:7, status:"ready", what:"Upload **`run-2/0p5x0p5-cob/production/0p5x0p5-cob_REV0-UPLOAD_2026-11-12_v1.zip`** to Rev 0 (ENIG, 1.0 mm, 1 oz; Edit the file on errors). **Done when its DFM shows no errors.**"},

    /* ---- Phase 5: 1x1 panel (parked) ---- */
    {id:"P1-BUILD", ch:1, status:"ready", what:"Rebuild from the passing `1x1-mezzanine.kicad_pcb`: 6 × 4 boards, 14 V-cuts, 7 mm rails. **Don't refill zones on the panel.** Should clear its panel-only failures: 48 via-to-copper hits (worst 0.176 mm) and 48 single-spoke thermals."},
    {id:"P1-SETUP", ch:1, status:"ready", what:"Reduce the board file to 1 stackup definition (it has 7), and match the panel's Board Setup to the design's."},
    {id:"P1-SILK", ch:1, status:"ready", what:"Keep the `R#C#` labels at least 0.152 mm from the bond opening (they touch it today), and update the revision text."},
    {id:"P1-PASS", ch:1, status:"ready", what:"KiCad DRC clean, and `check_board.py` shows copper at least 0.4 mm from every V-cut on `run-2/1x1-cob/panelization/panel.kicad_pcb`."},
    {id:"P1-EXPORT", ch:2, status:"ready", what:"Export to `production/` with Fabrication Toolkit, auto fill off, on a machine with the Audiowide font."},

    /* ---- Phase 6: 1x0p5 panel (parked) ---- */
    {id:"P2-BUILD", ch:1, status:"ready", what:"Rebuild from the passing `mezzanine-1x0p5.kicad_pcb`: 6 × 4 boards, 14 V-cuts, 7 mm rails. **Don't refill zones on the panel.** Should clear its panel-only failure: 72 single-spoke thermals."},
    {id:"P2-SETUP", ch:1, status:"ready", what:"Reduce the board file to 1 stackup definition (it has 5), and match the panel's Board Setup to the design's."},
    {id:"P2-SILK", ch:1, status:"ready", what:"Keep the `R#C#` labels at least 0.152 mm from the bond opening, and update the revision text."},
    {id:"P2-PASS", ch:1, status:"ready", what:"KiCad DRC clean, and `check_board.py` shows copper at least 0.4 mm from every V-cut on `run-2/1x0p5-cob/panelization/panel.kicad_pcb`."},
    {id:"P2-EXPORT", ch:2, status:"ready", what:"Export to `production/` with Fabrication Toolkit, auto fill off, on a machine with the Audiowide font."},

    /* ---- Phase 7: 0p5x1 panel (parked) ---- */
    {id:"P3-BUILD", ch:1, status:"ready", what:"Rebuild from the passing `mezzanine-0p5x1.kicad_pcb`: 6 × 4 boards, 14 V-cuts, 7 mm rails. **Don't refill zones on the panel.** Should clear its panel-only failures: 48 copper spacing hits (worst 0.075 mm), 24 via-to-copper hits (worst 0.169 mm) and 144 single-spoke thermals."},
    {id:"P3-SETUP", ch:1, status:"ready", what:"Reduce the board file to 1 stackup definition (it has 8), and match the panel's Board Setup to the design's."},
    {id:"P3-SILK", ch:1, status:"ready", what:"Keep the `R#C#` labels at least 0.152 mm from the bond opening, and update the revision text."},
    {id:"P3-PASS", ch:1, status:"ready", what:"KiCad DRC clean, and `check_board.py` shows copper at least 0.4 mm from every V-cut on `run-2/0p5x1-cob/panelization/panel.kicad_pcb`."},
    {id:"P3-EXPORT", ch:2, status:"ready", what:"Export to `production/` with Fabrication Toolkit, auto fill off, on a machine with the Audiowide font."},

    /* ---- Phase 8: 0p5x0p5 panel (parked) ---- */
    {id:"P4-BUILD", ch:1, status:"ready", what:"Rebuild from the passing `0p5x0p5-cob.kicad_pcb`: 6 × 4 boards, 14 V-cuts, 7 mm rails. **Don't refill zones on the panel.** Should clear its panel-only failures: 96 copper spacing hits (worst 0.072 mm) and 48 via-to-copper hits (worst 0.172 mm)."},
    {id:"P4-SETUP", ch:1, status:"ready", what:"Reduce the board file to 1 stackup definition (it has 9), and match the panel's Board Setup to the design's."},
    {id:"P4-SILK", ch:1, status:"ready", what:"Keep the `R#C#` labels at least 0.152 mm from the bond opening, and update the revision text."},
    {id:"P4-PASS", ch:1, status:"ready", what:"KiCad DRC clean, and `check_board.py` shows copper at least 0.4 mm from every V-cut on `run-2/0p5x0p5-cob/panelization/panel.kicad_pcb`."},
    {id:"P4-EXPORT", ch:2, status:"ready", what:"Export to `production/` with Fabrication Toolkit, auto fill off, on a machine with the Audiowide font."},
  ],

  phases: [
    {n:1, id:"P1", title:"Design: 1x1", status:"done", risk:"low",
      goal:"Clear Rev 0's last two errors on `1x1-mezzanine` by holding every hole 0.23 mm from other copper, then re-upload.",
      acts:["D1-DUP","D1-RULES","D1-VIAVIA","D1-TRACKS","D1-TEARS","D1-DRC","D1-EXPORT","D1-REV0"],
      verify:"NextPCB Rev 0's DFM shows no errors for `run-2/1x1-cob/production/1x1-mezzanine.zip`.",
      audit:"The bond fingers sit at exactly 0.150 mm, so don't let a moved via or track shrink that gap. Don't shrink the via drill."},
    {n:2, id:"P2", title:"Design: 1x0p5", status:"ready", risk:"med",
      goal:"Same route as the 1x1 for `mezzanine-1x0p5`.",
      acts:["D2-RULES","D2-COPPER","D2-REV0"],
      verify:"Rev 0's DFM shows no errors for the 1x0p5 single-board zip.",
      audit:"This is the design whose die-pad holes sit 0.225 mm from the bond fingers. Watch whether Rev 0 flags them."},
    {n:3, id:"P3", title:"Design: 0p5x1", status:"ready", risk:"med",
      goal:"Same route as the 1x1 for `mezzanine-0p5x1`.",
      acts:["D3-RULES","D3-COPPER","D3-REV0"],
      verify:"Rev 0's DFM shows no errors for the 0p5x1 single-board zip.",
      audit:"The most copper to move of the four. `C102` sits 0.136 mm from pin 1 fiducial `J1`; move it if Rev 0 flags it."},
    {n:4, id:"P4", title:"Design: 0p5x0p5", status:"ready", risk:"low",
      goal:"Same route as the 1x1 for `0p5x0p5-cob`. It has no die-pad holes.",
      acts:["D4-RULES","D4-COPPER","D4-REV0"],
      verify:"Rev 0's DFM shows no errors for the 0p5x0p5 single-board zip.",
      audit:"Fewest via pairs of the four, but more track spots than the 1x1."},
    {n:5, id:"P5", title:"Panel: 1x1", status:"deferred", risk:"low", depends:["P1","P2","P3","P4"],
      goal:"Parked: Rev 0 panelizes for us (Q6). Kept in case we panelize for another fab.",
      acts:["P1-BUILD","P1-SETUP","P1-SILK","P1-PASS","P1-EXPORT"],
      verify:"KiCad DRC clean and copper at least 0.4 mm from every V-cut.",
      audit:"Don't refill zones on the panel. A refill runs GND copper to the V-cuts."},
    {n:6, id:"P6", title:"Panel: 1x0p5", status:"deferred", risk:"low", depends:["P1","P2","P3","P4"],
      goal:"Parked: Rev 0 panelizes for us (Q6).",
      acts:["P2-BUILD","P2-SETUP","P2-SILK","P2-PASS","P2-EXPORT"],
      verify:"KiCad DRC clean and copper at least 0.4 mm from every V-cut.",
      audit:"Don't refill zones on the panel."},
    {n:7, id:"P7", title:"Panel: 0p5x1", status:"deferred", risk:"low", depends:["P1","P2","P3","P4"],
      goal:"Parked: Rev 0 panelizes for us (Q6).",
      acts:["P3-BUILD","P3-SETUP","P3-SILK","P3-PASS","P3-EXPORT"],
      verify:"KiCad DRC clean and copper at least 0.4 mm from every V-cut.",
      audit:"Don't refill zones on the panel."},
    {n:8, id:"P8", title:"Panel: 0p5x0p5", status:"deferred", risk:"low", depends:["P1","P2","P3","P4"],
      goal:"Parked: Rev 0 panelizes for us (Q6).",
      acts:["P4-BUILD","P4-SETUP","P4-SILK","P4-PASS","P4-EXPORT"],
      verify:"KiCad DRC clean and copper at least 0.4 mm from every V-cut.",
      audit:"Don't refill zones on the panel."},
  ],

  plan: "Get each run 2 single COB design through NextPCB Rev 0's DFM check. The fix on every design is `tools/rev0fix`: via hole 0.25 mm, pad hole 0.31 mm, hole to hole 0.254 / 0.3048 mm, then vias and track corners moved until KiCad's DRC is clean. The via drill stays at 0.30 mm. **The 1x1 passed Rev 0.** The 1x0p5 and 0p5x0p5 are DRC clean with v1 zips, ready to upload. The 0p5x1 is clean and exported with U102's hole spacing waived. Its upload waits on Q7, for C108 moved 0.095 mm and 0.45 mm via/track edge clearance. Upload with ENIG, 1.0 mm and 1 oz outer copper, and choose Edit the file if anything is left. Change report: `rev0fix_changes/index.html`. Our own panels are parked because Rev 0 panelizes for us.",
  planChanges: [
    {ch:1, t:"first version: 8 phases and 48 tasks, from a check of all four designs and panels"},
    {ch:2, t:"Rev 0 is the target and its DFM is the gate; via drill stays 0.30 mm; hole clearance 0.23 mm on all four designs; panels parked"},
    {ch:3, t:"decided: Edit the file on Rev 0 errors; order ENIG, 1.0 mm, 1 oz"},
    {ch:4, t:"1x1: D1-RULES done; tracks shoved 49 → 12 spots; D1-VIAVIA next, then re-run the shove; regenerate teardrops before export"},
    {ch:5, t:"1x1: D1-VIAVIA and D1-TRACKS done; 0 hole errors in KiCad DRC; teardrops, export and upload left"},
    {ch:6, t:"separate hole clearances: vias 0.25 mm, pad holes 0.31 mm; 1x1 restarted from the original and fixed with `tools/rev0fix` (v3 zip); other designs use the same command"},
    {ch:7, t:"1x1 passed Rev 0; 1x0p5, 0p5x1, 0p5x0p5 fixed and exported (v1 zips); U102 hole spacing waived on 0p5x1; Q7 open on C108 move and 0.45 mm edge; change report added"},
  ],
};
