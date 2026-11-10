/* ============================================================================
   Plan-document helper — loaded at the end of every planning/<disc>/plan.html.
   Schema + when to write a plan doc: ./PROTOCOL.md → "The plan document".

   Standalone, it only renders <pre class="mermaid"> diagrams. Embedded in the
   board's 📋 Current Plan view (an <iframe>), it also:
     - marks <html class="embedded"> so the doc can hide its own back-links,
     - reports its height so the board sizes the frame with no inner scrollbar,
     - routes clicks out of the frame: #section anchors scroll the board page,
       board.html#… deep links drive the board, anything else opens a new tab.
   Everything goes through postMessage, so it works on file:// too, where the
   two pages can't reach into each other directly.

   Either way, folded sections (<details>) open before a link into them is
   followed, and [data-fold="open"|"close"] buttons open or close them all.
   ========================================================================== */
(function () {
  var EMBEDDED = window.parent !== window;
  var BOARD = new URL("board.html", location.href).pathname;

  // open every <details> around el (and el itself), so a jump lands on something visible
  function reveal(el) {
    for (var n = el; n; n = n.parentElement) if (n.tagName === "DETAILS") n.open = true;
  }
  function target(hash) {
    return hash && hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-fold]");
    if (!b) return;
    var open = b.getAttribute("data-fold") === "open";
    document.querySelectorAll("details").forEach(function (d) { d.open = open; });
  });

  if (!EMBEDDED) {
    // standalone: reveal before the browser scrolls, and on a deep link or Back/Forward
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      var el = a && target(a.getAttribute("href"));
      if (el) reveal(el);
    });
    var fromHash = function () {
      var el = target(location.hash);
      if (el) { reveal(el); el.scrollIntoView(); }
    };
    window.addEventListener("hashchange", fromHash);
    fromHash();
  }

  function post(msg) {
    msg.planDoc = 1;
    try { window.parent.postMessage(msg, "*"); } catch (e) {}
  }
  function yOf(el) { return el.getBoundingClientRect().top + window.scrollY; }
  function height() { return Math.ceil(document.documentElement.getBoundingClientRect().height); }

  if (EMBEDDED) {
    document.documentElement.classList.add("embedded");

    var last = 0;
    function report() {
      var h = height();
      if (h && h !== last) { last = h; post({ type: "height", h: h }); }
    }
    window.addEventListener("load", report);
    if (window.ResizeObserver) new ResizeObserver(report).observe(document.documentElement);
    report();

    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      var raw = a.getAttribute("href");
      if (raw.charAt(0) === "#") {
        var el = target(raw);
        if (el) { e.preventDefault(); reveal(el); report(); post({ type: "scroll", y: yOf(el) }); }
        return;
      }
      var u = new URL(a.href);
      e.preventDefault();
      if (u.pathname === BOARD) post({ type: "board", hash: u.hash });
      else window.open(a.href, "_blank", "noopener");
    });

    // board → doc: "scroll the board to section <id>" (from #doc-<id> / a doclink)
    window.addEventListener("message", function (e) {
      var m = e.data;
      if (!m || !m.planDoc || m.type !== "goto") return;
      var el = m.id && document.getElementById(m.id);
      if (el) { reveal(el); report(); }   // resize the frame first, so the scroll target exists
      post({ type: "scroll", y: el ? yOf(el) : 0 });
    });
  }

  /* Answer boxes: <textarea data-q="Q1"> in "Still to decide". Same storage and same export as
     the board's. Embedded, the board owns the values and this page only shows and forwards them.
     Standalone, this page reads and writes the board's localStorage record itself.
     data-q="__note" is the board's "Overall notes". Needs <meta name="plan-board"> and
     <meta name="plan-chapter">. */
  (function answers() {
    var boxes = [].slice.call(document.querySelectorAll("textarea[data-q]"));
    if (!boxes.length) return;
    function meta(n) { var e = document.querySelector('meta[name="' + n + '"]'); return e ? e.content : ""; }
    var id = meta("plan-board"), ch = parseInt(meta("plan-chapter"), 10) || 1;
    var KEY = "floe_board_" + id + "_v1";
    var count = document.querySelector("[data-answer-count]");
    var saved = document.querySelector("[data-answer-saved]");

    function tally() {
      if (!count) return;
      var qs = boxes.filter(function (b) { return b.dataset.q !== "__note"; });
      var done = qs.filter(function (b) { return b.value.trim(); }).length;
      count.textContent = done + " of " + qs.length + " answered";
    }
    function show(q, t) {
      boxes.forEach(function (b) { if (b.dataset.q === q && b.value !== t) b.value = t; });
    }
    function read() {
      var s = {};
      try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
      // same rule as the board: a new chapter clears the last round's answers and drafts
      if (s.docChapter !== undefined && s.docChapter < ch) { s.answers = {}; s.drafts = {}; s.composing = {}; s.addressed = {}; }
      s.docChapter = ch;
      s.answers = s.answers || {};
      return s;
    }
    function fill(s) {
      boxes.forEach(function (b) { b.value = b.dataset.q === "__note" ? (s.global || "") : (s.answers[b.dataset.q] || ""); });
      tally();
    }
    function store(q, t) {
      if (EMBEDDED) { post({ type: "answer", q: q, t: t }); return; }
      var s = read();
      if (q === "__note") s.global = t;
      else if (t) s.answers[q] = t;
      else delete s.answers[q];
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
        if (saved) saved.textContent = "Saved " + new Date().toLocaleTimeString();
      } catch (e) {
        if (saved) saved.textContent = "Couldn't save in this browser. Copy your answers before closing.";
      }
    }
    boxes.forEach(function (b) {
      b.addEventListener("input", function () { show(b.dataset.q, b.value); tally(); store(b.dataset.q, b.value); });
    });
    document.addEventListener("click", function (e) {
      var l = e.target.closest && e.target.closest("[data-lean]");
      if (!l) return;
      var b = boxes.filter(function (x) { return x.dataset.q === l.getAttribute("data-lean"); })[0];
      if (!b) return;
      b.value = b.value.trim() ? b.value.replace(/\s*$/, "") + "\nAgree with the lean." : "Agree with the lean.";
      b.dispatchEvent(new Event("input", { bubbles: true }));
      b.focus();
    });

    if (EMBEDDED) {
      window.addEventListener("message", function (e) {
        var m = e.data;
        if (!m || !m.planDoc || m.type !== "answers") return;
        boxes.forEach(function (b) {
          var t = b.dataset.q === "__note" ? (m.note || "") : ((m.answers || {})[b.dataset.q] || "");
          if (b !== document.activeElement && b.value !== t) b.value = t;
        });
        tally();
      });
      post({ type: "docready" });
      return;
    }

    fill(read());
    window.addEventListener("storage", function (e) { if (e.key === KEY) fill(read()); });
    var copy = document.getElementById("planCopy"), out = document.getElementById("planExport");
    if (copy) copy.addEventListener("click", function () {
      var s = read(), x = { tool: id + "_board", seen: ch, next: ch + 1 };
      var note = (s.global || "").trim();
      if (note) x.note = note;
      var a = {};
      boxes.forEach(function (b) { if (b.dataset.q !== "__note" && b.value.trim()) a[b.dataset.q] = b.value.trim(); });
      if (Object.keys(a).length) x.answers = a;
      var cards = Object.keys(s.drafts || {}).map(function (c) {
        return { id: c, replies: s.drafts[c].map(function (d) { return d.t; }) };
      }).filter(function (c) { return c.replies.length; });
      if (cards.length) x.cards = cards;
      var label = copy.textContent;
      function flash(t) { copy.textContent = t; setTimeout(function () { copy.textContent = label; }, 1600); }
      if (!x.note && !x.answers && !x.cards) { flash("Nothing to copy yet"); return; }
      var text = JSON.stringify(x);
      function manual() {   // clipboard refused: show the text ready to select
        if (out) { out.hidden = false; out.value = text; out.focus(); out.select(); }
        flash("Select and copy below");
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { if (out) out.hidden = true; flash("Copied ✓"); }, manual);
      } else manual();
    });
  })();

  /* Mermaid: lazy CDN load, same version as the board engine. Offline, the
     source stays readable as a <pre>. Started after "load" so a slow CDN never
     holds up the page's load event (the board waits on it for #doc-<id> jumps). */
  var nodes = document.querySelectorAll("pre.mermaid");
  if (nodes.length) {
    if (document.readyState === "complete") loadMermaid();
    else window.addEventListener("load", loadMermaid);
  }
  function loadMermaid() {
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
    s.onload = function () {
      try {
        window.mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose",
          flowchart: { useMaxWidth: true, htmlLabels: true } });
        window.mermaid.run({ nodes: nodes });
      } catch (e) {}
    };
    document.head.appendChild(s);
  }
})();
