# _planning_tools — the discussion board

A reusable surface for evolving, multi-round **design discussions**. Instead of a
growing markdown plan (which muddies first assumptions with later edits), you get
**one card per topic**, each a chat stream stamped by a **chapter** (one round),
plus three derived views: **📋 Current Plan**, **🛠 Implementation**, **💬
Discussion**.

First proven on [`../flotilla_manifest/board.html`](../flotilla_manifest/board.html).

> Copied from `evezor_ide/planning/_planning_tools`, then extended with answer boxes on every
> open question and re-themed in the Evezor palette. See PROTOCOL.md → "Answer boxes".

## What's here

| file | role |
|------|------|
| `board.engine.css` / `board.engine.js` | the shared board engine — generic, never board-specific |
| `board.validate.js` | shared DOC consistency checks (in-browser banner + Node) |
| `validate.cjs` | headless validator: `node validate.cjs <board.js>` |
| `board.template.html` | copy-me shell for a new board |
| `plan.template.html` | copy-me skeleton for a board's 📐 plan document (`plan.html`) |
| `plan.doc.css` / `plan.doc.js` | shared look + embedding glue for plan documents |
| `index.html` + `index.engine.{js,css}` | the **Planning Docs Index** dashboard over all discussions |
| `index.js` | the index registry (`window.PLANS`) — Claude-maintained |
| `PROTOCOL.md` | the schema + how Claude folds each chapter (the contract) |
| `README.md` | this file |

The engine renders whatever is in **`window.DOC`**; each discussion supplies its
own `board.js` defining it. Engine = logic, `board.js` = content. Bug-fix the
engine once and every board benefits.

## Start a new board

1. **Copy the template** into a discussion folder:
   `planning/<your-discussion>/board.html`  ← from `board.template.html`
2. **Create** `planning/<your-discussion>/board.js` setting `window.DOC = {…}`
   (Claude usually authors this from the kickoff conversation — see the schema in
   [PROTOCOL.md](PROTOCOL.md)). The smallest valid board:
   ```js
   window.DOC = {
     boardId: "your_discussion",
     title:   "Your Discussion",
     chapter: 1,
     cards: [
       { id:"OVERVIEW", title:"Framing", status:"info",
         state:"one-line current position",
         changes:[{ch:1, t:"seeded"}],
         stream:[{ch:1, by:"claude", t:"opening framing…"}] },
     ],
     questions: [], actions: [], phases: [], planChanges: [],
     plan: "the distilled plan as of ch1",
     planDoc: {href:"plan.html", ch:1},
   };
   ```
3. **Write the plan document** `planning/<your-discussion>/plan.html` from
   `plan.template.html`: the readable, illustrated version of the plan
   (diagrams, tables, decided/open pills). With a plan doc, the 📋 Current
   Plan tab **is** that page, looking the same as opening `plan.html` on its
   own; actions not yet in a phase show under 🛠 Implementation. Claude writes
   one for every new plan and keeps it current as chapters fold (PROTOCOL.md →
   "The plan document"). Boards without `planDoc` keep the old Current Plan view.
4. **Serve the repo root** with Live Server (or any static server rooted at the
   repo) and open `planning/<your-discussion>/board.html`. Rooting at the repo
   lets the inline code viewer fetch `../../app/...` files.

> The `../_planning_tools/...` engine paths resolve correctly from any
> `planning/<disc>/` sibling folder, so no edits to the copied `board.html` are
> needed.

## The loop

1. You read the board, reply on cards, optionally tick addressed questions and
   leave overall notes.
2. Hit **📋 Copy JSON for Claude** — it copies a compact, delta-only payload
   (just your new words) to the clipboard.
3. Paste it to Claude. Claude folds it into the **next chapter** — your words as
   `user` bubbles, its replies alongside, answered questions flipped (kept, not
   deleted), the Plan/Implementation views re-derived — and rewrites `board.js`.
4. Refresh the board.

Your drafts autosave to this browser (namespaced per `boardId`) and survive an
accidental refresh.

## Notes

- **Offline-friendly:** no build step, no dependencies except mermaid, which
  lazy-loads from a CDN and degrades to a readable source block when offline.
- **The red banner** at the top means `board.js` has a consistency bug (orphan
  id, stale wait, etc.) — see the validator section of [PROTOCOL.md](PROTOCOL.md).
  Catch it before opening the board with
  `node planning/_planning_tools/validate.cjs planning/<disc>/board.js`.
- **Deep-link** to a spot: `board.html#IDENTITY` (a card), `#state-IDENTITY` (its
  Plan card), `#q-Q5` (a question). The URL also updates as you navigate, so the
  current spot is shareable. `#doc` opens the plan document, `#doc-<section>`
  a section of it.
- Opening `board.template.html` directly (with no `board.js` beside it) shows a
  friendly "no board data" message — that's expected; it's a template.

## The Planning Docs Index

[`index.html`](index.html) is a dashboard over **every** discussion in `planning/`
— the interactive replacement for the old hand-maintained `planning/README.md`
table. Open it with Live Server (rooted at the repo).

- **Four zones:** ⭐ Focus (pinned) · 🟢 Active (grouped by theme, drag ⋮⋮ to
  reorder, boards that need you float up) · ⏳ Later (parked — still visible, just
  out of the way) · 📦 Archive (collapsed, still searchable).
- **Per-row buttons:** ⭐ pin · ⏳ park for Later · ✓ mark complete (done) · 💬 add
  a note to self · 📦 soft-archive · 📎 **copy context for Claude** (paste it into
  chat to say "let's work on this — fill me in"). ⏳/✓/📦 just set flags; nothing
  moves on disk.
- **Needs-you rollup** at the top sums the open/riffing questions across all boards.
- Your pins/parked/done/order/archive/notes save to this browser; hit **📋 Copy
  registry for Claude** to make them stick (it sends only what changed; Claude folds
  it into `index.js`).

The registry is [`index.js`](index.js) (`window.PLANS`). Claude bakes the derived
fields (git last-touched, each board's chapter + needs count) and you own the
judgment fields. Full contract in [PROTOCOL.md](PROTOCOL.md) → "The planning index".
