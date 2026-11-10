"use strict";
/* =====================================================================
   Reusable discussion-board ENGINE. All board content lives in window.DOC
   (defined in the board's own board.js, loaded BEFORE this file). This
   engine never changes between boards — only board.js does.
   Schema + the chapter-folding protocol:  ./PROTOCOL.md
   ===================================================================== */
const DOC = window.DOC;
if(!DOC){
  document.body.innerHTML = '<p style="color:#ffb4a8;font-family:sans-serif;padding:30px;line-height:1.6">'+
    'No board data found. This page expects a <code>board.js</code> that sets '+
    '<code>window.DOC</code>, loaded <b>before</b> <code>board.engine.js</code>. '+
    'See <code>planning/_planning_tools/README.md</code>.</p>';
  throw new Error("window.DOC is missing — load board.js before board.engine.js");
}

/* ===================== State (localStorage) ===================== */
// Namespaced per board so two boards never collide; _v1 = engine storage schema.
const LS_KEY = "floe_board_" + (DOC.boardId || "board") + "_v1";
const NEXT = DOC.chapter + 1;
const CH = DOC.chapter;          // the current (latest) chapter — "moved this chapter" pivots on this
let state = {global:"", drafts:{}, collapsed:{}, implCollapsed:{}, addressed:{}, composing:{}, answers:{}, aboutOpen:false, view:"plan"};
let saveTimer = null;
let showAnswered = false;

function loadState(){
  try{ const raw = localStorage.getItem(LS_KEY);
    if(raw){ const s = JSON.parse(raw);
      state = Object.assign({global:"",drafts:{},collapsed:{},implCollapsed:{},addressed:{},composing:{},answers:{},aboutOpen:false,view:"plan"}, s);
      state.drafts = state.drafts||{};
      state.collapsed = state.collapsed||{}; state.addressed = state.addressed||{};
      state.composing = state.composing||{}; state.implCollapsed = state.implCollapsed||{}; state.answers = state.answers||{};
    }
  }catch(e){}
}
function saveState(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){}
    const d = new Date();
    document.getElementById("savedAt").innerHTML = "Saved <b>"+d.toLocaleTimeString()+"</b> · drafting chapter <b>"+NEXT+"</b>";
  }, 220);
}

