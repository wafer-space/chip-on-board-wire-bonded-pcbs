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
  about: "Bring the four run 2 single COB designs within NextPCB's published limits, then rebuild the four panels from them. Tick tasks in the **Current Plan** tab. Answer the open questions there or on the cards, then paste the copied JSON into the chat.",
  chapterLegend: [
    {ch:1, t:"task list from the NextPCB check on all four designs and panels. 0 of 4 designs and 0 of 4 panels pass today. Three questions open, one for later."},
  ],
  chapter: 1,
  planDoc: {href:"plan.html", ch:1},

  cards: [

  {id:"GOAL", title:"Goal: four passing designs, then four panels", status:"info",
    state:"Fix the single COB designs first. Rebuild the panels only after all four designs pass, because each panel is built from its design.",
    changes:[{ch:1, t:"framing"}],
    stream:[
      {ch:1, by:"user", t:"We are going to have to change all of these files. Basically here we need a task list. The first things on the task are to go through each one of these and to change our designs to meet the new specifications. These designs are going to be for the single COB versions. From there, once we get all of the individual ones to pass their tests, we are going to want to panelize all of these, so we have another set of tasks that is to do this."},
      {ch:1, by:"claude", t:"Set up that way: phases 1 to 4 are the designs, and phases 5 to 8 are the panels and depend on all four. A design or panel passes when [check_board.py](check/check_board.py) prints PASS for it. Today that's 0 of 4 and 0 of 4. See [the tasks](plan.html#tasks)."},
    ]},

  {id:"LIMITS", title:"The limits we're designing to", status:"info",
    state:"NextPCB's Standard PCB limits, assuming 1 oz finished outer copper. They're encoded in check/nextpcb.kicad_dru. Silk and text hits are reported but don't fail a board, except text height.",
    changes:[{ch:1, t:"framing"}],
    stream:[
      {ch:1, by:"claude", t:"The full table is in [section 3](plan.html#limits). Both the table and the rule file come from NextPCB's page and its diagrams, read on 2026-11-09. These are published limits, not an engineering review of our files, so the final Gerbers should still go through NextPCB's own DFM check."},
    ]},

  {id:"VIAS", title:"Via drill: 0.30 to 0.25 mm, keeping the 0.45 mm pad", status:"info",
    state:"Tested on scratch copies of all four designs. Clears every via ring and hole-to-hole failure, without moving a via. Cost and NextPCB's hole enlargement are still to confirm.",
    changes:[{ch:1, t:"framing"}],
    stream:[
      {ch:1, by:"claude", t:"Every via on all four designs has a 0.075 mm ring, against a 0.089 mm minimum, and 10 to 32 hole pairs per design sit closer than 0.305 mm. A smaller drill fixes both: the ring becomes 0.10 mm and each hole-to-hole gap grows by 0.05 mm. I also tried it with a 0.04 mm mask expansion: no new mask bridges appeared outside the bond opening on any design. It may cost more, and NextPCB's note about holes being enlarged in production is part of [Q3](plan.html#questions)."},
    ]},

  {id:"FINGERS", title:"Bond fingers on the three half-size designs", status:"open",
    state:"0.2 mm fingers at 0.3 mm pitch leave a 0.10 mm gap, and the limit is 0.15 mm. Lean: ask NextPCB first, because the fix on our side is narrower fingers. The 1x1 passes at exactly 0.15 mm.",
    changes:[{ch:1, t:"new question from the check on all four designs"}],
    stream:[
      {ch:1, by:"claude", t:"This is the biggest open item, and it holds up finger and trace tasks on phases 2 to 4. NextPCB's stated reason for the 0.15 mm rule is solder mask coverage and bridging, and these fingers sit in an open mask window where neither applies. Its general spacing limit is 0.076 mm, so a 0.10 mm gap may be fine there. If NextPCB says no, the fingers go to 0.15 mm wide at the same pitch, and I can't tell from here whether that still bonds well. See [section 2](plan.html#fingers)."},
    ]},

  {id:"DIE_HOLES", title:"Die-pad holes: PTH or vias?", status:"open",
    state:"The drill file marks them as component holes. As vias they pass. As PTH they miss the 0.2 mm ring on three designs, and the 1x1 also misses the 0.229 mm hole-to-track limit. Lean: ask NextPCB to treat them as vias.",
    changes:[{ch:1, t:"new question"}],
    stream:[
      {ch:1, by:"claude", t:"Three designs have 6 of these holes: 1x1 and 0p5x1 at 0.5/0.3, and 1x0p5 at 0.6/0.3. The 0p5x0p5 has none. On the 1x1 there are also 7 hole-to-track hits, worst 0.201 mm. On the 1x0p5, the holes are 0.225 to 0.348 mm from the nearest bond fingers, against a 0.40 mm pad-to-pad limit, and that one fails the check whichever way this goes until we settle it. If NextPCB treats them as vias, I'd drop that rule for these holes."},
    ]},

  {id:"ORDER", title:"What goes on the NextPCB order", status:"open",
    state:"Lean: ENEPIG, 0.8 mm finished, 1 oz outer copper. ENEPIG is on the Advanced quote only, whose page publishes no rigid-board ring or hole limits, so ask which limits apply.",
    changes:[{ch:1, t:"new question"}],
    stream:[
      {ch:1, by:"claude", t:"All four designs and panels have the finish set to `None` and a thickness of 0.747 mm, which isn't a NextPCB option. 0.8 mm ±0.1 covers it. The zip has no stackup file, so all of this goes on the order form. There's a ready-to-send message in [section 5](plan.html#questions). I haven't contacted anyone."},
    ]},

  {id:"PANEL_FLOW", title:"How the panels get rebuilt", status:"later",
    state:"Whatever flow made them last time, with zones not refilled on the panel. Whether to script it can wait.",
    changes:[{ch:1, t:"framing"}],
    stream:[
      {ch:1, by:"claude", t:"I found no panelization script in this repo, and each panel file holds 5 to 9 stackup definitions, so I've written the tasks without assuming a tool. One hard rule from the check: don't refill zones on a panel. `Edge.Cuts` is only the outer rectangle, so a refill runs GND copper straight to the V-cuts (0.0 mm against a 0.4 mm limit, seen on the 1x1 panel). Saved panels hold 0.5 mm or more today."},
    ]},

  ],

  questions: [
    {id:"Q1", card:"FINGERS", ch:1, status:"open", q:"The half-size bond fingers have 0.10 mm gaps. Ask NextPCB to accept that inside the open mask window, or narrow the fingers to 0.15 mm wide now?"},
    {id:"Q2", card:"DIE_HOLES", ch:1, status:"open", q:"Should the die-pad holes count as vias, as long as NextPCB agrees, or be redesigned to meet the PTH limits?"},
    {id:"Q3", card:"ORDER", ch:1, status:"open", q:"Are ENEPIG, 0.8 mm and 1 oz outer copper right for the order, and will you send NextPCB the questions in section 5?"},
    {id:"Q4", card:"PANEL_FLOW", ch:1, status:"later", q:"How were the panels built, and do you want that scripted so the four rebuilds match?"},
  ],

  actions: [
    /* ---- Phase 1: 1x1 ---- */
    {id:"D1-VIA", ch:1, status:"ready", what:"Change all **93 vias** from 0.45/0.30 to **0.45/0.25**. Clears 93 ring failures and 21 hole-to-hole failures (worst 0.275 mm)."},
    {id:"D1-DUP", ch:1, status:"ready", what:"Delete the **2 duplicate vias**: `/pad_3` at (165.250, 87.804) and `/pad_4` at (165.790, 88.210)."},
    {id:"D1-TRACE", ch:1, status:"ready", what:"Move the `/pad_53` trace on B.Cu away from pad 29 of `U101`. The gap is 0.100 mm and needs 0.102 mm."},
    {id:"D1-SETUP", ch:1, status:"ready", what:"In Board Setup, set solder mask expansion to **0.04 mm** and the minimum via ring to 0.09 mm."},
    {id:"D1-SILK", ch:1, status:"ready", what:"Raise the pin 1 `1` silk text from 0.75 to 0.80 mm."},
    {id:"D1-HOLES", ch:1, status:"blocked", waiting:["Q2"], what:"Die-pad holes: 6 PTH pads at 0.5/0.3, with 7 hole-to-track hits (worst 0.201 mm) on `PWR_AUX_0`, `PWR_AUX_1` and `/pad_27`. Nothing to do if NextPCB treats them as vias."},
    {id:"D1-PASS", ch:1, status:"ready", what:"Refill zones, save, and run the check on `run-2/1x1-cob/1x1-mezzanine.kicad_pcb`. **Done when it prints PASS.**"},

    /* ---- Phase 2: 1x0p5 ---- */
    {id:"D2-VIA", ch:1, status:"ready", what:"Change all **92 vias** from 0.45/0.30 to **0.45/0.25**. Clears 92 ring failures and 23 hole-to-hole failures (worst 0.280 mm)."},
    {id:"D2-FINGERS", ch:1, status:"blocked", waiting:["Q1"], what:"Bond finger gaps in `waferspace_1x0p5_padring_v0.1`: 46 under 0.15 mm (30 at 0.100, 4 at 0.107, 12 at 0.118 around the 45° corners)."},
    {id:"D2-TRACES", ch:1, status:"blocked", waiting:["Q1"], what:"11 traces sit 0.100 mm from a finger and need 0.102 mm. Narrower fingers would clear these too."},
    {id:"D2-HOLES", ch:1, status:"blocked", waiting:["Q2"], what:"Die-pad holes: 6 PTH pads at 0.6/0.3. 12 pad-to-pad hits, 0.225 to 0.348 mm from nearby fingers against a 0.40 mm limit."},
    {id:"D2-SETUP", ch:1, status:"ready", what:"In Board Setup, set solder mask expansion to **0.04 mm** and the minimum via ring to 0.09 mm."},
    {id:"D2-SILK", ch:1, status:"ready", what:"Raise the pin 1 `1` silk text from 0.75 to 0.80 mm."},
    {id:"D2-PASS", ch:1, status:"ready", what:"Refill zones, save, and run the check on `run-2/1x0p5-cob/mezzanine-1x0p5.kicad_pcb`. **Done when it prints PASS.**"},

    /* ---- Phase 3: 0p5x1 ---- */
    {id:"D3-VIA", ch:1, status:"ready", what:"Change all **85 vias** to a 0.25 mm drill: 84 at 0.45/0.30 and 1 at 0.50/0.30. Clears 84 ring failures and 32 hole-to-hole failures (worst 0.275 mm)."},
    {id:"D3-FINGERS", ch:1, status:"blocked", waiting:["Q1"], what:"Bond finger gaps in `waferspace_p5x1_padring_v0.2`: 54 at 0.100 mm, where 0.15 mm is needed."},
    {id:"D3-TRACES", ch:1, status:"blocked", waiting:["Q1"], what:"13 traces sit 0.100 mm from a finger and need 0.102 mm. Narrower fingers would clear these too."},
    {id:"D3-C102", ch:1, status:"ready", what:"Move `C102` away from pin 1 fiducial `J1`. Pad 1 is 0.136 mm from J1's through-hole pad and needs 0.40 mm."},
    {id:"D3-HOLES", ch:1, status:"blocked", waiting:["Q2"], what:"Die-pad holes: 6 PTH pads at 0.5/0.3. Nothing to do if NextPCB treats them as vias."},
    {id:"D3-SETUP", ch:1, status:"ready", what:"In Board Setup, set solder mask expansion to **0.04 mm** and the minimum via ring to 0.09 mm."},
    {id:"D3-SILK", ch:1, status:"ready", what:"Raise the pin 1 `1` silk text from 0.75 to 0.80 mm."},
    {id:"D3-PASS", ch:1, status:"ready", what:"Refill zones, save, and run the check on `run-2/0p5x1-cob/mezzanine-0p5x1.kicad_pcb`. **Done when it prints PASS.**"},

    /* ---- Phase 4: 0p5x0p5 ---- */
    {id:"D4-VIA", ch:1, status:"ready", what:"Change all **70 vias** from 0.45/0.30 to **0.45/0.25**. Clears 70 ring failures and 10 hole-to-hole failures (worst 0.275 mm)."},
    {id:"D4-FINGERS", ch:1, status:"blocked", waiting:["Q1"], what:"Bond finger gaps in `waferspace_p5xp5_padring`: 42 at 0.100 mm, where 0.15 mm is needed."},
    {id:"D4-TRACES", ch:1, status:"blocked", waiting:["Q1"], what:"9 traces sit 0.100 mm from a finger and need 0.102 mm. Narrower fingers would clear these too."},
    {id:"D4-SETUP", ch:1, status:"ready", what:"In Board Setup, set solder mask expansion to **0.04 mm** and the minimum via ring to 0.09 mm."},
    {id:"D4-SILK", ch:1, status:"ready", what:"Raise the pin 1 `1` silk text from 0.75 to 0.80 mm."},
    {id:"D4-PASS", ch:1, status:"ready", what:"Refill zones, save, and run the check on `run-2/0p5x0p5-cob/0p5x0p5-cob.kicad_pcb`. **Done when it prints PASS.**"},

    /* ---- Phase 5: 1x1 panel ---- */
    {id:"P1-BUILD", ch:1, status:"ready", what:"Rebuild from the passing `1x1-mezzanine.kicad_pcb`: 6 × 4 boards, 14 V-cuts, 7 mm rails. **Don't refill zones on the panel.** Should clear its panel-only failures: 48 via-to-copper hits (worst 0.176 mm) and 48 single-spoke thermals."},
    {id:"P1-SETUP", ch:1, status:"ready", what:"Reduce the board file to 1 stackup definition (it has 7), and match the panel's Board Setup to the design's."},
    {id:"P1-SILK", ch:1, status:"ready", what:"Keep the `R#C#` labels at least 0.152 mm from the bond opening (they touch it today), and update the revision text."},
    {id:"P1-PASS", ch:1, status:"ready", what:"Run the check on `run-2/1x1-cob/panelization/panel.kicad_pcb`. **Done when it prints PASS.**"},
    {id:"P1-EXPORT", ch:1, status:"ready", what:"Export to `production/` with Fabrication Toolkit, auto fill off, on a machine with the Audiowide font. Confirm the drill file shows 0.25 mm via holes."},

    /* ---- Phase 6: 1x0p5 panel ---- */
    {id:"P2-BUILD", ch:1, status:"ready", what:"Rebuild from the passing `mezzanine-1x0p5.kicad_pcb`: 6 × 4 boards, 14 V-cuts, 7 mm rails. **Don't refill zones on the panel.** Should clear its panel-only failure: 72 single-spoke thermals."},
    {id:"P2-SETUP", ch:1, status:"ready", what:"Reduce the board file to 1 stackup definition (it has 5), and match the panel's Board Setup to the design's."},
    {id:"P2-SILK", ch:1, status:"ready", what:"Keep the `R#C#` labels at least 0.152 mm from the bond opening, and update the revision text."},
    {id:"P2-PASS", ch:1, status:"ready", what:"Run the check on `run-2/1x0p5-cob/panelization/panel.kicad_pcb`. **Done when it prints PASS.**"},
    {id:"P2-EXPORT", ch:1, status:"ready", what:"Export to `production/` with Fabrication Toolkit, auto fill off, on a machine with the Audiowide font. Confirm the drill file shows 0.25 mm via holes."},

    /* ---- Phase 7: 0p5x1 panel ---- */
    {id:"P3-BUILD", ch:1, status:"ready", what:"Rebuild from the passing `mezzanine-0p5x1.kicad_pcb`: 6 × 4 boards, 14 V-cuts, 7 mm rails. **Don't refill zones on the panel.** Should clear its panel-only failures: 48 copper spacing hits (worst 0.075 mm), 24 via-to-copper hits (worst 0.169 mm) and 144 single-spoke thermals."},
    {id:"P3-SETUP", ch:1, status:"ready", what:"Reduce the board file to 1 stackup definition (it has 8), and match the panel's Board Setup to the design's."},
    {id:"P3-SILK", ch:1, status:"ready", what:"Keep the `R#C#` labels at least 0.152 mm from the bond opening, and update the revision text."},
    {id:"P3-PASS", ch:1, status:"ready", what:"Run the check on `run-2/0p5x1-cob/panelization/panel.kicad_pcb`. **Done when it prints PASS.**"},
    {id:"P3-EXPORT", ch:1, status:"ready", what:"Export to `production/` with Fabrication Toolkit, auto fill off, on a machine with the Audiowide font. Confirm the drill file shows 0.25 mm via holes."},

    /* ---- Phase 8: 0p5x0p5 panel ---- */
    {id:"P4-BUILD", ch:1, status:"ready", what:"Rebuild from the passing `0p5x0p5-cob.kicad_pcb`: 6 × 4 boards, 14 V-cuts, 7 mm rails. **Don't refill zones on the panel.** Should clear its panel-only failures: 96 copper spacing hits (worst 0.072 mm) and 48 via-to-copper hits (worst 0.172 mm)."},
    {id:"P4-SETUP", ch:1, status:"ready", what:"Reduce the board file to 1 stackup definition (it has 9), and match the panel's Board Setup to the design's."},
    {id:"P4-SILK", ch:1, status:"ready", what:"Keep the `R#C#` labels at least 0.152 mm from the bond opening, and update the revision text."},
    {id:"P4-PASS", ch:1, status:"ready", what:"Run the check on `run-2/0p5x0p5-cob/panelization/panel.kicad_pcb`. **Done when it prints PASS.**"},
    {id:"P4-EXPORT", ch:1, status:"ready", what:"Export to `production/` with Fabrication Toolkit, auto fill off, on a machine with the Audiowide font. Confirm the drill file shows 0.25 mm via holes."},
  ],

  phases: [
    {n:1, id:"P1", title:"Design: 1x1", status:"ready", risk:"low",
      goal:"Bring `1x1-mezzanine` within the limits. It's the only design with no finger gap failures, so start here to prove the via change on real copper.",
      acts:["D1-VIA","D1-DUP","D1-TRACE","D1-SETUP","D1-SILK","D1-HOLES","D1-PASS"],
      verify:"`python planning/nextpcb_redesign/check/check_board.py run-2/1x1-cob/1x1-mezzanine.kicad_pcb` prints PASS.",
      audit:"The bond fingers pass at exactly 0.150 mm, so don't let anything shrink that gap."},
    {n:2, id:"P2", title:"Design: 1x0p5", status:"ready", risk:"high",
      goal:"Bring `mezzanine-1x0p5` within the limits. The hardest design: finger gaps as well as die-pad holes near the fingers.",
      acts:["D2-VIA","D2-FINGERS","D2-TRACES","D2-HOLES","D2-SETUP","D2-SILK","D2-PASS"],
      verify:"`python planning/nextpcb_redesign/check/check_board.py run-2/1x0p5-cob/mezzanine-1x0p5.kicad_pcb` prints PASS.",
      audit:"The via, setup and silk tasks can go ahead now. Finger changes wait on Q1, and the die-pad holes wait on Q2."},
    {n:3, id:"P3", title:"Design: 0p5x1", status:"ready", risk:"med",
      goal:"Bring `mezzanine-0p5x1` within the limits.",
      acts:["D3-VIA","D3-FINGERS","D3-TRACES","D3-C102","D3-HOLES","D3-SETUP","D3-SILK","D3-PASS"],
      verify:"`python planning/nextpcb_redesign/check/check_board.py run-2/0p5x1-cob/mezzanine-0p5x1.kicad_pcb` prints PASS.",
      audit:"Finger changes wait on Q1. Re-check that `C102` still fits its GND and VDD_IO_3 routing after the move."},
    {n:4, id:"P4", title:"Design: 0p5x0p5", status:"ready", risk:"med",
      goal:"Bring `0p5x0p5-cob` within the limits. It has no die-pad holes.",
      acts:["D4-VIA","D4-FINGERS","D4-TRACES","D4-SETUP","D4-SILK","D4-PASS"],
      verify:"`python planning/nextpcb_redesign/check/check_board.py run-2/0p5x0p5-cob/0p5x0p5-cob.kicad_pcb` prints PASS.",
      audit:"Finger changes wait on Q1."},
    {n:5, id:"P5", title:"Panel: 1x1", status:"ready", risk:"low", depends:["P1","P2","P3","P4"],
      goal:"Rebuild the 1x1 panel from its passing design and export it. Panels start once all four designs pass.",
      acts:["P1-BUILD","P1-SETUP","P1-SILK","P1-PASS","P1-EXPORT"],
      verify:"`python planning/nextpcb_redesign/check/check_board.py run-2/1x1-cob/panelization/panel.kicad_pcb` prints PASS, including copper at 0.4 mm or more from every V-cut.",
      audit:"Don't refill zones on the panel. A refill runs GND copper to the V-cuts."},
    {n:6, id:"P6", title:"Panel: 1x0p5", status:"ready", risk:"low", depends:["P1","P2","P3","P4"],
      goal:"Rebuild the 1x0p5 panel from its passing design and export it.",
      acts:["P2-BUILD","P2-SETUP","P2-SILK","P2-PASS","P2-EXPORT"],
      verify:"`python planning/nextpcb_redesign/check/check_board.py run-2/1x0p5-cob/panelization/panel.kicad_pcb` prints PASS, including copper at 0.4 mm or more from every V-cut.",
      audit:"Don't refill zones on the panel."},
    {n:7, id:"P7", title:"Panel: 0p5x1", status:"ready", risk:"low", depends:["P1","P2","P3","P4"],
      goal:"Rebuild the 0p5x1 panel from its passing design and export it.",
      acts:["P3-BUILD","P3-SETUP","P3-SILK","P3-PASS","P3-EXPORT"],
      verify:"`python planning/nextpcb_redesign/check/check_board.py run-2/0p5x1-cob/panelization/panel.kicad_pcb` prints PASS, including copper at 0.4 mm or more from every V-cut.",
      audit:"Don't refill zones on the panel."},
    {n:8, id:"P8", title:"Panel: 0p5x0p5", status:"ready", risk:"low", depends:["P1","P2","P3","P4"],
      goal:"Rebuild the 0p5x0p5 panel from its passing design and export it.",
      acts:["P4-BUILD","P4-SETUP","P4-SILK","P4-PASS","P4-EXPORT"],
      verify:"`python planning/nextpcb_redesign/check/check_board.py run-2/0p5x0p5-cob/panelization/panel.kicad_pcb` prints PASS, including copper at 0.4 mm or more from every V-cut.",
      audit:"Don't refill zones on the panel."},
  ],

  plan: "Fix the four run 2 single COB designs to NextPCB's published limits, then rebuild the four panels from them. The main change on every design is a via drill of 0.25 mm in place of 0.30 mm, keeping the 0.45 mm pad, plus 0.04 mm mask expansion. The three half-size designs also have 0.10 mm bond finger gaps against a 0.15 mm limit, which waits on NextPCB's answer. A board passes when check_board.py prints PASS. Panels are rebuilt without refilling zones, because `Edge.Cuts` doesn't include the V-cuts.",
  planChanges: [
    {ch:1, t:"first version: 8 phases and 48 tasks, from a check of all four designs and panels"},
  ],
};
