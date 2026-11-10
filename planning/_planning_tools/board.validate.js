/* ============================================================================
   Shared DOC validator — used by BOTH board.engine.js (browser, renders the
   red banner) AND validate.cjs (Node, headless pre-flight). Keeping it in one
   place means the in-browser check and the command-line check never drift.

   Pure function: validateDoc(DOC) -> string[] of issue messages (empty = clean).

   Dual-mode loading: defines globalThis.validateDoc for the browser <script>
   path, and module.exports for `require()` under Node.
   ========================================================================== */
(function () {
  function validateDoc(DOC) {
    const issues = [];
    DOC = DOC || {};
    const setOf = (arr) => new Set((arr || []).map((x) => x.id));
    const cardIds = setOf(DOC.cards), qIds = setOf(DOC.questions),
          actIds = setOf(DOC.actions), phIds = setOf(DOC.phases);

    const dups = (arr, label) => {
      const seen = new Set();
      (arr || []).forEach((x) => {
        if (seen.has(x.id)) issues.push("Duplicate " + label + " id: " + x.id);
        seen.add(x.id);
      });
    };
    dups(DOC.cards, "card"); dups(DOC.questions, "question");
    dups(DOC.actions, "action"); dups(DOC.phases, "phase");

    (DOC.questions || []).forEach((q) => {
      if (q.card && !cardIds.has(q.card)) issues.push("Question " + q.id + " → missing card " + q.card);
    });

    (DOC.actions || []).forEach((a) => (a.waiting || []).forEach((w) => {
      if (!qIds.has(w)) { issues.push("Action " + a.id + " waiting on missing question " + w); return; }
      const q = (DOC.questions || []).find((x) => x.id === w);
      if (q && q.status === "answered") issues.push("Action " + a.id + " still waiting on answered question " + w + " (stale)");
    }));

    (DOC.phases || []).forEach((p) => {
      (p.acts || []).forEach((x) => { if (!actIds.has(x)) issues.push("Phase " + p.id + " → missing action " + x); });
      (p.depends || []).forEach((d) => { if (!phIds.has(d)) issues.push("Phase " + p.id + " depends on missing phase " + d); });
    });

    if ((DOC.phases || []).length) {
      const inPhase = new Set();
      DOC.phases.forEach((p) => (p.acts || []).forEach((x) => inPhase.add(x)));
      (DOC.actions || []).forEach((a) => {
        if (a.status !== "proposed" && !inPhase.has(a.id)) issues.push("Action " + a.id + " (" + a.status + ") is in no phase");
      });
    }

    (DOC.cards || []).forEach((c) => {
      const qs = (DOC.questions || []).filter((q) => q.card === c.id);
      // Invariant: resolved means every question under it is answered.
      if (c.status === "resolved" && qs.some((q) => q.status === "open" || q.status === "later"))
        issues.push("Card " + c.id + " is resolved but still has an unanswered question");
      // Corollary: a card that needs you must show WHY — at least one open/later question.
      if ((c.status === "open" || c.status === "riffing") && !qs.some((q) => q.status === "open" || q.status === "later"))
        issues.push("Card " + c.id + " is " + c.status + " but has no open/later question (no visible reason it needs you)");
    });

    // Optional plan document: {href, ch} or a bare "plan.html". (validate.cjs also checks the file exists.)
    if (DOC.planDoc !== undefined) {
      const pd = typeof DOC.planDoc === "string" ? { href: DOC.planDoc } : (DOC.planDoc || {});
      if (typeof pd.href !== "string" || !pd.href) issues.push('planDoc needs an href (e.g. "plan.html")');
      if (pd.ch !== undefined && !(Number.isInteger(pd.ch) && pd.ch >= 1 && pd.ch <= DOC.chapter))
        issues.push("planDoc.ch (" + pd.ch + ") must be a chapter between 1 and the board's chapter (" + DOC.chapter + ")");
    }

    return issues;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { validateDoc };
  if (typeof globalThis !== "undefined") globalThis.validateDoc = validateDoc;
})();