/* ===================== Markdown-lite formatter ===================== */
// A relative link to a viewable repo file (optionally with a #Lnn line anchor).
const CODE_RE = /^(?!https?:|mailto:|#)[^?]*\.(py|js|html|json|txt|md|c|cpp|h|hpp|css|ya?ml|toml|cfg|ini)(#L\d+(-L\d+)?)?$/i;
// The board's plan document (optional DOC.planDoc: {href, ch, title, blurb} or just "plan.html").
const PLAN_DOC = (function(){
  const d = DOC.planDoc;
  const o = typeof d === "string" ? {href:d} : Object.assign({}, d);
  if(!o.href) return null;
  o.path = o.href.replace(/[?#].*$/, "");
  return o;
})();
// A link to the plan doc (any ?query / #section) → a doclink that opens it in the Plan view.
function isPlanDocUrl(url){ return !!PLAN_DOC && url.replace(/[?#].*$/, "") === PLAN_DOC.path; }
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function inline(s){
  // Pull inline `code` spans out first (placeholder), so ** / [] inside a code
  // span aren't reprocessed as bold/links; restore them as <code> at the end.
  const codes = [];
  s = String(s).replace(/`([^`]+)`/g, (m, c)=>{ codes.push(c); return "@@C"+(codes.length-1)+"@@"; });
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, url)=>{
    if(isPlanDocUrl(url)){
      const sec = url.indexOf("#") < 0 ? "" : url.slice(url.indexOf("#")+1);
      return '<a href="'+url+'" class="doclink" data-doc="'+sec+'">'+txt+'</a>';
    }
    return CODE_RE.test(url)
      ? '<a href="'+url+'" class="codelink">'+txt+'</a>'
      : '<a href="'+url+'" target="_blank" rel="noopener">'+txt+'</a>';
  });
  s = s.replace(/@@C(\d+)@@/g, (m, i)=> '<code>'+esc(codes[+i])+'</code>');
  return s;
}
// --- GFM tables (markdown-lite) --------------------------------------------
// A table is a header row containing `|`, immediately followed by a delimiter
// row (cells of only -, :, spaces). The detection is strict enough that an
// ordinary paragraph with a stray pipe won't trip it (it needs the |---| line).
function isTableDelim(line){
  const t = line.trim();
  if(t.indexOf("-") === -1) return false;
  const inner = t.replace(/^\|/, "").replace(/\|$/, "");
  const cells = inner.split("|");
  return cells.length > 0 && cells.every(c=> /^\s*:?-+:?\s*$/.test(c));
}
function splitRow(line){
  // strip the optional outer pipes, then split on | and trim each cell.
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return t.split("|").map(c=> c.trim());
}
function alignOf(cell){
  const x = cell.trim(), l = x.startsWith(":"), r = x.endsWith(":");
  return (l && r) ? "center" : r ? "right" : l ? "left" : "";
}
function cellAttr(a){ return a ? ' style="text-align:'+a+'"' : ""; }

function fmt(text){
  const lines = String(text).split("\n");
  let html = "", inList = false, inCode = false, code = "", lang = "";
  const closeList = ()=>{ if(inList){ html += "</ul>"; inList = false; } };
  // mermaid fences render to a diagram (lazy-loaded); other fences -> <pre>.
  // We emit the raw source either way so it stays readable offline.
  const flushCode = ()=>{
    html += (lang === "mermaid")
      ? '<div class="mermaid">'+esc(code)+'</div>'
      : "<pre>"+esc(code)+"</pre>";
    code = ""; lang = ""; inCode = false;
  };
  for(let i = 0; i < lines.length; i++){
    const raw = lines[i];
    const t = raw.trim();
    if(inCode){
      if(t === "~~~"){ flushCode(); continue; }   // close on a bare fence
      code += (code ? "\n" : "") + raw; continue;
    }
    if(t.slice(0,3) === "~~~"){                    // open; capture info string (e.g. mermaid)
      closeList(); inCode = true; lang = t.slice(3).trim().toLowerCase(); continue;
    }
    // table: a pipe-bearing header line followed by a delimiter line.
    if(t.indexOf("|") !== -1 && i + 1 < lines.length && isTableDelim(lines[i+1])){
      closeList();
      const aligns = splitRow(lines[i+1]).map(alignOf);
      const head = splitRow(raw).map((h,idx)=> "<th"+cellAttr(aligns[idx])+">"+inline(h)+"</th>").join("");
      i += 2;
      const body = [];
      for(; i < lines.length; i++){
        const r = lines[i];
        if(r.trim() === "" || r.indexOf("|") === -1 || r.trim().slice(0,3) === "~~~") break;
        body.push("<tr>"+splitRow(r).map((cell,idx)=> "<td"+cellAttr(aligns[idx])+">"+inline(cell)+"</td>").join("")+"</tr>");
      }
      i--;   // step back: the outer loop's i++ re-lands on the first non-body line
      html += '<table class="mdtable"><thead><tr>'+head+"</tr></thead><tbody>"+body.join("")+"</tbody></table>";
      continue;
    }
    if(/^\s*-\s+/.test(raw)){
      if(!inList){ html += "<ul>"; inList = true; }
      html += "<li>"+inline(raw.replace(/^\s*-\s+/, ""))+"</li>";
      continue;
    }
    closeList();
    if(raw.trim() === "") continue;
    html += "<p>"+inline(raw)+"</p>";
  }
  closeList();
  if(inCode){ flushCode(); }
  return html;
}

/* ===================== Render ===================== */
const STATUS_LABEL = {resolved:"resolved", open:"open", riffing:"riffing", info:"info", later:"later"};
// NEEDS = statuses that block / want you before we begin. "later" is deliberately
// NOT here: it resolves as we build, so it never reads as "NEEDS YOU".
const NEEDS = new Set(["open","riffing"]);

/* The DOC validator lives in the shared board.validate.js so Node can run the
   SAME checks headless (see validate.cjs). It defines globalThis.validateDoc(DOC).
   renderWarnings paints the result as a banner above the views. */
function renderWarnings(){
  const el = document.getElementById("docWarnings");
  if(!el) return;
  const issues = (typeof validateDoc === "function") ? validateDoc(DOC) : [];
  if(!issues.length){ el.innerHTML = ""; el.style.display = "none"; return; }
  el.style.display = "";
  el.innerHTML = '<div class="docwarn"><b>⚠ DOC consistency — '+issues.length+' issue'+
    (issues.length>1?"s":"")+'</b> <span class="dwhint">fix in board.js</span><ul>'+
    issues.map(i=> '<li>'+esc(i)+'</li>').join("")+'</ul></div>';
}

// Invariant (user rule, ch5): a card can't be "resolved" while any of its questions
// is unanswered — resolution means every question is closed. Enforced at load so the
// board can never display a resolved card with an open/later question.
function normalizeStatuses(){
  DOC.cards.forEach(c=>{
    if(c.status !== "resolved") return;
    const qs = DOC.questions.filter(q=> q.card === c.id);
    if(qs.some(q=> q.status === "open")) c.status = "open";
    else if(qs.some(q=> q.status === "later")) c.status = "later";
  });
}

function bubble(by, ch, t, draftIdx){
  const draft = draftIdx !== undefined && draftIdx !== null;
  const side = (by === "user" || draft) ? "right" : "left";
  const who = (by === "user") ? "You" : "Claude";
  const cls = "msg " + (draft ? "draft" : side) + (draft ? "" : (" " + (by === "user" ? "right" : "left")));
  const rm = draft ? '<button class="rmdraft" data-idx="'+draftIdx+'">remove ✕</button>' : "";
  const badge = "ch" + ch + (draft ? " · draft" : "");
  return '<div class="'+cls+'"><div class="meta">'+who+' · '+badge+rm+'</div><div class="txt">'+fmt(t)+'</div></div>';
}

// Surface a card's still-open (and later) questions inline, so an open/riffing card
// always shows WHY it's open right here — not only in the roll-up. (User: "I don't
// see a question.")
// One answer box per open/later question. The same text shows on the card, in the
// roll-up and in the plan document's "Still to decide"; it is exported as answers{}.
function answerBox(q){
  return '<textarea class="qanswerbox" data-q="'+esc(q.id)+'" rows="2" aria-label="Your answer to '+esc(q.id)+'" placeholder="Your answer to '+esc(q.id)+'…">'+esc(state.answers[q.id]||"")+'</textarea>';
}
function cardQuestionsHtml(c){
  const qs = DOC.questions.filter(q=> q.card===c.id && (q.status==="open" || q.status==="later"));
  if(!qs.length) return "";
  const allLater = qs.every(q=> q.status==="later");
  const head = allLater ? "⏳ Settles later — not blocking" : "❓ Open on this card — needed to resolve it";
  let h = '<div class="cardq'+(allLater?" later-only":"")+'"><div class="cqh">'+head+'</div>';
  qs.forEach(q=>{
    h += '<div class="cqrow"><span class="qid">'+esc(q.id)+'</span><span class="cqtext">'+inline(q.q)+'</span></div>'+answerBox(q);
  });
  return h + '</div>';
}

function cardHtml(c){
  const drafts = state.drafts[c.id] || [];
  const isOpen = !state.collapsed[c.id];
  const need = NEEDS.has(c.status);
  const openQ = DOC.questions.filter(q=> q.card===c.id && q.status==="open" && !state.addressed[q.id]).length;
  let stream = '<div class="stream">';
  c.stream.forEach(e=> stream += bubble(e.by, e.ch, e.t));
  drafts.forEach((d, i)=> stream += bubble("user", NEXT, d.t, i));
  stream += "</div>";

  const compose =
    '<div class="compose">'+
      '<textarea class="reply" data-card="'+c.id+'" placeholder="Reply on this topic (becomes ch'+NEXT+')…">'+esc(state.composing[c.id]||"")+'</textarea>'+
      '<div class="crow">'+
        '<span class="spacer"></span>'+
        '<button class="btn add" data-card="'+c.id+'">Add to ch'+NEXT+'</button>'+
      '</div>'+
    '</div>';

  return '<div id="card-'+c.id+'" class="card s-'+c.status+(isOpen?" open":"")+'" data-card="'+c.id+'">'+
    '<div class="chead" data-card="'+c.id+'">'+
      '<span class="cid">'+esc(c.id)+'</span>'+
      '<span class="ctitle">'+esc(c.title)+'</span>'+
      (openQ?'<span class="qchip">❓'+openQ+'</span>':"")+
      (drafts.length?'<span class="draftcount">'+drafts.length+' draft'+(drafts.length>1?"s":"")+'</span>':"")+
      (need?'<span class="needbadge">NEEDS YOU</span>':"")+
      '<span class="schip '+c.status+'">'+STATUS_LABEL[c.status]+'</span>'+
      '<span class="chev">▸</span>'+
    '</div>'+
    '<div class="cbody">'+stream+cardQuestionsHtml(c)+compose+'</div>'+
  '</div>';
}

function currentFilter(){
  return {
    q: (document.getElementById("search").value||"").toLowerCase().trim(),
    status: document.getElementById("fStatus").value
  };
}
function matches(c, f){
  if(f.status === "needs" && !NEEDS.has(c.status)) return false;
  if(f.status && f.status !== "needs" && c.status !== f.status) return false;
  if(f.q){
    const hay = (c.id+" "+c.title+" "+c.stream.map(e=>e.t).join(" ")).toLowerCase();
    if(!hay.includes(f.q)) return false;
  }
  return true;
}

function render(){
  const f = currentFilter();
  const list = document.getElementById("list");
  const shown = DOC.cards.filter(c=> matches(c, f));
  list.innerHTML = shown.map(cardHtml).join("");
  document.getElementById("emptyMsg").style.display = shown.length ? "none" : "block";
  updateStats();
  renderMermaid();
}

/* The about/help panel (intro + chapter legend + the stats row) — built from DOC so
   the engine carries no board-specific text. #stats is created here, then kept current
   by updateStats(). */
function renderAbout(){
  const box = document.getElementById("aboutBox");
  if(!box) return;
  const sub = DOC.about ||
    "One card per topic; each card is a chat stream stamped by **chapter** (a conversation round). Add replies per card, then **Copy JSON for Claude**. Autosaves to this browser.";
  const legend = (DOC.chapterLegend||[]).map(c=>
    '<span><b>ch'+c.ch+'</b> '+inline(c.t)+'</span>').join("");
  box.innerHTML =
    '<div class="sub">'+inline(sub)+'</div>'+
    '<div class="stats" id="stats"></div>'+
    '<div class="legend">'+legend+
      '<span>· statuses: <b style="color:#9fe6c4">resolved (all questions answered)</b> / '+
      '<b style="color:#f1d27a">open (needs you)</b> / <b style="color:#d9bcff">riffing (needs you)</b> / '+
      '<b style="color:#9fe0e8">later (settles as we build)</b> / <b style="color:#b8c0c8">info</b></span>'+
    '</div>';
}
function updateStats(){
  let drafts = 0, need = 0;
  DOC.cards.forEach(c=>{
    drafts += (state.drafts[c.id]||[]).length;
    if(NEEDS.has(c.status)) need++;
  });
  const openQ = DOC.questions.filter(q=> q.status==="open" && !state.addressed[q.id]).length;
  document.getElementById("stats").innerHTML =
    '<span class="stat ch"><b>'+DOC.chapter+'</b> current chapter</span>'+
    '<span class="stat"><b>'+DOC.cards.length+'</b> topics</span>'+
    '<span class="stat need"><b>'+openQ+'</b> open questions</span>'+
    '<span class="stat need"><b>'+need+'</b> cards need you</span>'+
    '<span class="stat"><b>'+drafts+'</b> your drafts (ch'+NEXT+')</span>';
}

function renderQuestions(){
  const open = DOC.questions.filter(q=> q.status==="open");
  const later = DOC.questions.filter(q=> q.status==="later");
  const answered = DOC.questions.filter(q=> q.status==="answered");
  const remaining = open.filter(q=> !state.addressed[q.id]).length;
  let h = '<details class="qbox" id="qbox" open>'+
    '<summary><span class="gicon">▸</span> ❓ Open questions <span class="qn">'+remaining+'</span>'+
    '<span class="qhint">click a chip to jump to its card · tick the ones you\'ve addressed</span></summary>'+
    '<div class="qbody">';
  if(!open.length){
    h += '<div class="qempty">No open questions blocking the start.'+(later.length?' (See "settle later" below.)':' All answered.')+'</div>';
  } else {
    open.forEach(q=>{
      const done = !!state.addressed[q.id];
      h += '<div class="qrow'+(done?" done":"")+'">'+
        '<input type="checkbox" class="qchk" data-q="'+q.id+'"'+(done?" checked":"")+' title="mark addressed">'+
        '<span class="qid" id="q-'+q.id+'">'+esc(q.id)+'</span>'+
        '<span class="qtext">'+inline(q.q)+'</span>'+
        '<span class="qsrc" data-jump="'+q.card+'">'+esc(q.card)+' · ch'+q.ch+'</span>'+
      '</div>'+answerBox(q);
    });
  }
  if(later.length){
    h += '<div class="qlater"><div class="qltitle">⏳ Settle later <span class="qlhint">won\'t block the start — resolves as we build (not counted above)</span></div>';
    later.forEach(q=>{
      const done = !!state.addressed[q.id];
      h += '<div class="qrow'+(done?" done":"")+'">'+
        '<input type="checkbox" class="qchk" data-q="'+q.id+'"'+(done?" checked":"")+' title="mark settled (optional)">'+
        '<span class="qid" id="q-'+q.id+'">'+esc(q.id)+'</span>'+
        '<span class="qtext">'+inline(q.q)+'</span>'+
        '<span class="qsrc" data-jump="'+q.card+'">'+esc(q.card)+' · ch'+q.ch+'</span>'+
      '</div>'+answerBox(q);
    });
    h += '</div>';
  }
  h += '<div class="qfoot"><button class="btn ghost" id="toggleAns">'+(showAnswered?"Hide":"Show")+' answered ('+answered.length+')</button></div>';
  if(showAnswered && answered.length){
    h += '<div class="qans">';
    answered.forEach(q=>{
      h += '<div class="qarow"><div class="qatop">'+
        '<span class="qid" id="q-'+q.id+'">'+esc(q.id)+'</span>'+
        '<span class="qtext">'+inline(q.q)+'</span>'+
        '<span class="qsrc" data-jump="'+q.card+'">'+esc(q.card)+' · ch'+q.ch+'</span></div>'+
        '<div class="qanswer">✓ answered ch'+(q.ach||"?")+': '+inline(q.answer||"")+'</div></div>';
    });
    h += '</div>';
  }
  h += '</div></details>';
  document.getElementById("qpanel").innerHTML = h;
}

function jumpTo(cardId){
  document.getElementById("search").value = "";
  document.getElementById("fStatus").value = "";
  state.collapsed[cardId] = false;
  saveState(); render();
  const el = document.getElementById("card-"+cardId);
  if(el){ el.scrollIntoView({behavior:"smooth", block:"start"}); el.classList.add("flash"); setTimeout(()=> el.classList.remove("flash"), 1200); }
  try{ history.replaceState(null, "", "#"+cardId); }catch(e){}
}

/* ===================== Current Plan view =====================
   A derived, at-a-glance layer over the chat stream: the overall current plan,
   the concrete actions (with metadata), and a distilled state card per topic —
   each with a "what changed this chapter" (Δ) block so diffs pop. */
function qCard(qid){ const q = DOC.questions.find(x=> x.id===qid); return q ? q.card : null; }
function fileLabel(p){
  const noanchor = p.split("#")[0];
  const tail = noanchor.split("/").slice(-2).join("/");
  const m = p.match(/#L(\d+)/);
  return tail + (m ? ":"+m[1] : "");
}
// One change-block, shared at every level. Highlights the current chapter, tucks
// earlier chapters behind a toggle. Returns {movedNow, html}.
function changeBlocks(changes){
  changes = changes || [];
  const now = changes.filter(c=> c.ch === CH);
  const prior = changes.filter(c=> c.ch < CH).sort((a,b)=> b.ch - a.ch);
  let html = "";
  if(now.length){
    html += now.map(c=> '<div class="chg now"><b>Δ ch'+CH+'</b> '+inline(c.t)+'</div>').join("");
  } else {
    const last = prior.length ? prior[0].ch : null;
    html += '<div class="chg none">no change in ch'+CH+(last?' · last moved ch'+last:'')+'</div>';
  }
  if(prior.length){
    html += '<details class="chgmore"><summary>earlier changes ('+prior.length+')</summary>'+
      prior.map(c=> '<div class="chgi"><b>ch'+c.ch+'</b> · '+inline(c.t)+'</div>').join("")+
      '</details>';
  }
  return {movedNow: now.length>0, html};
}

function stateCardHtml(c){
  const cb = changeBlocks(c.changes);
  const need = NEEDS.has(c.status);
  return '<div id="state-'+c.id+'" class="statecard s-'+c.status+(cb.movedNow?" moved-now":"")+'">'+
    '<div class="schead">'+
      '<span class="cid">'+esc(c.id)+'</span>'+
      '<span class="ctitle">'+esc(c.title)+'</span>'+
      (cb.movedNow?'<span class="deltab">Δ ch'+CH+'</span>':"")+
      (need?'<span class="needbadge">NEEDS YOU</span>':"")+
      '<span class="schip '+c.status+'">'+STATUS_LABEL[c.status]+'</span>'+
      '<span class="discusslink" data-discuss="'+esc(c.id)+'" title="open this topic in the discussion">💬 Discuss →</span>'+
    '</div>'+
    '<div class="sstate">'+fmt(c.state||"_(no summary yet)_")+'</div>'+
    cb.html+
  '</div>';
}

function actionRow(a){
  const moved = a.ch === CH;
  const files = (a.files||[]).map(p=> '<a href="'+esc(p)+'" class="codelink">'+esc(fileLabel(p))+'</a>').join("");
  const waits = (a.waiting||[]).map(q=> '<span class="qjump" data-qjump="'+esc(q)+'" title="jump to this question in the roll-up">'+esc(q)+'</span>').join("");
  let meta = "";
  if(files) meta += '<span class="mfiles">'+files+'</span>';
  if(waits) meta += '<span class="wait">waiting on</span>'+waits;
  return '<div class="act a-'+a.status+'">'+
    '<span class="astatus '+a.status+'">'+a.status+'</span>'+
    '<div class="abody">'+
      '<div class="awhat">'+inline(a.what)+'</div>'+
      (meta?'<div class="ameta">'+meta+'</div>':"")+
    '</div>'+
    (moved?'<span class="deltab">Δ ch'+CH+'</span>':"")+
  '</div>';
}
function actionsHtml(A, title){
  A = A || DOC.actions || [];
  if(!A.length) return "";
  const count = s=> A.filter(a=> a.status===s).length;
  return '<div class="actbox">'+
    '<div class="ahead">⚙️ '+(title || "Actions when we build")+
      '<span class="acount ready">'+count("ready")+' ready</span>'+
      '<span class="acount blocked">'+count("blocked")+' blocked</span>'+
      '<span class="acount proposed">'+count("proposed")+' proposed</span>'+
      '<span class="ahint">files + what each is waiting on · Δ = added/changed this chapter</span>'+
    '</div>'+
    A.map(actionRow).join("")+
  '</div>';
}

function movedChipsHtml(){
  const cards = DOC.cards.filter(c=> (c.changes||[]).some(x=> x.ch===CH));
  const acts = (DOC.actions||[]).filter(a=> a.ch===CH);
  let chips = cards.map(c=> '<span class="mchip" data-movejump="'+c.id+'">'+esc(c.id)+'</span>').join("");
  if(acts.length) chips += '<span class="mchip" data-moveact="1">+'+acts.length+' action'+(acts.length>1?"s":"")+'</span>';
  return '<div class="moved"><span class="mlabel">moved in ch'+CH+'</span>'+
    (chips || '<span class="mnone">nothing changed this chapter</span>')+'</div>';
}

function renderPlan(){
  if(PLAN_DOC) return;   // the plan document is the whole view (mountPlanDoc)
  const cb = changeBlocks(DOC.planChanges);
  document.getElementById("planPanel").innerHTML =
    '<div class="planwrap">'+
      '<h2>📋 Current Plan <span class="asof">as of ch'+CH+'</span></h2>'+
      '<div class="planbody">'+fmt(DOC.plan||"")+'</div>'+
      movedChipsHtml()+
      cb.html+
    '</div>';
  document.getElementById("actionsPanel").innerHTML = actionsHtml();
  document.getElementById("stateList").innerHTML = DOC.cards.map(stateCardHtml).join("");
  renderMermaid();
}

/* ===================== Plan document (optional) =====================
   DOC.planDoc points at the board's rich plan page (planning/<disc>/plan.html —
   prose, diagrams, tables). When there is one, it IS the Plan view: the doc
   fills the tab edge to edge, reading the same as the page on its own, and the
   markdown plan + per-topic state cards aren't shown (unphased actions move to
   the Implementation view). Doclinks from card text and #doc / #doc-<section>
   deep links open it. The panel is injected here, so board.html shells copied
   before plan docs existed need no edits.

   Sizing + link routing: plan.doc.js inside the doc posts {planDoc:1, type:…}
   messages (height / scroll / board), which works even on file://. A doc
   without plan.doc.js still gets the same treatment when the frame is
   same-origin (Live Server); otherwise it falls back to a fixed-height frame. */
let docFrame = null, docPending = null;

function mountPlanDoc(){
  if(!PLAN_DOC) return;
  const view = document.getElementById("planView");
  view.classList.add("docmode");
  let host = document.getElementById("planDocPanel");
  if(!host){
    host = document.createElement("div"); host.id = "planDocPanel";
    view.insertBefore(host, view.firstChild);
  }
  const stale = PLAN_DOC.ch && PLAN_DOC.ch < CH
    ? '<span class="pdocstale" title="Written at ch'+PLAN_DOC.ch+'; the board has moved since">board is at ch'+CH+' — may lag</span>' : "";
  host.innerHTML =
    '<div class="pdocbar">'+
      (PLAN_DOC.ch ? '<span>plan as of ch'+PLAN_DOC.ch+'</span>' : "")+
      stale+
      '<a href="'+esc(PLAN_DOC.href)+'" target="_blank" rel="noopener">Open full page ↗</a>'+
    '</div>'+
    '<iframe class="pdocframe" id="pdoc" title="Plan document"></iframe>';
  docFrame = host.querySelector(".pdocframe");
  docFrame.addEventListener("load", onDocLoad);
  docFrame.src = PLAN_DOC.href;
}
function docSameOrigin(){ try{ return docFrame.contentDocument || null; }catch(e){ return null; } }
function sizeDoc(h){ if(h > 0) docFrame.style.height = Math.ceil(h) + "px"; }
// y = offset inside the doc → scroll the board page so that point sits under the sticky header
function scrollDocTo(y){
  const head = document.querySelector("header.top");
  const top = docFrame.getBoundingClientRect().top + window.scrollY + y - (head ? head.offsetHeight : 0) - 8;
  window.scrollTo({top: Math.max(0, top), behavior:"smooth"});
}
function goToDoc(section){
  if(!PLAN_DOC) return;
  setView("plan");
  try{ history.replaceState(null, "", "#doc" + (section ? "-" + section : "")); }catch(e){}
  if(!section){ window.scrollTo({top:0, behavior:"smooth"}); return; }
  docPending = section;
  sendDocGoto();
}
function sendDocGoto(){
  if(!docPending || !docFrame) return;
  const d = docSameOrigin();
  if(d && d.readyState === "complete" && d.URL !== "about:blank"){
    const el = d.getElementById(docPending);
    docPending = null;
    if(el) scrollDocTo(el.getBoundingClientRect().top + d.defaultView.scrollY);
  } else if(!d && docFrame.contentWindow){
    docFrame.contentWindow.postMessage({planDoc:1, type:"goto", id:docPending}, "*");   // plan.doc.js answers with "scroll"
  }
}
// A link clicked inside the doc: this board's deep links drive the board; other pages open in a new tab.
function docNavigate(absUrl){
  const u = new URL(absUrl);
  if(u.pathname === location.pathname){
    try{ history.replaceState(null, "", u.hash || "#"); }catch(e){}
    if(u.hash) applyHash(); else window.scrollTo({top:0, behavior:"smooth"});
    return;
  }
  window.open(absUrl, "_blank", "noopener");
}
function onDocLoad(){
  const d = docSameOrigin();
  if(d && d.documentElement){
    // same-origin: size + route links directly (covers docs that don't load plan.doc.js)
    d.documentElement.classList.add("embedded");
    const measure = ()=> sizeDoc(d.documentElement.getBoundingClientRect().height);
    measure();
    if(d.defaultView.ResizeObserver) new d.defaultView.ResizeObserver(measure).observe(d.documentElement);
    d.addEventListener("click", e=>{
      if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;   // plan.doc.js already handled it
      const a = e.target.closest && e.target.closest("a[href]");
      if(!a || a.target) return;
      const raw = a.getAttribute("href");
      if(raw.charAt(0) === "#"){
        const el = d.getElementById(decodeURIComponent(raw.slice(1)));
        if(el){ e.preventDefault(); scrollDocTo(el.getBoundingClientRect().top + d.defaultView.scrollY); }
        return;
      }
      e.preventDefault(); docNavigate(a.href);
    });
  }
  if(docPending) setTimeout(sendDocGoto, 60);   // let layout settle (and plan.doc.js report its height) first
}
window.addEventListener("message", e=>{
  const m = e.data;
  if(!docFrame || e.source !== docFrame.contentWindow || !m || !m.planDoc) return;
  if(m.type === "height") sizeDoc(m.h);
  else if(m.type === "scroll") scrollDocTo(m.y || 0);
  else if(m.type === "board") docNavigate(location.href.split("#")[0] + (m.hash || ""));
  else if(m.type === "docready") sendAnswersToDoc();
  else if(m.type === "answer") setAnswer(m.q, m.t, "doc");
});

/* ===================== Implementation view =====================
   The locked design, laid out as ordered phases. Each phase pulls its atomic
   steps from actions[] (one source of truth) and adds a goal, dependency order,
   a VERIFY gate, and an AUDIT callout — the last-chance review before building. */
function phaseStepHtml(actId){
  const a = (DOC.actions||[]).find(x=> x.id===actId);
  if(!a) return '<div class="pstep">⚠ unknown action '+esc(actId)+'</div>';
  return actionRow(a);
}
function renderImpl(){
  const P = DOC.phases || [];
  const built = P.filter(p=> p.status==="built" || p.status==="done").length;
  const ready = P.filter(p=> p.status==="ready").length;
  const deferred = P.filter(p=> p.status==="deferred").length;
  const tally = [];
  if(built)    tally.push('<b>'+built+' built</b>');
  if(ready)    tally.push(ready+' ready to sequence');
  if(deferred) tally.push(deferred+' deferred');
  let h = '<div class="implwrap">'+
    '<h2>🛠 Implementation Plan <span class="asof">phased · dependency-ordered</span>'+
      '<span class="impltools"><button class="btn ghost mini" data-impl="expand">Expand all</button>'+
      '<button class="btn ghost mini" data-impl="collapse">Collapse all</button></span></h2>'+
    '<div class="implintro">The locked design, laid out as ordered phases so you can <b>audit each one before we build it</b>. Every phase names the atomic actions it delivers, what it <b>depends on</b>, a <b>✅ verify</b> gate (how we prove it works), and a <b>🔍 audit</b> callout (the thing to sanity-check first). '+
      (tally.length ? tally.join(' · ')+'.' : '')+'</div>';
  // With a plan document the Plan view shows only the doc, so actions no phase
  // has claimed yet are listed here instead.
  const phased = new Set([].concat(...P.map(p=> p.acts||[])));
  const loose = PLAN_DOC ? actionsHtml((DOC.actions||[]).filter(a=> !phased.has(a.id)),
    P.length ? "Actions not yet in a phase" : "Actions when we build") : "";
  if(!P.length){
    document.getElementById("implPanel").innerHTML = h +
      (loose || '<div class="qempty">No implementation plan yet.</div>') + '</div>';
    return;
  }
  P.forEach(p=>{
    const deps = (p.depends||[]).map(d=> '<span class="pdep">'+esc(d)+'</span>').join("");
    const acts = (p.acts||[]).map(phaseStepHtml).join("");
    const steps = (p.steps||[]).map(s=> '<div class="pstep">'+inline(s)+'</div>').join("");
    // collapsible: built/done phases default collapsed (out of the way); your
    // explicit toggle (stored per phase id) wins thereafter.
    const collapsed = (p.id in state.implCollapsed)
      ? state.implCollapsed[p.id]
      : (p.status==="built" || p.status==="done");
    h += '<div class="phase p-'+p.status+(collapsed?' collapsed':'')+'" data-phase="'+esc(p.id)+'">'+
      '<div class="phead" title="click to expand/collapse">'+
        '<span class="pcaret">▾</span>'+
        '<span class="pnum">Phase '+p.n+'</span>'+
        '<span class="ptitle">'+esc(p.title)+'</span>'+
        '<span class="pstatus '+p.status+'">'+esc(p.status)+'</span>'+
        (p.risk?'<span class="prisk">risk: '+esc(p.risk)+'</span>':"")+
      '</div>'+
      '<div class="pbody">'+
        '<div class="pgoal">'+inline(p.goal||"")+'</div>'+
        (deps
          ? '<div class="pdeps"><span class="pdeplabel">depends on</span>'+deps+'</div>'
          : '<div class="pdeps"><span class="pdeplabel nodep">no dependencies — can start now</span></div>')+
        ((acts||steps)?'<div class="psteps">'+acts+steps+'</div>':"")+
        ((p.verify && p.verify!=="—")?'<div class="pverify"><span class="pvlabel">✅ Verify</span>'+inline(p.verify)+'</div>':"")+
        (p.audit?'<div class="paudit"><span class="palabel">🔍 Audit</span>'+inline(p.audit)+'</div>':"")+
      '</div>'+
    '</div>';
  });
  h += loose + '</div>';
  document.getElementById("implPanel").innerHTML = h;
  renderMermaid();
}

function jumpToState(id){
  const el = document.getElementById("state-"+id);
  if(el){ el.scrollIntoView({behavior:"smooth", block:"start"}); el.classList.add("flash"); setTimeout(()=> el.classList.remove("flash"), 1200); }
  try{ history.replaceState(null, "", "#state-"+id); }catch(e){}
}

// Jump to the actual question in the roll-up (Discussion view), not its topic card.
function jumpToQuestion(qid){
  const q = DOC.questions.find(x=> x.id===qid);
  if(!q) return;
  setView("discuss");
  const qbox = document.getElementById("qbox");
  if(qbox) qbox.open = true;                                  // ensure the roll-up is expanded
  if(q.status==="answered" && !showAnswered){ showAnswered = true; renderQuestions(); }  // reveal if behind the toggle
  const el = document.getElementById("q-"+qid);
  const row = el ? (el.closest(".qrow") || el.closest(".qarow") || el) : null;
  if(row){ row.scrollIntoView({behavior:"smooth", block:"center"}); row.classList.add("flash"); setTimeout(()=> row.classList.remove("flash"), 1200); }
  try{ history.replaceState(null, "", "#q-"+qid); }catch(e){}
}

function setView(v){
  if(v !== "plan" && v !== "impl" && v !== "discuss") v = "plan";
  state.view = v; saveState();
  document.getElementById("planView").hidden = (v !== "plan");
  document.getElementById("implView").hidden = (v !== "impl");
  document.getElementById("discussView").hidden = (v !== "discuss");
  document.getElementById("controls").style.display = (v === "discuss") ? "" : "none";
  document.querySelectorAll("#viewTabs .vtab").forEach(b=> b.classList.toggle("active", b.dataset.view === v));
  renderMermaid();   // run any diagrams that just became visible
}

/* Deep-linking: board.html#IDENTITY → that card in Discussion; #state-IDENTITY → its
   Plan state card; #q-Q5 → that question in the roll-up. Runs on load + on hashchange. */
function applyHash(){
  const h = (location.hash || "").replace(/^#/, "");
  if(!h) return;
  if(PLAN_DOC && (h === "doc" || h.indexOf("doc-") === 0)){ goToDoc(decodeURIComponent(h.slice(4))); return; }
  if(h.indexOf("q-") === 0){ jumpToQuestion(h.slice(2)); return; }
  const id = h.replace(/^card-/, "").replace(/^state-/, "");
  if(h.indexOf("state-") === 0 && DOC.cards.some(c=> c.id===id) && !PLAN_DOC){ setView("plan"); jumpToState(id); return; }
  if(DOC.cards.some(c=> c.id===id)){ setView("discuss"); jumpTo(id); return; }
  if((DOC.questions||[]).some(qq=> qq.id===id)){ jumpToQuestion(id); return; }
}

document.getElementById("viewTabs").addEventListener("click", e=>{
  const b = e.target.closest(".vtab");
  if(b) setView(b.dataset.view);
});
document.getElementById("planView").addEventListener("click", e=>{
  const dl = e.target.closest("[data-discuss]");
  if(dl){ setView("discuss"); jumpTo(dl.dataset.discuss); return; }
  const mj = e.target.closest("[data-movejump]");
  if(mj){ jumpToState(mj.dataset.movejump); return; }
  if(e.target.closest("[data-moveact]")){
    document.getElementById("actionsPanel").scrollIntoView({behavior:"smooth", block:"start"}); return;
  }
  const qj = e.target.closest("[data-qjump]");
  if(qj){ jumpToQuestion(qj.dataset.qjump); return; }
});
// Implementation: click a phase header to collapse/expand it.
document.getElementById("implPanel").addEventListener("click", e=>{
  const all = e.target.closest("[data-impl]");
  if(all){ const v = all.dataset.impl === "collapse";
    (DOC.phases||[]).forEach(p=> state.implCollapsed[p.id]=v); saveState(); renderImpl(); return; }
  const qj = e.target.closest("[data-qjump]");
  if(qj){ jumpToQuestion(qj.dataset.qjump); return; }
  const head = e.target.closest(".phead");
  if(!head) return;
  if(e.target.closest("a")) return;          // let links inside behave normally
  const ph = head.closest(".phase"); if(!ph) return;
  const id = ph.dataset.phase;
  const def = ph.classList.contains("p-built") || ph.classList.contains("p-done");
  const cur = (id in state.implCollapsed) ? state.implCollapsed[id] : def;
  state.implCollapsed[id] = !cur;
  saveState(); renderImpl();
});

/* ===================== Events ===================== */
document.getElementById("list").addEventListener("click", e=>{
  const head = e.target.closest(".chead");
  if(head && !e.target.closest("button") && !e.target.closest("select") && !e.target.closest("textarea")){
    const id = head.dataset.card;
    state.collapsed[id] = !state.collapsed[id];
    saveState(); render(); return;
  }
  const add = e.target.closest(".add");
  if(add){
    const id = add.dataset.card;
    const ta = document.querySelector('textarea.reply[data-card="'+id+'"]');
    const val = (ta.value||"").trim();
    if(!val) return;
    (state.drafts[id] = state.drafts[id]||[]).push({t:val, ts:new Date().toISOString()});
    ta.value = ""; delete state.composing[id];
    state.collapsed[id] = false;
    saveState(); render(); return;
  }
  const rm = e.target.closest(".rmdraft");
  if(rm){
    const id = e.target.closest(".card").dataset.card;
    const idx = parseInt(rm.dataset.idx, 10);
    if(state.drafts[id]){ state.drafts[id].splice(idx,1); if(!state.drafts[id].length) delete state.drafts[id]; }
    saveState(); render(); return;
  }
});
/* (per-card reaction select removed — replies carry the signal) */
// Persist in-progress reply text on every keystroke so an accidental refresh
// (or a re-render from another card) never loses what you typed. No render() here
// → the textarea keeps focus/caret while you type.
document.getElementById("list").addEventListener("input", e=>{
  const ta = e.target.closest("textarea.reply");
  if(ta){
    const id = ta.dataset.card;
    if(ta.value) state.composing[id] = ta.value; else delete state.composing[id];
    saveState();
  }
});
/* ---- answer boxes: one value per question, shown in every view ---- */
function sendAnswersToDoc(){
  if(docFrame && docFrame.contentWindow)
    docFrame.contentWindow.postMessage({planDoc:1, type:"answers", answers:state.answers, note:state.global||""}, "*");
}
function showAnswer(q, t, active){
  document.querySelectorAll('textarea.qanswerbox[data-q="'+q+'"]').forEach(ta=>{ if(ta !== active && ta.value !== t) ta.value = t; });
}
// from: "doc" = typed in the plan document (already showing there); anything else is sent on to it
function setAnswer(q, t, from, active){
  if(q === "__note"){
    state.global = t;
    document.getElementById("globalNotes").value = t;
  } else {
    if(t) state.answers[q] = t; else delete state.answers[q];
    showAnswer(q, t, active);
  }
  saveState();
  if(from !== "doc") sendAnswersToDoc();
}
function onAnswerInput(e){
  const ta = e.target.closest && e.target.closest("textarea.qanswerbox");
  if(ta) setAnswer(ta.dataset.q, ta.value, "board", ta);
}
document.getElementById("list").addEventListener("input", onAnswerInput);
document.getElementById("qpanel").addEventListener("input", onAnswerInput);
// The plan document opened in its own tab writes to the same storage; pick its answers up here,
// so a later save from this tab can't overwrite them.
window.addEventListener("storage", e=>{
  if(e.key !== LS_KEY || !e.newValue) return;
  try{
    const s = JSON.parse(e.newValue);
    state.answers = s.answers || {};
    state.global = s.global || "";
    document.getElementById("globalNotes").value = state.global;
    document.querySelectorAll("textarea.qanswerbox").forEach(ta=>{ ta.value = state.answers[ta.dataset.q] || ""; });
    sendAnswersToDoc();
  }catch(err){}
});
document.getElementById("qpanel").addEventListener("click", e=>{
  const jump = e.target.closest("[data-jump]");
  if(jump){ jumpTo(jump.dataset.jump); return; }
  if(e.target.closest("#toggleAns")){ showAnswered = !showAnswered; renderQuestions(); return; }
});
document.getElementById("qpanel").addEventListener("change", e=>{
  const chk = e.target.closest(".qchk");
  if(chk){
    const id = chk.dataset.q;
    if(chk.checked) state.addressed[id] = true; else delete state.addressed[id];
    saveState(); renderQuestions(); render();
  }
});
document.getElementById("search").addEventListener("input", render);
document.getElementById("fStatus").addEventListener("change", render);
document.getElementById("expandAll").addEventListener("click", ()=>{ DOC.cards.forEach(c=> state.collapsed[c.id]=false); saveState(); render(); });
document.getElementById("collapseAll").addEventListener("click", ()=>{ DOC.cards.forEach(c=> state.collapsed[c.id]=true); saveState(); render(); });
document.getElementById("globalNotes").addEventListener("input", e=>{ state.global = e.target.value; saveState(); sendAnswersToDoc(); });
// Belt-and-suspenders: flush state synchronously before the page unloads, so an
// accidental refresh can't drop keystrokes still inside the autosave debounce.
window.addEventListener("beforeunload", ()=>{ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){} });
window.addEventListener("hashchange", applyHash);   // deep-link to a card/question
document.getElementById("reset").addEventListener("click", ()=>{
  if(!confirm("Clear all your drafts and notes on this board?")) return;
  const keepView = state.view || "plan";
  state = {global:"", drafts:{}, collapsed:{}, addressed:{}, composing:{}, answers:{}, aboutOpen:false, view:keepView};
  showAnswered = false;
  localStorage.removeItem(LS_KEY);
  document.getElementById("globalNotes").value = "";
  setAbout(false);
  render(); renderQuestions(); saveState(); sendAnswersToDoc();
});

/* about (help/stats/legend) — collapsed by default, remembered */
function setAbout(open){
  const box = document.getElementById("aboutBox");
  const tog = document.getElementById("aboutToggle");
  box.hidden = !open;
  tog.classList.toggle("active", open);
  tog.setAttribute("aria-expanded", open ? "true" : "false");
  state.aboutOpen = open; saveState();
}
document.getElementById("aboutToggle").addEventListener("click", ()=> setAbout(document.getElementById("aboutBox").hidden));

/* ===================== Export =====================
   Delta only. Claude already holds the whole board (it generated it), so the
   payload carries just the user's NEW input keyed by id — no titles, statuses,
   or question text echoed back. Empty fields are omitted entirely. This is the
   fewest-token, easiest-to-parse form. */
function buildExport(){
  const cards = DOC.cards.map(c=>{
    const replies = (state.drafts[c.id]||[]).map(d=> d.t);
    if(!replies.length) return null;
    return {id:c.id, replies:replies};
  }).filter(Boolean);
  const addressed = DOC.questions
    .filter(q=> (q.status==="open" || q.status==="later") && state.addressed[q.id])
    .map(q=> q.id);
  const out = {tool:(DOC.boardId||"board")+"_board", seen:DOC.chapter, next:NEXT};
  const note = (state.global||"").trim();
  if(note) out.note = note;
  const answers = {};
  DOC.questions.forEach(q=>{
    const a = (state.answers[q.id]||"").trim();
    if(a && (q.status==="open" || q.status==="later")) answers[q.id] = a;
  });
  if(Object.keys(answers).length) out.answers = answers;
  if(addressed.length) out.addressed = addressed;
  if(cards.length) out.cards = cards;
  return out;
}
function exportJsonText(){ return JSON.stringify(buildExport()); }   // compact = fewest tokens

function hasFeedback(x){ return !!(x.note || x.answers || (x.addressed&&x.addressed.length) || (x.cards&&x.cards.length)); }

// Commit any reply typed in a card box but not yet "Add"-ed, so a typed reply is
// never silently left out of the export. Returns true if anything was committed.
function flushReplies(){
  let changed = false;
  document.querySelectorAll("textarea.reply").forEach(ta=>{
    const id = ta.dataset.card;
    const val = (ta.value||"").trim();
    if(val){
      (state.drafts[id] = state.drafts[id]||[]).push({t:val, ts:new Date().toISOString()});
      ta.value = ""; delete state.composing[id];
      changed = true;
    }
  });
  if(changed){ state.global = document.getElementById("globalNotes").value; saveState(); render(); }
  return changed;
}

document.getElementById("copyJson").addEventListener("click", async ()=>{
  const btn = document.getElementById("copyJson");
  flushReplies();
  const x = buildExport();
  if(!hasFeedback(x)){ btn.textContent = "Nothing to copy"; setTimeout(()=> btn.textContent = "📋 Copy JSON for Claude", 1400); return; }
  try{ await navigator.clipboard.writeText(exportJsonText()); btn.textContent = "Copied ✓"; }
  catch(e){ btn.textContent = "Copy failed"; }
  setTimeout(()=> btn.textContent = "📋 Copy JSON for Claude", 1400);
});
/* (Markdown export removed — the JSON round-trip via Copy JSON is the path.) */

/* ===================== Inline code-file viewer ===================== */
function parseHref(href){
  const i = href.indexOf("#");
  if(i < 0) return {path:href, range:null};
  const path = href.slice(0, i);
  const m = href.slice(i).match(/#L(\d+)(?:-L(\d+))?/i);
  return {path, range: m ? [parseInt(m[1],10), m[2]?parseInt(m[2],10):parseInt(m[1],10)] : null};
}
/* --- tiny self-contained syntax highlighter (no deps, offline) --- */
const PY_KW = new Set("False await else import pass None break except in raise True class finally is return and continue for lambda try as def from nonlocal while assert del global not with async elif if or yield".split(" "));
const PY_BI = new Set("print len range int str float bool list dict set tuple type isinstance hasattr getattr setattr open enumerate zip map filter sum min max abs round sorted reversed any all super object self cls bytes bytearray repr format hex bin ord chr id input Exception".split(" "));
const JS_KW = new Set("var let const function return if else for while do switch case break continue new class extends super this typeof instanceof in of try catch finally throw await async yield import export default from as void delete null true false undefined NaN Infinity".split(" "));
const JSON_KW = new Set(["true","false","null"]);
const C_KW = new Set("auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while bool true false NULL include define ifdef ifndef endif pragma".split(" "));

const LANGS = {
  python: {keywords:PY_KW, builtins:PY_BI, rules:[
    {t:"com", re:/#[^\n]*/y},
    {t:"str", re:/(?:[rbfuRBFU]{1,2})?"""[\s\S]*?"""/y},
    {t:"str", re:/(?:[rbfuRBFU]{1,2})?'''[\s\S]*?'''/y},
    {t:"str", re:/(?:[rbfuRBFU]{1,2})?"(?:\\.|[^"\\\n])*"/y},
    {t:"str", re:/(?:[rbfuRBFU]{1,2})?'(?:\\.|[^'\\\n])*'/y},
    {t:"dec", re:/@[A-Za-z_][\w.]*/y},
    {t:"num", re:/0[xXoObB][0-9a-fA-F_]+|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?j?/y},
    {t:"ident", re:/[A-Za-z_]\w*/y},
  ]},
  js: {keywords:JS_KW, rules:[
    {t:"com", re:/\/\/[^\n]*/y},
    {t:"com", re:/\/\*[\s\S]*?\*\//y},
    {t:"str", re:/`(?:\\.|[^`\\])*`/y},
    {t:"str", re:/"(?:\\.|[^"\\\n])*"/y},
    {t:"str", re:/'(?:\\.|[^'\\\n])*'/y},
    {t:"num", re:/0[xX][0-9a-fA-F]+|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?/y},
    {t:"ident", re:/[A-Za-z_$][\w$]*/y},
  ]},
  json: {keywords:JSON_KW, rules:[
    {t:"str", re:/"(?:\\.|[^"\\])*"/y},
    {t:"num", re:/-?\d[\d.eE+\-]*/y},
    {t:"ident", re:/[A-Za-z_]\w*/y},
  ]},
  clike: {keywords:C_KW, rules:[
    {t:"com", re:/\/\/[^\n]*/y},
    {t:"com", re:/\/\*[\s\S]*?\*\//y},
    {t:"com", re:/^#[^\n]*/y},
    {t:"str", re:/"(?:\\.|[^"\\\n])*"/y},
    {t:"str", re:/'(?:\\.|[^'\\\n])*'/y},
    {t:"num", re:/0[xX][0-9a-fA-F]+|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?[fFlLuU]*/y},
    {t:"ident", re:/[A-Za-z_]\w*/y},
  ]},
  css: {rules:[
    {t:"com", re:/\/\*[\s\S]*?\*\//y},
    {t:"str", re:/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y},
    {t:"num", re:/-?\d[\d.]*(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?/y},
    {t:"ident", re:/[A-Za-z_#.\-][\w-]*/y},
  ]},
  conf: {rules:[
    {t:"com", re:/#[^\n]*/y},
    {t:"str", re:/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/y},
    {t:"num", re:/-?\d[\d.]*/y},
    {t:"ident", re:/[A-Za-z_][\w.\-]*/y},
  ]},
  plain: {rules:[]},
};
const EXT2LANG = {py:"python", js:"js", mjs:"js", cjs:"js", json:"json", c:"clike", h:"clike", cpp:"clike", hpp:"clike", cc:"clike", css:"css", yml:"conf", yaml:"conf", toml:"conf", cfg:"conf", ini:"conf", html:"plain", htm:"plain", xml:"plain", svg:"plain", md:"plain", txt:"plain"};
function extToLang(path){ const m = path.toLowerCase().match(/\.([a-z0-9]+)$/); return (m && EXT2LANG[m[1]]) || "plain"; }

function tokenize(code, lang){
  const cfg = LANGS[lang] || LANGS.plain;
  const rules = cfg.rules, kw = cfg.keywords, bi = cfg.builtins;
  const toks = []; let i = 0; const n = code.length;
  while(i < n){
    let matched = false;
    for(const r of rules){
      r.re.lastIndex = i;
      const m = r.re.exec(code);
      if(m && m[0]){
        let t = r.t;
        if(t === "ident"){ t = (kw && kw.has(m[0])) ? "kw" : (bi && bi.has(m[0])) ? "bi" : "id"; }
        toks.push({t, s:m[0]}); i += m[0].length; matched = true; break;
      }
    }
    if(!matched){ toks.push({t:"plain", s:code[i]}); i++; }
  }
  return toks;
}
function highlightLines(code, lang){
  const toks = tokenize(code, lang);
  const out = []; let cur = "";
  for(const tk of toks){
    const parts = tk.s.split("\n");
    for(let p=0; p<parts.length; p++){
      if(p > 0){ out.push(cur); cur = ""; }
      const seg = parts[p];
      if(seg){ cur += (tk.t === "plain" || tk.t === "id") ? esc(seg) : '<span class="t-'+tk.t+'">'+esc(seg)+'</span>'; }
    }
  }
  out.push(cur);
  return out;
}

async function openCode(href){
  const {path, range} = parseHref(href);
  const ov = document.getElementById("cvOverlay");
  document.getElementById("cvPath").textContent = href;
  document.getElementById("cvRaw").href = href;
  const body = document.getElementById("cvBody");
  body.innerHTML = '<div class="cv-msg">Loading '+esc(path)+' …</div>';
  ov.classList.add("show");
  try{
    const res = await fetch(path);
    if(!res.ok) throw new Error("HTTP "+res.status);
    const rows = highlightLines(await res.text(), extToLang(path));
    let html = '<div class="cv-code">';
    for(let i=0;i<rows.length;i++){
      const n = i+1;
      const isHl = range && n>=range[0] && n<=range[1];
      const content = (rows[i] && rows[i].length) ? rows[i] : " ";
      html += '<div class="cv-line'+(isHl?" hl":"")+'" data-n="'+n+'">'+
              '<span class="cv-ln">'+n+'</span><span class="cv-lt">'+content+'</span></div>';
    }
    body.innerHTML = html + '</div>';
    if(range){ const t = body.querySelector('.cv-line[data-n="'+range[0]+'"]'); if(t) t.scrollIntoView({block:"center"}); }
    else body.scrollTop = 0;
  }catch(e){
    body.innerHTML = '<div class="cv-msg">Couldn\'t load <code>'+esc(path)+'</code> ('+esc(e.message)+').<br><br>'+
      'The viewer fetches files relative to this page, so the board must be served with the <b>repo root</b> as the web root (e.g. Live Server opened at the project root). '+
      'You can still <a href="'+esc(href)+'" target="_blank" rel="noopener">open it directly ↗</a>.</div>';
  }
}
function closeCode(){ document.getElementById("cvOverlay").classList.remove("show"); }
document.body.addEventListener("click", e=>{
  const a = e.target.closest("a[href]");
  if(!a) return;
  if(a.classList.contains("doclink")){ e.preventDefault(); goToDoc(a.dataset.doc || ""); return; }
  // Only intercept codelinks (file refs the engine renders inside card content).
  // Real nav links — the 🗂 Index back-link, "Open raw ↗" — navigate normally.
  if(!a.classList.contains("codelink")) return;
  const href = a.getAttribute("href");
  if(href && CODE_RE.test(href)){ e.preventDefault(); openCode(href); }
});
document.getElementById("cvClose").addEventListener("click", closeCode);
document.getElementById("cvOverlay").addEventListener("click", e=>{ if(e.target.id==="cvOverlay") closeCode(); });
document.getElementById("cvCopy").addEventListener("click", async ()=>{
  const b = document.getElementById("cvCopy");
  try{ await navigator.clipboard.writeText(document.getElementById("cvPath").textContent); b.textContent="Copied ✓"; }
  catch(e){ b.textContent="Copy failed"; }
  setTimeout(()=> b.textContent="Copy path", 1200);
});
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeCode(); });

/* ===================== Mermaid (lazy, CDN, graceful offline fallback) =====================
   Diagrams are authored as ~~~mermaid fences and emitted as readable source by fmt().
   We load mermaid only when a diagram is actually on screen; if the CDN can't be
   reached (offline), the source block just stays visible — no broken page. Only
   VISIBLE nodes render, so diagrams inside collapsed cards wait until expanded
   (mermaid mis-sizes when it renders into a display:none container). */
const MERMAID_SRC = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
let mermaidState = "idle";   // idle | loading | ready | failed

function pendingMermaidNodes(){
  return Array.prototype.slice
    .call(document.querySelectorAll('.mermaid:not([data-processed="true"]):not(.mmderr)'))
    .filter(n=> n.offsetParent !== null);   // visible only
}
function runMermaid(){
  const nodes = pendingMermaidNodes();
  if(!nodes.length || !window.mermaid) return;
  const fail = ()=> nodes.forEach(n=> n.classList.add("mmderr"));
  try{
    const p = window.mermaid.run({nodes});       // v10 returns a promise
    if(p && p.catch) p.catch(fail);
  }catch(e){ fail(); }
}
function ensureMermaid(){
  if(mermaidState !== "idle") return;
  mermaidState = "loading";
  const s = document.createElement("script");
  s.src = MERMAID_SRC;
  s.onload = ()=>{
    try{
      window.mermaid.initialize({startOnLoad:false, theme:"dark", securityLevel:"loose",
        flowchart:{useMaxWidth:true, htmlLabels:true}});
      mermaidState = "ready";
      runMermaid();
    }catch(e){ mermaidState = "failed"; }
  };
  s.onerror = ()=>{ mermaidState = "failed"; };  // offline -> source stays readable
  document.head.appendChild(s);
}
function renderMermaid(){
  if(!pendingMermaidNodes().length) return;
  if(mermaidState === "ready") runMermaid();
  else if(mermaidState === "idle") ensureMermaid();
  // loading: the onload handler will pick up current nodes; failed: leave as source
}

/* ===================== Boot ===================== */
loadState();
document.title = (DOC.title || "Board") + " — Discussion Board";
{ const _bt = document.getElementById("boardTitle");
  if(_bt) _bt.innerHTML = esc(DOC.title || "Board") + ' <span class="h1sub">· Board</span>'; }
renderWarnings();      // validate the DOC and surface authoring issues (before normalize)
normalizeStatuses();   // enforce: no resolved card with an open question
// Chapter-advance cleanup: if this board was regenerated to a newer chapter than
// your saved drafts were written against, the round's per-card REPLIES have already
// been folded into the stream — clear them so they can't linger or re-export. (A
// plain refresh keeps the same chapter, so it preserves everything you typed — see
// the input + beforeunload handlers.)
// NOTE: state.global ("Overall notes & questions") is deliberately PRESERVED — it's
// a persistent scratchpad, not a per-round reply. Losing un-exported typing there
// (e.g. when a file edit triggers a Live Server reload mid-type) is worse than a
// stale note lingering; clear it yourself with "Reset my notes" when you're done.
if(state.docChapter !== undefined && state.docChapter < DOC.chapter){
  state.drafts = {}; state.composing = {}; state.addressed = {}; state.answers = {};
}
state.docChapter = DOC.chapter;
document.getElementById("globalNotes").value = state.global || "";
renderAbout();                 // build the about/legend panel (incl. #stats) from DOC
setAbout(!!state.aboutOpen);   // header help/legend collapsed by default
// default collapse: resolved + info collapsed, needs-you expanded — only on first load
if(Object.keys(state.collapsed).length === 0){
  DOC.cards.forEach(c=>{ state.collapsed[c.id] = !NEEDS.has(c.status); });
}
render();
renderQuestions();
mountPlanDoc();                // optional rich plan page, embedded in the Plan view
renderPlan();
renderImpl();
setView(state.view || "plan");   // Current Plan up front; remembers your choice
applyHash();                     // honor a deep-link (#IDENTITY / #state-… / #q-…) if present
saveState();
