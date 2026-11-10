#!/usr/bin/env node
/* Headless DOC validator — the same checks as the in-browser red banner, run
   from the command line so a board can be verified BEFORE anyone opens it.

     node planning/_planning_tools/validate.cjs planning/<discussion>/board.js

   Exit 0 = consistent · 1 = issues found · 2 = usage / load error.
   Loads the board's window.DOC by evaluating board.js with a window shim. */
const fs = require("fs");
const path = require("path");
const { validateDoc } = require("./board.validate.js");

const target = process.argv[2];
if (!target) {
  console.error("usage: node validate.cjs <path/to/board.js>");
  process.exit(2);
}

let src;
try {
  src = fs.readFileSync(target, "utf8");
} catch (e) {
  console.error("cannot read " + target + ": " + e.message);
  process.exit(2);
}

globalThis.window = globalThis; // board.js does `window.DOC = {…}`
try {
  (0, eval)(src); // indirect eval → runs in global scope, populating globalThis.DOC
} catch (e) {
  console.error("board.js failed to evaluate: " + e.message);
  process.exit(2);
}

const DOC = globalThis.DOC;
if (!DOC) {
  console.error("no window.DOC defined in " + target);
  process.exit(2);
}

const issues = validateDoc(DOC);

// The plan document lives on disk, so only the headless run can check it exists.
// A doc older than the board is legal (the plan may not have moved) — just noted.
const notes = [];
const pd = typeof DOC.planDoc === "string" ? { href: DOC.planDoc } : DOC.planDoc;
if (pd && typeof pd.href === "string" && pd.href) {
  const docPath = path.resolve(path.dirname(target), pd.href.replace(/[?#].*$/, ""));
  if (!fs.existsSync(docPath)) issues.push("planDoc file not found: " + pd.href);
  if (Number.isInteger(pd.ch) && pd.ch < DOC.chapter)
    notes.push("note: plan doc is at ch" + pd.ch + ", board at ch" + DOC.chapter +
      " — if this chapter moved the plan, update " + pd.href + " and planDoc.ch");
}

const name = path.basename(path.dirname(target)) + "/" + path.basename(target);
if (!issues.length) {
  console.log("OK   " + name + " — consistent (" +
    (DOC.cards || []).length + " cards, " +
    (DOC.questions || []).length + " questions, ch" + DOC.chapter +
    (pd ? ", plan doc" + (Number.isInteger(pd.ch) ? " ch" + pd.ch : "") : "") + ")");
  notes.forEach((n) => console.log("     " + n));
  process.exit(0);
}
console.error("FAIL " + name + " — " + issues.length + " issue(s):");
issues.forEach((i) => console.error("  - " + i));
notes.forEach((n) => console.error("     " + n));
process.exit(1);
