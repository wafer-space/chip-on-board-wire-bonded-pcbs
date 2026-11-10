/* Planning Docs Index — shared engine.
   Renders window.PLANS (+ window.PLANS_BAKED) into three zones: Focus / Active /
   Archive. User overrides (pin / archive / order / group-collapse / note) live in
   localStorage and round-trip to Claude via "Copy registry". The engine is generic;
   all content is in index.js. See ../_planning_tools/PROTOCOL.md. */
"use strict";
(function(){
  const PLANS = window.PLANS;
  if(!Array.isArray(PLANS)){
    document.body.innerHTML =
      '<div style="max-width:640px;margin:80px auto;font:15px/1.6 system-ui;color:#e6edf3">' +
      '<h1>No registry loaded</h1><p style="color:#8b949e">Expected <code>index.js</code> ' +
      'to set <code>window.PLANS = [...]</code> beside this page. See ' +
      '<a href="PROTOCOL.md" style="color:#58a6ff">PROTOCOL.md</a>.</p></div>';
    return;
  }
  const META = window.PLANS_BAKED || {};
  const LS_KEY = "floe_index_v1";

  const STATUS = {
    active:    {label:"Active",     cls:"st-active"},
    partial:   {label:"Partial",    cls:"st-partial"},
    planning:  {label:"Planning",   cls:"st-planning"},
    discussion:{label:"Discussion", cls:"st-discussion"},
    later:     {label:"Later",      cls:"st-later"},
    done:      {label:"Done",       cls:"st-done"},
  };
  const STALE_DAYS = 90;

  // ---- override store (the only mutable state) -----------------------------
  let ov = load();
  let editingId = null;   // transient: which row's note is being edited
  function load(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }catch(e){ return {}; } }
  let saveT = null;
  function save(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(ov)); }catch(e){}
    const el = document.getElementById("savedAt");
    if(el) el.textContent = "Saved ✓";
    clearTimeout(saveT);
    saveT = setTimeout(()=>{ if(el) el.textContent = "Saved to this browser"; }, 1200);
  }
  function ovFor(id){ return ov[id] || (ov[id] = {}); }

  // effective rows = baked merged with overrides
  function rows(){
    return PLANS.map((p,i)=>{
      const o = ov[p.id] || {};
      return Object.assign({}, p, {
        pinned:   o.pinned   !== undefined ? o.pinned   : !!p.pinned,
        archived: o.archived !== undefined ? o.archived : !!p.archived,
        // "later" = parked: a user flag, defaulting from a registry `later:true`
        // or a baked status of "later". Visible, but kept out of the Active flow.
        later:    o.later    !== undefined ? o.later    : (p.later !== undefined ? !!p.later : p.status === "later"),
        status:   o.status   !== undefined ? o.status   : p.status,
        comment:  o.comment  !== undefined ? o.comment  : (p.comment || ""),
        order:    o.order    !== undefined ? o.order    : (p.order !== undefined ? p.order : i),
        _i:i,
      });
    });
  }

  // ---- helpers ------------------------------------------------------------
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, c=>(
    {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
  function daysBetween(a,b){
    const da = Date.parse(a), db = Date.parse(b);
    if(isNaN(da)||isNaN(db)) return null;
    return Math.round(Math.abs(db-da)/86400000);
  }
  function isStale(touched){
    if(!touched || !META.at) return false;
    const d = daysBetween(touched, META.at);
    return d != null && d > STALE_DAYS;
  }
  // keystone-event boards are board-like for needs/chapter (they have a DOC + questions)
  function isBoardish(p){ return p.kind === "board" || p.kind === "keystone"; }
  function needsOf(p){ return isBoardish(p) ? (p.needs || 0) : 0; }
  function rowById(id){ return PLANS.find(x=> x.id === id) || null; }
  function cleanup(id){ if(ov[id] && !Object.keys(ov[id]).length) delete ov[id]; }

  // a row link is relative to index.html (../<dir>/…); make it repo-relative for pasting
  function repoPath(link){ return link ? link.replace(/^(\.\.\/)+/, "planning/") : ""; }
  function repoDir(p){ return repoPath(p.link).replace(/[^/]*$/, ""); }

  // the per-card "copy context for Claude" payload — enough to find the right files
  function buildContext(p){
    const kindLabel = p.kind === "keystone" ? "keystone" : p.kind === "board" ? "board" : "plan";
    const parts = [kindLabel, "status:"+(p.status||"?")];
    if(p.group)   parts.push("group:"+p.group);
    if(p.branch)  parts.push("branch:"+p.branch);
    if(p.touched) parts.push("touched:"+p.touched);
    if(isBoardish(p)) parts.push("ch"+(p.chapter||"?")+" · "+(p.needs||0)+" need-you");
    let s = '"'+(p.title||p.id)+'" — '+repoDir(p)+' ('+parts.join(" · ")+'). ';
    s += "Open: "+repoPath(p.link)+". ";
    if(p.doc) s += "Plan doc: "+repoPath(p.doc)+". ";
    if(p.kind === "keystone" && Array.isArray(p.stones) && p.stones.length) s += "Bears stones: "+p.stones.join(", ")+". ";
    if(p.keystonedInto) s += "Keystoned into: "+p.keystonedInto+". ";
    if(p.keystoneEvent) s += "Continues from keystone event: "+p.keystoneEvent+". ";
    if(p.blurb) s += "About: "+p.blurb+" ";
    if(p.comment && p.comment.trim()) s += "My note: "+p.comment.trim();
    return s.trim();
  }
  function copyContext(p, btn){
    const txt = buildContext(p);
    navigator.clipboard.writeText(txt).then(()=>{
      if(btn){ btn.textContent = "✓"; setTimeout(()=> btn.textContent = "📎", 1200); }
    }, ()=> alert("Copy failed — here it is:\n\n"+txt));
  }

  // baked (no-override) value of a field, for diffing the export
  function bakedVal(p, key){
    if(key === "pinned")   return !!p.pinned;
    if(key === "archived") return !!p.archived;
    if(key === "later")    return (p.later !== undefined ? !!p.later : p.status === "later");
    if(key === "status")   return p.status;
    if(key === "comment")  return p.comment || "";
    if(key === "order")    return p.order;   // undefined when not baked
    return undefined;
  }

  // ---- filtering ----------------------------------------------------------
  function predicate(){
    const q = (document.getElementById("search").value || "").trim().toLowerCase();
    const fs = document.getElementById("fStatus").value;
    return (p)=>{
      if(fs){
        if(fs === "needs"){ if(needsOf(p) <= 0) return false; }
        else if(fs === "later"){ if(!p.later) return false; }
        else if(p.status !== fs) return false;
      }
      if(q){
        const hay = (p.id+" "+(p.title||"")+" "+(p.blurb||"")+" "+(p.group||"")+" "+
          ((p.tags||[]).join(" "))).toLowerCase();
        if(hay.indexOf(q) < 0) return false;
      }
      return true;
    };
  }

  // ---- row markup ---------------------------------------------------------
  function statPill(st){
    const s = STATUS[st] || {label:st||"—", cls:"st-done"};
    return '<span class="pstat '+s.cls+'">'+esc(s.label)+'</span>';
  }
  function rowHtml(p){
    const need = needsOf(p);
    const stale = isStale(p.touched);
    const cur = p.branch && META.branch && p.branch === META.branch;
    const meta = [];
    const kind = p.kind==="keystone" ? ["keystone","🔑 keystone"]
               : p.kind==="board"    ? ["board","📋 board"]
               :                       ["plan","📄 plan"];
    meta.push('<span class="kindbadge '+kind[0]+'">'+kind[1]+'</span>');
    if(p.doc) meta.push('<a class="kchip doc" href="'+esc(p.doc)+'" title="the full plan, with diagrams">📐 plan doc</a>');
    // keystone wiring: a keystone bears its stones; stones/children point back at it
    if(p.kind==="keystone" && Array.isArray(p.stones) && p.stones.length){
      const chips = p.stones.map(sid=>{ const s = rowById(sid);
        return '<a class="kchip stone" href="'+esc(s?s.link:"#")+'">'+esc(s?s.title:sid)+'</a>'; }).join("");
      meta.push('<span class="kbears" title="stones bearing into this keystone">bears '+chips+'</span>');
    }
    if(p.keystonedInto){ const k = rowById(p.keystonedInto);
      meta.push('<a class="kchip into" href="'+esc(k?k.link:"#")+'" title="this stone has borne into a keystone">→ keystoned into '+esc(k?k.title:p.keystonedInto)+'</a>'); }
    if(p.keystoneEvent){ const k = rowById(p.keystoneEvent);
      meta.push('<a class="kchip from" href="'+esc(k?k.link:"#")+'" title="continues from a keystone event">↳ from '+esc(k?k.title:p.keystoneEvent)+'</a>'); }
    if(p.group) meta.push('<span class="mtag">'+esc(p.group)+'</span>');
    if(p.branch) meta.push('<span class="mtag branch'+(cur?" cur":"")+'" title="git branch">⎇ '+esc(p.branch)+'</span>');
    if(p.touched) meta.push('<span'+(stale?' class="stale" title="untouched '+STALE_DAYS+'+ days"':"")+'>'+(stale?"🕸 ":"")+esc(p.touched)+'</span>');
    const done = p.status === "done";
    const hasC = !!(p.comment && p.comment.trim());
    const editing = editingId === p.id;
    let tail = "";
    if(editing){
      tail = '<div class="pcomment-edit"><textarea placeholder="A note to yourself — e.g. ‘done, shipped on parameters-get-channels’ / ‘blocked on X’. Esc to close.">'+esc(p.comment||"")+'</textarea></div>';
    } else if(hasC){
      tail = '<div class="pcomment" data-act="editcomment" title="click to edit"><span class="cmtag">note</span>'+esc(p.comment)+'</div>';
    }
    return ''+
      '<div class="prow'+(done?" isdone":"")+(p.kind==="keystone"?" iskeystone":"")+'" data-id="'+esc(p.id)+'" draggable="true">'+
        '<span class="drag" title="drag to reorder">⋮⋮</span>'+
        statPill(p.status)+
        '<div class="pmain">'+
          '<div><a class="ptitle" href="'+esc(p.link||"#")+'">'+esc(p.title||p.id)+'</a>'+
            (need>0?'<span class="pneed">● '+need+' need'+(need===1?"s":"")+' you</span>':"")+'</div>'+
            (p.blurb?'<div class="pblurb">'+esc(p.blurb)+'</div>':"")+
          '<div class="pmeta">'+meta.join("")+'</div>'+
        '</div>'+
        '<div class="pacts">'+
          '<button class="iconbtn'+(p.pinned?" on":"")+'" data-act="pin" title="'+(p.pinned?"Unpin":"Pin to Focus")+'">⭐</button>'+
          '<button class="iconbtn'+(p.later?" on-later":"")+'" data-act="later" title="'+(p.later?"Un-park (back to Active)":"Park for Later")+'">⏳</button>'+
          '<button class="iconbtn'+(done?" on-done":"")+'" data-act="done" title="'+(done?"Unmark done":"Mark complete (status → done)")+'">✓</button>'+
          '<button class="iconbtn'+((hasC||editing)?" on-cmt":"")+'" data-act="comment" title="'+(editing?"Close note":(hasC?"Edit note":"Add a note"))+'">💬</button>'+
          '<button class="iconbtn'+(p.archived?" on":"")+'" data-act="archive" title="'+(p.archived?"Unarchive":"Archive (soft)")+'">📦</button>'+
          '<button class="iconbtn" data-act="context" title="Copy context for Claude — paste into chat">📎</button>'+
        '</div>'+
        tail+
      '</div>';
  }

  // ---- render -------------------------------------------------------------
  function deeplink(p){
    // board with needs → jump to its first needs card if we baked an anchor
    if(p.kind === "board" && p.needs > 0 && p.needsAnchor) return p.link + "#" + p.needsAnchor;
    return p.link || "#";
  }

  function render(){
    const all = rows().filter(predicate());
    // routing priority: archived → pinned → later → active
    const pinned  = all.filter(p=> p.pinned && !p.archived);
    const active  = all.filter(p=> !p.pinned && !p.archived && !p.later);
    const later   = all.filter(p=> !p.pinned && !p.archived && p.later);
    const archived= all.filter(p=> p.archived);
    const byOrder = (a,b)=> (a.order - b.order) || a._i - b._i;

    // boards that need attention float to the top of Active (regardless of order)
    const needFirst = (a,b)=>{
      const na = needsOf(a)>0?1:0, nb = needsOf(b)>0?1:0;
      return (nb-na) || byOrder(a,b);
    };

    let h = "";

    // FOCUS
    h += '<section class="zone" id="focusZone"><div class="zonehead"><h2>⭐ Focus</h2>'+
      '<span class="zn">'+pinned.length+'</span>'+
      '<span class="zhint">pinned — what you’re driving now</span></div>'+
      '<div class="zlist" data-zone="focus">'+
      (pinned.length ? pinned.sort(byOrder).map(rowHtml).join("")
        : '<div class="emptyzone">Nothing pinned. Hit ⭐ on a plan to keep it up here.</div>')+
      '</div></section>';

    // ACTIVE (grouped)
    const groups = {};
    active.forEach(p=>{ const g = p.group || "Other"; (groups[g] = groups[g] || []).push(p); });
    const gOrder = (META.groups && META.groups.length) ? META.groups.slice() : Object.keys(groups).sort();
    Object.keys(groups).forEach(g=>{ if(gOrder.indexOf(g) < 0) gOrder.push(g); });
    const collapsed = ov._collapsed || {};

    let activeBody = "";
    gOrder.forEach(g=>{
      const list = groups[g];
      if(!list || !list.length) return;
      const isC = !!collapsed[g];
      activeBody += '<div class="group'+(isC?" collapsed":"")+'" data-group="'+esc(g)+'">'+
        '<div class="grouphead" data-act="group"><span class="gcar">▾</span>'+esc(g)+
        ' <span class="gcount">'+list.length+'</span></div>'+
        '<div class="glist" data-zone="group">'+ list.sort(needFirst).map(rowHtml).join("") +'</div>'+
        '</div>';
    });
    h += '<section class="zone" id="activeZone"><div class="zonehead"><h2>🟢 Active</h2>'+
      '<span class="zn">'+active.length+'</span>'+
      '<span class="zhint">grouped by theme · drag ⋮⋮ to reorder · boards that need you float up</span></div>'+
      (activeBody || '<div class="emptyzone">No active plans match the filter.</div>')+
      '</section>';

    // LATER (parked — visible but out of the active flow)
    h += '<section class="zone" id="laterZone"><div class="zonehead"><h2>⏳ Later</h2>'+
      '<span class="zn">'+later.length+'</span>'+
      '<span class="zhint">parked — still here, resolves when you get to it</span></div>'+
      '<div class="zlist" data-zone="later">'+
      (later.length ? later.sort(byOrder).map(rowHtml).join("")
        : '<div class="emptyzone">Nothing parked. Hit ⏳ on a plan to set it aside without losing sight of it.</div>')+
      '</div></section>';

    // ARCHIVE (collapsed by default)
    const archC = ov._archCollapsed !== false; // default collapsed
    h += '<section class="zone'+(archC?" collapsed":"")+'" id="archZone">'+
      '<div class="zonehead arctoggle" data-act="archtoggle"><span class="gcar">▾</span>'+
      '<h2>📦 Archive</h2><span class="zn">'+archived.length+'</span>'+
      '<span class="zhint">done / superseded — still searchable, never moved on disk</span></div>'+
      '<div class="archbody zlist" data-zone="archive">'+
      (archived.length ? archived.sort(byOrder).map(rowHtml).join("")
        : '<div class="emptyzone">Nothing archived.</div>')+
      '</div></section>';

    document.getElementById("list").innerHTML = h;
    renderNeedbar();
    wireRows();
  }

  function renderNeedbar(){
    const boards = rows().filter(p=> isBoardish(p) && !p.archived);
    const need = boards.filter(p=> needsOf(p) > 0);
    const total = need.reduce((n,p)=> n + needsOf(p), 0);
    const bar = document.getElementById("needbar");
    if(total > 0){
      bar.className = "needbar";
      bar.innerHTML = '<span class="nbtitle">Needs you<span class="nbn">'+total+'</span></span>'+
        need.map(p=> '<a class="needchip" href="'+esc(deeplink(p))+'"><b>'+needsOf(p)+'</b> '+esc(p.title)+'</a>').join("");
    }else{
      bar.className = "needbar clear";
      bar.innerHTML = '<span class="nbtitle">✓ All clear<span class="nbn">0</span></span>'+
        '<span class="nbhint">No board has an open or riffing question right now.</span>';
    }
  }

  // ---- drag-reorder + row actions ----------------------------------------
  let dragId = null;
  function wireRows(){
    document.querySelectorAll(".prow").forEach(row=>{
      row.addEventListener("dragstart", e=>{
        dragId = row.dataset.id; row.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        try{ e.dataTransfer.setData("text/plain", dragId); }catch(_){}
      });
      row.addEventListener("dragend", ()=>{ row.classList.remove("dragging");
        document.querySelectorAll(".prow.dragover").forEach(r=>r.classList.remove("dragover")); });
      row.addEventListener("dragover", e=>{
        e.preventDefault();
        if(row.dataset.id === dragId) return;
        // only allow reordering within the same list container
        const src = document.querySelector('.prow[data-id="'+CSS.escape(dragId)+'"]');
        if(!src || src.parentElement !== row.parentElement) return;
        row.classList.add("dragover");
      });
      row.addEventListener("dragleave", ()=> row.classList.remove("dragover"));
      row.addEventListener("drop", e=>{
        e.preventDefault();
        row.classList.remove("dragover");
        const container = row.parentElement;
        const src = document.querySelector('.prow[data-id="'+CSS.escape(dragId)+'"]');
        if(!src || src.parentElement !== container || src === row) return;
        const rect = row.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height/2;
        container.insertBefore(src, after ? row.nextSibling : row);
        persistOrder(container);
        render();
      });
    });

    document.querySelectorAll('.iconbtn[data-act]').forEach(b=>{
      b.addEventListener("click", e=>{
        e.preventDefault(); e.stopPropagation();
        const id = b.closest(".prow").dataset.id;
        const act = b.dataset.act;
        const eff = rows().find(p=> p.id === id);
        if(act === "context"){ copyContext(eff, b); return; }   // no state change
        if(act === "pin")     ovFor(id).pinned   = !eff.pinned;
        if(act === "later")   ovFor(id).later    = !eff.later;
        if(act === "archive") ovFor(id).archived = !eff.archived;
        if(act === "done"){
          if(eff.status === "done"){ if(ov[id]) delete ov[id].status; cleanup(id); }
          else ovFor(id).status = "done";
        }
        if(act === "comment") editingId = (editingId === id ? null : id);
        save(); render();
      });
    });

    // click an existing note line to edit it
    document.querySelectorAll('.pcomment[data-act="editcomment"]').forEach(el=>{
      el.addEventListener("click", ()=>{ editingId = el.closest(".prow").dataset.id; render(); });
    });
    // the note editor — saves on every keystroke without re-render (keeps focus)
    document.querySelectorAll('.pcomment-edit textarea').forEach(ta=>{
      const id = ta.closest(".prow").dataset.id;
      ta.addEventListener("input", ()=>{
        const v = ta.value;
        if(v.trim()) ovFor(id).comment = v;
        else { if(ov[id]) delete ov[id].comment; cleanup(id); }
        save();
      });
      ta.addEventListener("keydown", e=>{ if(e.key === "Escape"){ editingId = null; render(); } });
      ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    });

    document.querySelectorAll('.grouphead[data-act="group"]').forEach(g=>{
      g.addEventListener("click", ()=>{
        const name = g.parentElement.dataset.group;
        ov._collapsed = ov._collapsed || {};
        ov._collapsed[name] = !ov._collapsed[name];
        save(); render();
      });
    });
    const at = document.querySelector('.arctoggle[data-act="archtoggle"]');
    if(at) at.addEventListener("click", ()=>{
      // currently collapsed (class present) -> open; else -> collapse
      ov._archCollapsed = !document.getElementById("archZone").classList.contains("collapsed");
      save(); render();
    });
  }

  function persistOrder(container){
    const ids = Array.prototype.map.call(container.querySelectorAll(":scope > .prow"), r=> r.dataset.id);
    ids.forEach((id,idx)=>{ ovFor(id).order = idx; });
  }

  // ---- export -------------------------------------------------------------
  // Only emit overrides that genuinely DIFFER from the baked registry, so an
  // override I've already folded into index.js stops re-sending every time.
  function buildExport(){
    const overrides = {};
    Object.keys(ov).forEach(id=>{
      if(id.charAt(0) === "_") return;           // skip _collapsed / _archCollapsed / _note
      const p = PLANS.find(x=> x.id === id); if(!p) return;
      const o = ov[id], diff = {};
      Object.keys(o).forEach(k=>{
        const bv = bakedVal(p, k), cur = o[k];
        if(k === "comment"){ if((cur||"") !== (bv||"")) diff[k] = cur; }
        else if(k === "order"){ if(bv === undefined || cur !== bv) diff[k] = cur; }
        else if(cur !== bv) diff[k] = cur;
      });
      if(Object.keys(diff).length) overrides[id] = diff;
    });
    const out = { tool: "planning_index" };
    if(Object.keys(overrides).length) out.overrides = overrides;
    const note = (document.getElementById("globalNotes").value || "").trim();
    if(note) out.note = note;
    return out;
  }

  // ---- about panel --------------------------------------------------------
  function renderAbout(){
    const all = rows();
    const counts = {};
    all.forEach(p=>{ if(!p.archived) counts[p.status] = (counts[p.status]||0)+1; });
    const arch = all.filter(p=>p.archived).length;
    const laterN = all.filter(p=>!p.archived && p.later).length;
    const active = all.filter(p=>!p.archived && !p.later).length;
    const boards = all.filter(p=> p.kind==="board").length;
    const stats = '<div class="stats">'+
      '<span class="stat"><b>'+active+'</b> active</span>'+
      (laterN?'<span class="stat"><b>'+laterN+'</b> parked</span>':"")+
      '<span class="stat"><b>'+arch+'</b> archived</span>'+
      '<span class="stat ch"><b>'+boards+'</b> boards</span>'+
      (META.at?'<span class="stat">baked <b>'+esc(META.at)+'</b></span>':"")+
      (META.branch?'<span class="stat">on <b>'+esc(META.branch)+'</b></span>':"")+
      '</div>';
    const legend = '<div class="legend">'+
      Object.keys(STATUS).map(k=> '<span>'+statPill(k)+'</span>').join(" ")+
      ' <span><b>📋 board</b> = live discussion board</span>'+
      ' <span><b>🔑 keystone</b> = merged arch (its own plan type; bears its stones)</span>'+
      ' <span><b>📄 plan</b> = markdown plan</span>'+
      ' <span>🕸 = untouched '+STALE_DAYS+'+ days</span></div>';
    const about = '<div class="sub">An interactive index over every <code>planning/</code> discussion. '+
      'Drag ⋮⋮ to reorder, ⭐ to pin to Focus, ⏳ to park for Later, 📦 to soft-archive (nothing moves on disk). '+
      'Derived fields (date, branch, board "needs" counts) are baked by Claude'+(META.at?' as of '+esc(META.at):"")+'. '+
      'Edits save to this browser — hit <b>📋 Copy registry for Claude</b> to make them stick.</div>';
    document.getElementById("aboutBox").innerHTML = about + stats + legend;
  }

  // ---- boot ---------------------------------------------------------------
  function boot(){
    document.title = (META.title || "Planning Docs Index") + " — Index";
    const bt = document.getElementById("boardTitle");
    if(bt) bt.innerHTML = 'Planning Docs Index <span class="h1sub">· '+all_count()+' discussions</span>';

    // restore note
    const note = document.getElementById("globalNotes");
    if(note){
      note.value = ov._note || "";
      note.addEventListener("input", ()=>{ ov._note = note.value; save(); });
    }

    document.getElementById("search").addEventListener("input", render);
    document.getElementById("fStatus").addEventListener("change", render);

    document.getElementById("copyJson").addEventListener("click", ()=>{
      const txt = JSON.stringify(buildExport());
      navigator.clipboard.writeText(txt).then(()=>{
        const b = document.getElementById("copyJson");
        const old = b.textContent; b.textContent = "Copied ✓";
        setTimeout(()=> b.textContent = old, 1400);
      }, ()=> alert("Copy failed — here it is:\n\n"+txt));
    });

    document.getElementById("reset").addEventListener("click", ()=>{
      if(!confirm("Clear all your pins, parked/archive flags, ordering and notes on this index?")) return;
      ov = {}; try{ localStorage.removeItem(LS_KEY); }catch(e){}
      document.getElementById("globalNotes").value = "";
      render();
    });

    const at = document.getElementById("aboutToggle");
    if(at) at.addEventListener("click", ()=>{
      const box = document.getElementById("aboutBox");
      const showing = box.hasAttribute("hidden");
      if(showing) box.removeAttribute("hidden"); else box.setAttribute("hidden","");
      at.classList.toggle("active", showing);
      at.setAttribute("aria-expanded", showing ? "true":"false");
    });

    window.addEventListener("beforeunload", ()=>{ try{ localStorage.setItem(LS_KEY, JSON.stringify(ov)); }catch(e){} });

    renderAbout();
    render();
    const sv = document.getElementById("savedAt"); if(sv) sv.textContent = "Saved to this browser";
  }
  function all_count(){ return PLANS.length; }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
