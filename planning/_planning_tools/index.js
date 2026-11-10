/* Planning Docs Index — the registry. The ONLY content file for the index.
   Rendered by index.engine.js. Claude maintains this:
     - DERIVED (baked at gen time): touched (git date), branch, board {chapter,needs}.
     - STORED (judgment): status, group, pinned, archived, order.
   When the user hits "Copy registry for Claude", fold their {overrides,note} back in.
   See PROTOCOL.md → "The planning index". */

window.PLANS_BAKED = {
  title: "COB Planning Index",
  at: "2026-11-10",
  branch: "nextpcb-drc",
  groups: ["Run 2"],
};

window.PLANS = [
  { id:"nextpcb_redesign", title:"NextPCB Redesign", kind:"board", status:"active",
    group:"Run 2", pinned:true, archived:false, order:0, branch:"nextpcb-drc", touched:"2026-11-10",
    chapter:3, needs:0,
    link:"../nextpcb_redesign/board.html", doc:"../nextpcb_redesign/plan.html",
    blurb:"Get the four run 2 single COB designs through NextPCB Rev 0's DFM check. The 1x1 is down to two hole-to-trace errors; the fix is a 0.23 mm hole clearance on all four designs. Panels parked." },
];
