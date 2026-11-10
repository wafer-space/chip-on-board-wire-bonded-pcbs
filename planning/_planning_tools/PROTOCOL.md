# Discussion-Board Protocol

The reusable planning surface for evolving, multi-round design discussions. One
**card per topic**; each card is a chat stream stamped by a **chapter** (one
conversation round). Three derived views — **📋 Current Plan**, **🛠
Implementation**, **💬 Discussion** — are all projections of one `window.DOC`.
Alongside the board sits a **📐 plan document** (`plan.html`): the readable,
illustrated version of the current plan. When a board has one, it **is** the
Current Plan view.

This file is the contract for **Claude** (how to author and fold a chapter) and
the schema reference. For the human quickstart see [README.md](README.md).

---

## Why this exists

A long markdown plan mixes original assumptions with later revisions ("muddies
the water") and hides *when/where/by whom* something changed. The board pins
first assumptions in **ch1**, makes every later turn attributable and stamped,
and **derives** dynamic views (open-questions roll-up, current plan, phased
implementation) instead of hand-maintaining static sections.

---

## File layout

```
planning/
  _planning_tools/
    board.engine.css      # shared engine — styling      (never board-specific)
    board.engine.js       # shared engine — all logic     (never board-specific)
    board.validate.js     # shared DOC validator (browser banner + Node)
    validate.cjs          # headless validator runner (Node)
    board.template.html   # copy-me shell for a new board
    plan.doc.css          # shared plan-document styles (palette, pills, SVG vocabulary)
    plan.doc.js           # plan-document glue: embedding, link routing, mermaid
    plan.template.html    # copy-me skeleton for a new plan document
    PROTOCOL.md           # this file
    README.md             # human quickstart
  <discussion>/
    board.html            # thin shell → loads engine + ./board.validate.js + ./board.js
    board.js              # window.DOC = {…}   ← the board's data
    plan.html             # the 📐 plan document (standard; see "The plan document")
    plan.md               # optional longform ch1 source (older boards)
```

**Engine vs data is the core split.** The engine is written once and never
touched per board. Each chapter, Claude edits **only `board.js`** — ideally
surgically (touch just the cards/actions that moved), never the engine.

`board.js` uses a `.js` file (`window.DOC = {…}`) deliberately, not JSON:
- **Template literals** (backticks) for multi-line card prose / mermaid — no
  `\n` escaping, far fewer authoring typos.
- Loads via `<script src>` so it works on `file://` **and** Live Server.
- Lets Claude make targeted `Edit`s instead of rewriting a whole file.

---

## The `window.DOC` schema

```js
window.DOC = {
  // ---- identity (drives <title>, <h1>, localStorage key, export tag) ----
  boardId: "flotilla_manifest",   // stable slug; namespaces localStorage + tags the export
  title:   "Flotilla Manifest",   // shown in <title> and <h1>
  about:   "markdown-lite intro shown in the ⓘ about panel",   // optional
  chapterLegend: [                // optional; one line per chapter in the about panel
    {ch:1, t:"initial plan"},
    {ch:2, t:"your answers + the X model"},
  ],

  chapter: 7,                     // the CURRENT (latest) chapter number

  // ---- the 📐 plan document (optional in the schema, standard in practice) ----
  planDoc: {href:"plan.html", ch:7}, // ch = chapter the doc was last brought up to date
  //   shorthand: planDoc:"plan.html" (no chapter stamp → no staleness chip)

  // ---- one card per topic ----
  cards: [{
    id:    "IDENTITY",            // stable UPPER_SNAKE slug (used in the export, never changes)
    title: "Short topic title",
    status:"resolved",            // resolved | open | riffing | later | info  (see Statuses)
    state: "distilled CURRENT position (markdown-lite) — Plan view (boards without a planDoc)",
    changes:[{ch:6, t:"what moved this chapter"}, …],   // Δ log, one entry per chapter it moved
    stream:[                      // the chat, oldest first
      {ch:1, by:"claude", t:"message text (markdown-lite, ~~~mermaid fences ok)"},
      {ch:2, by:"user",   t:"the user's words, folded in verbatim-ish"},
    ],
  }],

  // ---- the synthesized whole-design state (Current Plan view when there's no planDoc) ----
  plan: "distilled plan as of chN (markdown-lite)",
  planChanges:[{ch:7, t:"discussion-level what-moved-this-chapter"}, …],

  // ---- Actions: concrete build steps (referenced by phases; unphased ones show in
  //      the Plan view, or in Implementation when the Plan view is the planDoc) ----
  actions: [{
    id:"ACT-FLOE", ch:6, status:"ready",   // ready | blocked | proposed
    what:"what this action does (markdown-lite)",
    files:["../../app/path/file.py#L7", …], // relative to board.html → clickable codelinks
    waiting:["Q5"],                          // question ids this is blocked on (drives chips)
  }],

  // ---- Implementation view: ordered, auditable phases ----
  phases: [{
    n:1, id:"P1", title:"Phase title", status:"ready",  // ready | built (=done) | deferred
    //   left-bar colour by status: ready→green ("to do"), built/done→purple
    //   ("merged/complete"), deferred→teal. Built phases collapse by default in the
    //   Implementation view (click a phase header, or Expand/Collapse all, to toggle).
    risk:"low–med",
    goal:"what this phase achieves",
    acts:["ACT-FLOE","ACT-VER"],   // REFERENCES actions[] by id (single source of truth)
    depends:["P1"],                // phase ids it depends on
    verify:"the ✅ gate — how we prove the phase works",
    audit:"the 🔍 thing to sanity-check before building",
  }],

  // ---- Questions: first-class, derived into the roll-up ----
  questions: [{
    id:"Q1", card:"IDENTITY", ch:2,   // ch = chapter it was ASKED
    status:"answered",                // answered | open | later
    ach:6,                            // chapter it was ANSWERED (answered only)
    q:"the question text",
    answer:"the resolution (answered only)",
  }],
};
```

Field shapes the engine relies on:
- `by` is exactly `"claude"` or `"user"`.
- `status` strings must be from the vocab below (anything else renders as grey/info-ish and trips no styling).
- `files[]` paths are resolved **relative to `board.html`** (i.e. `planning/<disc>/`), so app files are typically `../../app/...`. A `#L12` or `#L12-L20` anchor highlights lines in the inline viewer.
- Every non-`proposed` action should appear in exactly one phase (the validator flags strays).

---

## Statuses (vocabulary)

| status    | meaning                                                            | "NEEDS YOU"? |
|-----------|-------------------------------------------------------------------|--------------|
| `resolved`| every question under the card is **answered**                     | no           |
| `open`    | needs deciding **before** we begin                                | yes          |
| `riffing` | actively being worked through; needs your input now               | yes          |
| `later`   | unresolved but **not a precondition** — resolves *by doing*       | no           |
| `info`    | framing/context, no decision pending                              | no           |

**Hard invariant:** a card may be `resolved` **only if every one of its
questions is `answered`.** "Resolved means every question under it is closed —
that's what planning is." The engine enforces this at load (`normalizeStatuses`
downgrades a `resolved` card that still has an `open`→`open` / `later`→`later`
question) *and* the validator reports it — but **author it correctly**: don't
conflate "the mechanics are decided" with "the card is resolved."

