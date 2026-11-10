/* Planning Docs Index — the registry. The ONLY content file for the index.
   Rendered by index.engine.js. Claude maintains this:
     - DERIVED (baked at gen time): touched (git date), branch, board {chapter,needs}.
     - STORED (judgment): status, group, pinned, archived, order.
   When the user hits "Copy registry for Claude", fold their {overrides,note} back in.
   See PROTOCOL.md → "The planning index". */

window.PLANS_BAKED = {
  title: "COB Planning Index",
  at: "2026-11-09",
  branch: "main",
  groups: ["Run 2"],
};

window.PLANS = [
  { id:"nextpcb_redesign", title:"NextPCB Redesign", kind:"board", status:"active",
    group:"Run 2", pinned:true, archived:false, order:0, branch:"main", touched:"2026-11-09",
    chapter:1, needs:3, needsAnchor:"FINGERS",
    link:"../nextpcb_redesign/board.html", doc:"../nextpcb_redesign/plan.html",
    blurb:"Bring the four run 2 single COB designs within NextPCB's published limits, then rebuild the four panels from them. 0 of 4 designs and 0 of 4 panels pass today." },
];