`later` is deliberately excluded from the NEEDS set and from the blocking
open-questions count; it renders in its own subdued **⏳ Settle later** group.

Each card surfaces its own open/later question(s) **inline** (a `.cardq` block
under the thread) so an open card always shows *why* it's open — not only in the
roll-up. Resolved/info cards show none.

---

## Starting a plan (what "make a plan" produces)

When the user asks for a plan / planning document / board on a topic, the
standard deliverable is **all four** of:

1. `planning/<disc>/board.html` — copied from `board.template.html`, unedited.
2. `planning/<disc>/board.js` — `window.DOC` at ch1, with `planDoc:{href:"plan.html", ch:1}`.
3. `planning/<disc>/plan.html` — the **plan document**, from `plan.template.html`
   (next section). This is not optional: the user wants the rich, illustrated page
   every time, not only when asked.
4. A row in `_planning_tools/index.js` with `doc:"../<disc>/plan.html"`.

Then run the validator (it also checks the plan doc file exists).

---

## The plan document (`plan.html`)

The board is the *conversation*; the plan document is the *current design*,
written to be read top to bottom. It is a standalone HTML page in the discussion
folder, and **the 📋 Current Plan tab is that page**: the engine shows the doc
alone, flush in the board's column, so the tab reads exactly like `plan.html`
opened on its own. Above it is only a one-line bar (*plan as of chN* · "Open
full page ↗"). The markdown `plan`, the moved-this-chapter chips and the
per-topic state cards are not shown; actions no phase has claimed yet move to
the 🛠 Implementation view. Keep `plan` and each card's `state` current anyway:
they are the short form Claude and the index read. Boards without `planDoc`
keep the old Current Plan view.

**Wiring:** `planDoc:{href:"plan.html", ch:N}` in `board.js`. If `ch` is behind
`DOC.chapter`, the bar shows a *"board is at chM — may lag"* chip, and
`validate.cjs` prints a (non-failing) note.

**Build it from `plan.template.html`.** It links `../_planning_tools/plan.doc.css`
(shared look, same palette as the board) and ends with
`<script src="../_planning_tools/plan.doc.js">`, which handles embedding:
auto-height (no inner scrollbar), `#section` links scrolling the board page,
`board.html#…` links driving the board, mermaid rendering. It works on
`file://` and on Live Server. Plan-specific styles go in a `<style>` block after
the stylesheet link.

**What a plan document contains** (the template has each piece):

| piece | notes |
|---|---|
| crumbs | ← board · 🗂 index · *As of chapter N · date* (hidden when embedded) |
| title + lede | one or two sentences: what it builds and what changes for the user |
| pill legend | **Decided** (agreed on the board) · **Lean** (Claude's recommendation) · **Open** (needs an answer) · **Later** · **Today** (how it works now) |
| TL;DR | the whole plan in one line |
| scope at a glance | a `.glance` row of tiles right under the TL;DR: what the user/author does, what existing code changes (with counts), which files, where it stands. Readable without opening anything. |
| contents | numbered `nav.toc` under a `.foldbar` (Expand all / Collapse all); every section has a stable `id` |
| sections | numbered, each tagged with a pill when it's a decision; show *today vs planned*. **Every section folds:** `<details class="sec" id="…">` whose `<summary>` holds the `h2` and a one-line `.gist` (what the section concludes), so the closed page reads as a summary. Open by default only what a first-time reader needs. Options compared, evidence and history go in `<details class="more">` inside a section; a set of worked cases can use `<details class="ex">` cards. `plan.doc.js` opens whatever a link points into. |
| diagrams | at least one per major idea. Inline SVG using the `.s-*` classes (boxes, lines, `#arr`/`#arrA`/`#arrG` arrowheads), or `<pre class="mermaid">` for flowcharts. Every SVG has a `<title>`, every figure a `.cap` caption. Use real names and numbers from the code. |
| tables | options compared (`tr.chosen` for the pick), field layouts, before/after |
| code links | `../../app/…#L12` relative links, same as `files[]` |
| How it's built | mirrors `phases[]` once they exist; before that, the likely steps |
| Still to decide | every `open`/`later` question, linked `board.html#q-<id>`, with its pill, Claude's lean and an **answer box**: `<textarea class="qa-input" data-q="Q1">`. `plan.doc.js` wires these up; they need `<meta name="plan-board" content="<boardId>">` and `<meta name="plan-chapter" content="N">` in the head. |

**Linking between the two:** in card text, `[section 3](plan.html#file)` renders
as a **doclink** (dashed underline) that opens the Current Plan tab at that section
instead of leaving the board. (`plan.html?doc`, used before this existed, still
works.) In the doc, `board.html#q-Q5` / `board.html#CARD` drive the board.

**Write it for the user**, not for Claude: plain words, the decision before
the reasoning, diagrams over prose where the idea is spatial. It restates the
current design; it doesn't replay the discussion (that's the board's job).

---

## The chapter-folding protocol (Claude)

A **chapter = one round.** The user replies on cards, then hits **📋 Copy JSON
for Claude** and pastes the delta. To fold it into the next chapter:

1. **Ingest the delta JSON** (shape below). It is *delta-only* — just the user's
   new words, keyed by card id. You already hold the whole board (you wrote it),
   so nothing is echoed back.
2. **Bump `DOC.chapter`** by 1.
3. For each `cards[].replies`: append a `{ch:NEW, by:"user", t:…}` bubble to that
   card's `stream`, then add your **`{ch:NEW, by:"claude", t:…}`** reply right
   after it.
4. **Flip questions** the round answered, including everything in `answers`: fold each
   answer into its card's stream as a `by:"user"` bubble, then set `status:"answered"`,
   add `ach:NEW` and an `answer:`. An answer that raises a follow-up can stay `open`. Never delete a question — answered ones are kept forever
   (hidden behind a toggle in the roll-up).
5. **Stamp movement:** add a `{ch:NEW, t:…}` entry to each moved card's
   `changes[]`, and to `planChanges[]` at the discussion level. Unchanged topics
   get nothing (they render "no change in chN").
6. **Re-derive the views:** update each moved card's `state`; update `plan`;
   update `actions[]` (flip `blocked`→`ready` when its `waiting[]` clears, bump
   its `ch`); once the design locks, lay out / adjust `phases[]`.
   **Update the plan document** if the round moved the plan: flip pills
   (Open → Decided, etc.), revise the affected sections and diagrams, refresh
   *Still to decide* and *How it's built*, bump the crumbs' *As of chapter*,
   and set `planDoc.ch` to the new chapter. If nothing in the plan moved, leave
   both alone. A board made before plan docs existed gets one the next time
   it's folded (add `planDoc` at the same time).
7. **Update `chapterLegend`** with a one-line summary of the new chapter.
8. **Re-validate** (the banner at the top of the board must be empty) and keep
   the resolved-invariant true.

Mark only a card `resolved` if ALL its questions are `answered`. The Plan view
may say the architecture is locked while individual cards stay unresolved pending
refinement questions.

Author `phases[]` only once the design is locked. Keep them in sync with
`actions[]`: each non-deferred action lands in exactly one phase; the verify+audit
pair is what makes a phase *auditable* rather than just a task list.

---

## The delta export (board → Claude)

`buildExport()` emits the user's NEW input only — compact JSON, copied to the
clipboard (no download):

```json
{
  "tool": "<boardId>_board",
  "seen": 7,            // the chapter the user was looking at
  "next": 8,            // the chapter their feedback is for
  "note": "overall notes (omitted if empty)",
  "answers": {"Q1": "their answer"},   // text from the answer boxes, keyed by question id (omitted if empty)
  "addressed": ["Q5"],  // questions the user ticked as addressed (omitted if empty)
  "cards": [            // omitted if empty
    { "id": "IDENTITY", "replies": ["their reply", "another reply"] }
  ]
}
```

Empty fields are omitted entirely; titles, statuses, and question text are never
echoed back. This is the fewest-token, easiest-to-parse form. Typed-but-not-
"Add"-ed reply text is flushed into the export so it's never silently dropped.

---

## Answer boxes

Every open or later question has a text box, shown in three places: on its card, in the
Discussion roll-up, and in the plan document's *Still to decide*. They are one value: typing
in any of them updates the others. The text is stored in the board's localStorage record
(`state.answers`), and goes out in the `answers` field of the export.

- **Embedded** in the board, the plan document forwards each keystroke by `postMessage`
  (`type:"answer"`) and receives the current values (`type:"answers"`); the board owns them.
- **Standalone**, `plan.doc.js` reads and writes the same localStorage record, and offers its
  own copy button, so the page can be used without opening the board.
- `data-q="__note"` in the doc maps to the board's *Overall notes*.
- A new chapter clears the round's answers, like drafts, so answered text doesn't linger.

This copy of the tools differs from `evezor_ide/planning/_planning_tools`: it adds answer boxes
and uses the Evezor palette.

---

## The validator

The checks live in **`board.validate.js`** (`validateDoc(DOC) -> string[]`), shared
by two callers so they can never drift:
- **In the browser** the engine runs it at boot and shows a red banner above the
  views if `DOC` is inconsistent (otherwise invisible).
- **Headless**, before anyone opens the board:
  ```
  node planning/_planning_tools/validate.cjs planning/<discussion>/board.js
  ```
  Exit 0 = clean · 1 = issues · 2 = load error. **Claude should run this after
  authoring each chapter** — never hand back a board that fails it.

It catches the reference mistakes that are easy to make when hand-authoring
`board.js`:

- duplicate `card` / `question` / `action` / `phase` ids
- a `question.card` pointing at a missing card
- an `action.waiting[]` referencing a missing question, or one already `answered` (stale)
- a `phase.acts[]` / `phase.depends[]` referencing a missing action / phase
- a non-`proposed` action that lives in **no** phase
- a `resolved` card that still has an `open`/`later` question
- an `open`/`riffing` card with **no** `open`/`later` question (it'd show "NEEDS
  YOU" with no visible reason — the "I don't see a question" trap)
- a `planDoc` without an `href`, or a `planDoc.ch` outside 1..`chapter`; headless
  only: a `planDoc` file that doesn't exist (plus a non-failing note when the
  doc's `ch` is behind the board)

A clean board shows no banner / prints `OK`. **Treat any failure as a bug in
`board.js` to fix before handing the board back.**

## Deep-linking

The board honors a URL hash on load and on `hashchange`, so you can link straight
to a spot:
- `board.html#IDENTITY` → that card, opened, in the **Discussion** view
- `board.html#state-IDENTITY` → that card's state card in the **Plan** view
  (with a plan document there are no state cards, so it opens the card in Discussion)
- `board.html#q-Q5` → that question in the roll-up (revealing answered ones if needed)
- `board.html#doc` → the plan document (the Current Plan tab); `board.html#doc-<id>`
  → that section of it (the `id` of a section, `h2` or `h3` in `plan.html`)

Clicking a jump in the UI also updates the hash (via `replaceState`), so the
current spot is always shareable/bookmarkable.

---

## Authoring tips

- **Mermaid:** author as `~~~mermaid … ~~~` fences (the engine's `fmt()` uses
  `~~~`, not triple-backtick). Diagrams lazy-load mermaid from a CDN on first
  view and **degrade to a readable source block when offline** — the one CDN
  exception in an otherwise dependency-free board. Only visible diagrams render
  (collapsed cards wait until expanded).
- **Markdown-lite** in any `t`/`state`/`plan`/`goal`/`q`/`answer`: `**bold**`,
  `- bullets`, `` `inline code` ``, `[text](link)`, `~~~` code fences, and
  **GFM tables** (a header row + a `|---|:--:|--:|` delimiter row → a styled
  `.mdtable`; `:` controls column alignment). A link whose target is a repo
  file (`.py .js .html .json .md …`, optional `#Lnn`) becomes an inline
  **codelink** that opens the syntax-highlighted viewer. (Inline code spans are
  pulled out before bold/link processing, so `**`/`[]` inside `` `code` `` stay
  literal.)
- **localStorage** is namespaced `floe_board_<boardId>_v1`. In-progress compose
  text survives an accidental refresh; on a chapter advance the prior round's
  drafts are cleared (already folded into the stream).
- Keep `boardId` stable forever — it keys the user's saved drafts and tags the
  export.

---

## The planning index

`_planning_tools/index.html` is a sibling tool (its own lightweight engine,
`index.engine.js` + `index.engine.css`, reusing `board.engine.css` tokens) that
renders **one registry across all discussions** — the interactive replacement for
the old hand-maintained `planning/README.md` table.

**Registry = `_planning_tools/index.js`** sets `window.PLANS = [...]` (+ a small
`window.PLANS_BAKED` meta). It is the only content file; Claude maintains it.

```js
window.PLANS_BAKED = { title, at:"YYYY-MM-DD", branch:"<current>", groups:[…ordered] };
window.PLANS = [{
  id:"flotilla_manifest",      // folder slug
  title, blurb,
  status:"active",             // active | partial | planning | discussion | later | done
  kind:"board",                // board | plan | keystone   (see ## Keystones)
  link:"../flotilla_manifest/board.html",   // relative to index.html
  doc:"../flotilla_manifest/plan.html",     // optional: the plan document → 📐 chip, and in the 📎 context
  // keystone wiring (only on rows involved in a keystone — see ## Keystones):
  stones:["flotilla_manifest","floe_implementation"], // keystone-event rows: the sources it bears
  keystonedInto:"<event id>",  // a stone that has borne into a keystone (renders a → chip; archivable)
  keystoneEvent:"<event id>",  // a child board: the keystone event it continues from (renders a ↳ chip)
  group:"Flotilla",            // explicit group (Q-TAGS: explicit beats id-prefix)
  // stored judgment calls (the user sets these in the browser; status too via ✓):
  pinned:false, later:false, archived:false, order:0,
  comment:"a note to self — e.g. 'done, shipped on <branch>' / 'blocked on X'",
  //   later:true → "parked": still visible, but moved out of Active into the
  //   subdued ⏳ Later zone. Also defaults from a baked status:"later".
  //   ✓ marks a row complete (status→"done"); 💬 edits `comment`; 📎 copies a
  //   context blurb for pasting into chat. All ride the same override/export path.
  // DERIVED — baked by Claude at gen time:
  touched:"2026-06-14",        // git log -1 --format=%cs -- planning/<id>
  branch:"flotilla-manifest",  // owning branch, "" if merged
  chapter:7, needs:0,          // boards only — needs = open+riffing question count
  needsAnchor:"CARD_ID",       // boards only, optional — first needs card, for deep-link
}];
```

**Derive what rots, store judgment calls.** When you touch the index (or fold any
board), re-bake the derived fields:
- `touched` ← `git log -1 --format=%cs -- planning/<id>` for each row.
- `branch` ← the owning branch (or `""` if merged).
- For each **board** row, `chapter` + `needs` (count of `open`+`riffing` questions
  in that board's `DOC`; `later` does NOT count) + optional `needsAnchor` (first
  such card id, so the index can deep-link to it).
- Bump `PLANS_BAKED.at` + `branch`. Every derived field shows "as of `at`" in the
  UI so a stale bake reads as stale, not as current.

**Stored** fields (`status`, `group`, `pinned`, `later`, `archived`, `order`,
`comment`) are the user's to set in the browser; they round-trip back to you.

**The edit loop** (same shape as a board): the user drags ⋮⋮ to reorder, ⭐ pins to
Focus, ⏳ parks for Later (still visible, just out of the way), ✓ marks complete
(`status→"done"`), 💬 adds a note (`comment`), 📦 soft-archives (a flag — **no `git
mv`**, nothing moves on disk), then hits **Copy registry for Claude**, which copies
**only the fields that differ from the baked registry** (so an override you've
already folded in stops re-sending):

```json
{ "tool":"planning_index",
  "overrides": {
    "grbl-optimization": {"archived":true},
    "package_manager":   {"status":"done", "comment":"shipped"},
    "zorg_c2":           {"pinned":true, "order":0}
  },
  "note": "free-text" }
```

Fold it by writing those `overrides` into the matching `window.PLANS` rows (and act
on the note). Because the export is delta-vs-baked, once folded they vanish from the
next export automatically — no need to ask the user to reset. localStorage is
namespaced `floe_index_v1`.

Every board header carries a **🗂 Index** back-link to `../_planning_tools/index.html`
(the path is invariant because boards always live at `planning/<disc>/board.html`).
It's in `board.template.html`, so new boards get it for free.

**The 📎 copy-context button** is the other half: it copies a one-line descriptor of
that plan (title · repo dir · status · branch · last-touched · board chapter/needs ·
doc path · blurb · the user's note) so the user can paste it into chat — *"I'd like
to work on [paste], fill me in on where we left off."* It's the user→Claude pointer
to the right files; it does not change state.

**Four zones** (routing priority archived → pinned → later → active): ⭐ Focus
(pinned) · 🟢 Active (grouped by `group`, drag-reorderable, boards with `needs>0`
auto-float up) · ⏳ Later (parked — visible but subdued, out of the Active flow) ·
📦 Archive (collapsed, still searchable). A top **needs-you rollup** sums `needs`
across non-archived boards and links to each.

---

## Keystones

A **keystone** is its own kind of plan: the board you get when several **converged**
discussions are *merged* into one that names the overarching goal — the "arch" — that
wasn't visible when the separate threads started. Where a **fold** is *temporal* (one
board, one more chapter), a keystone is *structural* (many boards → one, at a convergence
point). The full design discussion lives in
[../keystone/board.html](../keystone/board.html); **this section is the operating
runbook** — the terms and what to do when the user asks to keystone some plans.

### Vocabulary

| term | meaning |
|------|---------|
| **stone** | a source discussion that converges into the arch |
| **span** | the set of stones being merged |
| **arch** | the emergent overarching goal the keystone names |
| **bear into** | a stone is *subsumed* (not deleted) into the keystone — reversible, non-destructive |
| **set the keystone** | author the apex goal that locks the arch — **the human's call, never Claude's** |
| **keystone-event board** | the *back side*: where the stones bear in and their leftover **Later/Deferred residue is reconciled** into a plan-to-execute |
| **child board** | the *front side*: the new-direction board you build on, which references the event + the original stones |

A keystone is realized as **two boards** (one document would overload `window.DOC`): a
**keystone-event** board (reconcile) and a **child** board (continue). See the TWO_SIDES
card on the keystone board.

### How to begin one (the trigger)

The trigger is **manual**: the user says, in chat, *"let's keystone these plans"* (or
Claude **surfaces a candidate** — below — and the user says go). Then:

1. **Name the span** — confirm exactly which stones converge, by registry id.
2. **The human sets the keystone** — the user names the arch (the goal that locks the
   stones). Claude does **NOT** name or design it (*"you are not a good architect"* — the
   keystone board's TRIGGER card). If Claude only has a candidate, present the convergence
   signals and let the user name it.
3. **Author the keystone-event board** (back side) — a new `planning/<arch>/` board
   (`board.html` + `board.js`), born as a **reconciliation board**: its cards/questions
   *are* the leftover **Later/Deferred** items pulled from each stone, restated as "how do
   these reconcile under the new goal?" Tag every imported item with its origin stone.
4. **Wire the metadata** in the index registry (reversible — nothing is deleted):
   - keystone-event row → `kind:"keystone"`, `stones:[<stone ids>]`.
   - each stone's row → `keystonedInto:"<event id>"` (and it becomes archivable: work moves
     *up*, the stone freezes as drill-down-able history).
5. **The child board comes later** — once reconciliation is far enough along, author the
   child board (the new direction) with `keystoneEvent:"<event id>"` + the inherited
   `stones`, so any context is one hop away.

So the user's model is right: *"keystone these"* → Claude creates a keystone plan that, at
birth, **is a series of reconciliation tasks and questions** drawn from the stones'
residue, under a goal the **user** names.

### How it renders in the index

A `kind:"keystone"` row renders **distinctly** — a 🔑 keystone badge, a purple
load-bearing accent, and an inline **bears ‹stone · stone · stone›** list linking to its
sources. Each stone row shows a **→ keystoned into X** chip; the child board shows a
**↳ from X** chip. (Borne-in stones are usually archived — still searchable and
drill-down-able through the chip.)

### Surfacing candidates (Claude's standing job)

Claude **watches for convergence** and may **flag a candidate arch** — but only surfaces
the *signal*, never architects. Candidate signals (all confirmed): shared `group` ·
cross-board references · converging open-questions · shared entities. Flag it as *"these N
boards share X/Y/Z — possible keystone?"* and stop there; the naming is the user's.
