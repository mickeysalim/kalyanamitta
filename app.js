(function () {
  "use strict";

  var KEY = "kalyanamitta.plan.v1";
  var TEXT_FIELDS = ["topic", "why", "mainq", "opening", "points", "takeaway", "notes"];
  var PRE_ROWS = 2;
  var REQUIRED = ["topic", "mainq", "opening", "points", "takeaway"];

  // Section order and labels shared by the summary, the copied text and the AI output format.
  var SECTIONS = [
    { key: "topic", label: "Topic" },
    { key: "why", label: "Why this topic" },
    { key: "mainq", label: "Main question" },
    { key: "opening", label: "Opening questions", time: "15–20 min", list: true },
    { key: "points", label: "Main points", time: "40–45 min", list: true },
    { key: "takeaway", label: "Takeaway", time: "10 min" },
    { key: "pre", label: "Pre-reading for attendees", sources: true },
    { key: "reading", label: "Reading materials", sources: true },
    { key: "notes", label: "Personal notes" }
  ];

  // Headings the paste parser accepts, matched against the text before the colon.
  var HEADINGS = [
    ["topic", /^(session )?topic$/i],
    ["why", /^why (this |the )?topic\??$/i],
    ["mainq", /^main question( we'?ll explore)?$/i],
    ["opening", /^opening questions?$/i],
    ["points", /^main points?$/i],
    ["takeaway", /^takeaways?$/i],
    ["pre", /^pre-?reading( for attendees)?$/i],
    ["reading", /^reading materials?$/i],
    ["notes", /^(personal |facilitator )?notes$/i]
  ];

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  function emptyRow() { return { title: "", link: "" }; }
  function blank() {
    return {
      topic: "", why: "", mainq: "", opening: "", points: "", takeaway: "", notes: "",
      reading: [emptyRow(), emptyRow()],
      pre: [emptyRow(), emptyRow()],
      step: 0
    };
  }

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && typeof saved === "object") {
        var p = blank();
        TEXT_FIELDS.forEach(function (k) { if (typeof saved[k] === "string") p[k] = saved[k]; });
        if (Array.isArray(saved.reading) && saved.reading.length) p.reading = saved.reading.map(cleanRow);
        if (Array.isArray(saved.pre)) p.pre = padPre(saved.pre.map(cleanRow));
        if (saved.step >= 0 && saved.step <= 2) p.step = saved.step;
        return p;
      }
    } catch (e) { /* fall through to a blank plan */ }
    return blank();
  }
  function cleanRow(r) { return { title: String((r && r.title) || ""), link: String((r && r.link) || "") }; }
  function padPre(rows) {
    rows = rows.slice(0, PRE_ROWS);
    while (rows.length < PRE_ROWS) rows.push(emptyRow());
    return rows;
  }

  var plan = load();
  var saveTimer = null;

  function writeNow() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(KEY, JSON.stringify(plan));
      $("#saved").textContent = hasContent() ? "Saved on this device" : "";
    } catch (e) {
      $("#saved").textContent = "Not saved: your browser is blocking storage. Copy your summary before closing.";
    }
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeNow, 300);
  }
  window.addEventListener("pagehide", writeNow);

  function hasContent() {
    return TEXT_FIELDS.some(function (k) { return plan[k].trim(); }) ||
      plan.reading.concat(plan.pre).some(function (r) { return r.title.trim() || r.link.trim(); });
  }

  // ---------- Steps ----------
  function go(i) {
    i = Number(i);
    plan.step = i;
    $$(".screen").forEach(function (s, k) { s.classList.toggle("on", k === i); });
    $$("#track li:not(.fill)").forEach(function (li, k) {
      li.classList.toggle("done", k < i);
      li.classList.toggle("current", k === i);
      li.querySelector(".dot").setAttribute("aria-current", k === i ? "step" : "false");
    });
    $("#fill").style.width = "calc((100% - 28px) * " + i / 2 + ")";
    if (i === 2) renderSummary();
    $("#restart").hidden = true;
    save();
  }

  // ---------- Required fields ----------
  function missing() {
    return REQUIRED.filter(function (k) { return !plan[k].trim(); });
  }
  function markField(key, bad) {
    var input = $('[data-field="' + key + '"]');
    var field = input.closest(".field");
    field.classList.toggle("invalid", bad);
    input.setAttribute("aria-invalid", bad ? "true" : "false");
    var err = field.querySelector(".error");
    if (bad && !err) {
      err = el("p", "error", "Please fill this in.");
      err.id = input.id + "-error";
      input.setAttribute("aria-describedby", err.id);
      input.insertAdjacentElement("afterend", err);
    } else if (!bad && err) {
      err.remove();
      input.removeAttribute("aria-describedby");
    }
  }
  function showGapCount() {
    var n = missing().length;
    $("#topic-error").textContent = n
      ? "Please fill in the required boxes before moving on (" + n + " left)."
      : "";
  }
  // Returns true when the Topic page is complete; otherwise shows what is missing.
  function checkTopic() {
    var gaps = missing();
    REQUIRED.forEach(function (k) { markField(k, gaps.indexOf(k) >= 0); });
    showGapCount();
    if (gaps.length) {
      if (plan.step !== 0) go(0);
      var first = $('[data-field="' + gaps[0] + '"]');
      first.scrollIntoView({ block: "center", behavior: "smooth" });
      first.focus({ preventScroll: true });
    }
    return !gaps.length;
  }

  // ---------- Fields ----------
  function fillFields() {
    $$("[data-field]").forEach(function (el) { el.value = plan[el.dataset.field] || ""; });
    renderRows("reading");
    renderRows("pre");
  }

  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.field) {
      plan[el.dataset.field] = el.value;
      if (REQUIRED.indexOf(el.dataset.field) >= 0 && el.value.trim()) {
        markField(el.dataset.field, false);
        if ($("#topic-error").textContent) showGapCount();
      }
      save();
    } else if (el.dataset && el.dataset.kind) {
      plan[el.dataset.kind][Number(el.dataset.i)][el.dataset.part] = el.value;
      save();
    }
  });

  function renderRows(kind) {
    var box = $("#rows-" + kind);
    box.innerHTML = "";
    var fixed = kind === "pre";
    plan[kind].forEach(function (row, i) {
      var div = document.createElement("div");
      div.className = "row" + (fixed ? " fixed" : "");
      var examples = kind === "pre"
        ? ["e.g. Tirokudda Sutta (Khp 7)", "e.g. https://suttacentral.net/kp7"]
        : i === 0 ? ["e.g. Karaniya Mettā Sutta (Snp 1.8)", "e.g. https://suttacentral.net/snp1.8"]
        : i === 1 ? ["e.g. Ajahn Brahm’s talk on ghosts (YouTube)", "e.g. https://youtube.com/…"]
        : ["Title", "Link"];
      if (kind === "pre" && i > 0) examples = ["Title", "Link"];
      ["title", "link"].forEach(function (part, p) {
        var input = document.createElement("input");
        input.id = kind + "-" + i + "-" + part;
        input.value = row[part];
        input.placeholder = examples[p];
        input.setAttribute("aria-label", (kind === "pre" ? "Pre-reading " : "Source ") + (i + 1) + " " + part);
        if (part === "link") input.type = "url";
        input.dataset.kind = kind;
        input.dataset.i = i;
        input.dataset.part = part;
        div.appendChild(input);
      });
      if (!fixed) {
        var x = document.createElement("button");
        x.className = "x";
        x.type = "button";
        x.textContent = "×";
        x.setAttribute("aria-label", "Remove source " + (i + 1));
        x.addEventListener("click", function () {
          plan.reading.splice(i, 1);
          if (!plan.reading.length) plan.reading.push(emptyRow());
          renderRows("reading");
          save();
        });
        div.appendChild(x);
      }
      box.appendChild(div);
    });
  }

  $("#add-reading").addEventListener("click", function () {
    plan.reading.push(emptyRow());
    renderRows("reading");
    save();
    $("#reading-" + (plan.reading.length - 1) + "-title").focus();
  });

  // ---------- Summary ----------
  function lines(text) {
    return text.split("\n")
      .map(function (l) { return l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim(); })
      .filter(Boolean);
  }
  function filledRows(rows) {
    return rows.filter(function (r) { return r.title.trim() || r.link.trim(); });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u.trim()) ? u.trim() : ""; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderSummary() {
    var doc = $("#doc");
    doc.innerHTML = "";
    var head = el("div", "head");
    head.appendChild(el("span", "kicker", "Kalyanamitta · Session plan"));
    head.appendChild(el("h2", null, plan.topic.trim() || "Untitled session"));
    doc.appendChild(head);

    SECTIONS.slice(1).forEach(function (s) {
      var sec = el("section");
      var h = el("h3", null, s.label);
      if (s.time) { h.appendChild(document.createTextNode(" ")); h.appendChild(el("span", "time", s.time)); }
      sec.appendChild(h);
      var body;
      if (s.sources) {
        var rows = filledRows(plan[s.key]);
        if (rows.length) {
          body = el("ul");
          rows.forEach(function (r) {
            var li = el("li", null, r.title.trim() || r.link.trim());
            var url = safeUrl(r.link);
            if (url && r.title.trim()) {
              li.appendChild(document.createTextNode(" · "));
              var a = el("a", null, url.replace(/^https?:\/\/(www\.)?/, ""));
              a.href = url; a.target = "_blank"; a.rel = "noopener";
              li.appendChild(a);
            }
            body.appendChild(li);
          });
        }
      } else if (s.list) {
        var items = lines(plan[s.key]);
        if (items.length) {
          body = el("ul");
          items.forEach(function (t) { body.appendChild(el("li", null, t)); });
        }
      } else if (plan[s.key].trim()) {
        body = el("p", null, plan[s.key].trim());
      }
      sec.appendChild(body || el("p", "empty", "Not filled in yet"));
      doc.appendChild(sec);
    });
    doc.appendChild(el("p", "closing", "You don’t need to be an expert. Let’s learn together."));
  }

  function summaryText() {
    var out = ["KALYANAMITTA · SESSION PLAN", ""];
    SECTIONS.forEach(function (s) {
      var label = s.label + (s.time ? " (" + s.time + ")" : "") + ":";
      if (s.sources) {
        out.push(label);
        var rows = filledRows(plan[s.key]);
        rows.forEach(function (r) {
          out.push("- " + [r.title.trim(), r.link.trim()].filter(Boolean).join(" – "));
        });
        if (!rows.length) out.push("-");
      } else if (s.list) {
        out.push(label);
        var items = lines(plan[s.key]);
        items.forEach(function (t) { out.push("- " + t); });
        if (!items.length) out.push("-");
      } else {
        var v = plan[s.key].trim();
        if (v.indexOf("\n") >= 0) { out.push(label); out.push(v); }
        else out.push(label + " " + v);
      }
      out.push("");
    });
    out.push("You don’t need to be an expert. Let’s learn together.");
    return out.join("\n").trim() + "\n";
  }

  function copyText(text, button, label, fallbackNode) {
    function done(msg) {
      button.textContent = msg;
      setTimeout(function () { button.textContent = label; }, 2000);
    }
    function fallback() {
      if (fallbackNode) {
        var r = document.createRange();
        r.selectNodeContents(fallbackNode);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        done("Selected. Press Ctrl+C");
      } else {
        done("Couldn’t copy. Try Download");
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done("Copied"); }, fallback);
    } else {
      fallback();
    }
  }

  $("#copy-summary").addEventListener("click", function (e) {
    copyText(summaryText(), e.currentTarget, "Copy summary", $("#doc"));
  });

  $("#download").addEventListener("click", function () {
    var name = (plan.topic.trim() || "session-plan")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "session-plan";
    var blob = new Blob([summaryText()], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kalyanamitta-" + name + ".txt";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });

  // ---------- AI prompts ----------
  var OUTPUT_FORMAT = [
    "Topic:",
    "Why this topic:",
    "Main question:",
    "Opening questions (15–20 min):",
    "- ",
    "Main points (40–45 min):",
    "- ",
    "Takeaway (10 min):",
    "Pre-reading for attendees:",
    "- Title – link",
    "Reading materials:",
    "- Title – link",
    "Personal notes:"
  ].join("\n");

  var PLAN_PROMPT = [
    "Help me plan a Dhamma discussion for Kalyanamitta, a Buddhist cell group. I'm the facilitator. I don't need to be an expert; we learn together.",
    "",
    "My topic idea: [write your topic or question here, or leave blank and ask for ideas]",
    "",
    "SESSION FLOW",
    "1. Opening questions (15–20 min): questions for people to share, so different views come out.",
    "2. Main points (40–45 min): 2–4 teachings, suttas, or stories to explore.",
    "3. Takeaway (10 min): something to reflect on or practise after the session.",
    "",
    "TASKS",
    "(Ideally, do each step one at a time. Wait for my reply before moving to the next.)",
    "1. Help me settle the topic and why it is worth exploring.",
    "2. Suggest the main question we'll explore.",
    "3. Suggest 2–3 opening questions.",
    "4. Suggest 2–4 main points. For each, give the sutta reference with a SuttaCentral link, a short summary of what the text says, and whether it comes from the sutta itself or from commentary.",
    "5. Suggest a takeaway.",
    "6. Suggest reading materials (suttas, talks by Ajahn Brahm or Dhammadesana) and 1–2 short pre-reading sources for attendees.",
    "7. Write personal notes for me: context, and possible answers to difficult questions.",
    "",
    "Prefer Theravāda sources. If you are unsure of a reference, say so. Never invent one.",
    "",
    "OUTPUT FORMAT",
    "When we're done, put the final plan in exactly this format:",
    "",
    OUTPUT_FORMAT
  ].join("\n");

  function answer(key, fallback) {
    var v = plan[key].trim();
    return v || "[" + fallback + "]";
  }
  function answerList(key, fallback) {
    var items = lines(plan[key]);
    return items.length ? items.map(function (t) { return "- " + t; }).join("\n") : "[" + fallback + "]";
  }

  function researchPrompt() {
    return [
      "Help me research a Dhamma discussion for Kalyanamitta, a Buddhist cell group. I'm the facilitator. I don't need to be an expert; we learn together.",
      "",
      "MY PLAN",
      "Topic: " + answer("topic", "write your topic here"),
      "Why this topic: " + answer("why", "why you chose it"),
      "Main question: " + answer("mainq", "the main question"),
      "Opening questions (15–20 min):",
      answerList("opening", "your opening questions"),
      "Main points (40–45 min):",
      answerList("points", "2–4 main points"),
      "Takeaway (10 min): " + answer("takeaway", "your takeaway"),
      "",
      "TASKS",
      "(Ideally, do each step one at a time. Wait for my reply before moving to the next.)",
      "1. For each main point, find the most relevant suttas, with SuttaCentral links. Summarise what each text actually says, its context, and whether it comes from the sutta itself or from commentary or tradition.",
      "2. Suggest Dhamma talks on the topic from trusted teachers such as Ajahn Brahm or Dhammadesana, with links.",
      "3. Suggest 1–2 short pre-reading sources for attendees.",
      "4. Write personal notes for me: key context, possible answers to difficult questions, and anything I should be careful about.",
      "",
      "Prefer Theravāda sources. If you are unsure of a reference or link, say so. Never invent one.",
      "",
      "OUTPUT FORMAT",
      "When we're done, put the final research in exactly this format:",
      "",
      "Reading materials:",
      "- Title – link",
      "Pre-reading for attendees:",
      "- Title – link",
      "Personal notes:"
    ].join("\n");
  }

  // ---------- Paste parser ----------
  function parseAnswer(text) {
    var out = {};
    var cur = null;
    text.replace(/\r/g, "").split("\n").forEach(function (raw) {
      var line = raw.replace(/\*\*|__/g, "").replace(/^\s*#+\s*/, "").trim();
      var m = line.match(/^([A-Za-z][A-Za-z' ?-]{1,40}?)\s*(\([^)]*\))?\s*:\s*(.*)$/);
      if (m) {
        var name = m[1].trim();
        for (var i = 0; i < HEADINGS.length; i++) {
          if (HEADINGS[i][1].test(name)) {
            cur = HEADINGS[i][0];
            out[cur] = m[3] ? [m[3]] : [];
            return;
          }
        }
      }
      if (cur) out[cur].push(raw.replace(/\s+$/, ""));
    });
    Object.keys(out).forEach(function (k) {
      out[k] = out[k].join("\n").replace(/^\s*\n|\n\s*$/g, "").replace(/^\n+|\n+$/g, "");
    });
    return out;
  }

  function parseSources(text) {
    return lines(text).map(function (l) {
      var md = l.match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/);
      if (md) {
        var rest = l.replace(md[0], "").replace(/^[\s–—:|-]+|[\s–—:|-]+$/g, "");
        return { title: (md[1] + (rest ? " " + rest : "")).trim(), link: md[2] };
      }
      var url = l.match(/<?(https?:\/\/[^\s>)]+)>?/);
      if (url) {
        var title = l.replace(url[0], "").replace(/[\s–—:|(-]+$/, "").replace(/^[\s–—:|-]+/, "").trim();
        return { title: title, link: url[1] };
      }
      return { title: l, link: "" };
    }).filter(function (r) { return r.title || r.link; })
      .filter(function (r) { return !/^title$/i.test(r.title) || r.link; });
  }

  var LABELS = {};
  SECTIONS.forEach(function (s) { LABELS[s.key] = s.label; });

  function applyAnswer(parsed, allowed) {
    var filled = [];
    allowed.forEach(function (k) {
      if (!(k in parsed)) return;
      var v = parsed[k];
      if (k === "reading" || k === "pre") {
        var rows = parseSources(v);
        if (!rows.length) return;
        plan[k] = k === "pre" ? padPre(rows) : rows;
      } else {
        if (!v.trim()) return;
        plan[k] = v.trim();
      }
      filled.push(LABELS[k]);
    });
    return filled;
  }

  // ---------- Sheet ----------
  var sheetMode = null;
  var lastFocus = null;

  var MODES = {
    "prompt-plan": {
      title: "Plan with AI",
      hint: "Copy this into ChatGPT, Claude, or Gemini. Fill in the [bracket] first. When it gives you the final plan, come back and use Paste AI plan.",
      prompt: function () { return PLAN_PROMPT; },
      action: "Copy prompt"
    },
    "prompt-research": {
      title: "Research with AI",
      hint: "This prompt includes your answers from the Topic page. Anything in [brackets] is still empty. When the AI is done, come back and use Paste AI research.",
      prompt: researchPrompt,
      action: "Copy prompt"
    },
    "paste-plan": {
      title: "Paste AI plan",
      hint: "Paste the AI’s final plan below. Any section it includes will replace what’s in that box.",
      keys: SECTIONS.map(function (s) { return s.key; }),
      action: "Fill in my plan"
    },
    "paste-research": {
      title: "Paste AI research",
      hint: "Paste the AI’s final research below. It fills in Reading materials, Pre-reading, and Personal notes.",
      keys: ["reading", "pre", "notes"],
      action: "Fill in my reading"
    }
  };

  function openSheet(mode) {
    var m = MODES[mode];
    sheetMode = mode;
    lastFocus = document.activeElement;
    $("#sheet-title").textContent = m.title;
    $("#sheet-hint").textContent = m.hint;
    $("#sheet-action").textContent = m.action;
    $("#sheet-msg").textContent = "";
    $("#sheet-msg").className = "msg";
    var isPrompt = !!m.prompt;
    $("#sheet-prompt").hidden = !isPrompt;
    $("#sheet-paste").hidden = isPrompt;
    if (isPrompt) $("#sheet-prompt").textContent = m.prompt();
    else $("#sheet-paste").value = "";
    $("#sheet").classList.add("open");
    $("#scrim").classList.add("on");
    (isPrompt ? $("#sheet-action") : $("#sheet-paste")).focus();
  }

  function closeSheet() {
    $("#sheet").classList.remove("open");
    $("#scrim").classList.remove("on");
    sheetMode = null;
    if (lastFocus) lastFocus.focus();
  }

  $("#sheet-close").addEventListener("click", closeSheet);
  $("#scrim").addEventListener("click", closeSheet);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheetMode) closeSheet(); });

  $("#sheet-action").addEventListener("click", function (e) {
    var m = MODES[sheetMode];
    if (m.prompt) {
      copyText($("#sheet-prompt").textContent, e.currentTarget, m.action, $("#sheet-prompt"));
      return;
    }
    var msg = $("#sheet-msg");
    var text = $("#sheet-paste").value;
    if (!text.trim()) {
      msg.textContent = "Paste the AI’s answer into the box first.";
      msg.className = "msg err";
      return;
    }
    var filled = applyAnswer(parseAnswer(text), m.keys);
    if (!filled.length) {
      msg.textContent = "No sections found. Make sure the answer uses the headings from the output format, like “Topic:” and “Reading materials:”.";
      msg.className = "msg err";
      return;
    }
    fillFields();
    REQUIRED.forEach(function (k) { if (plan[k].trim()) markField(k, false); });
    if ($("#topic-error").textContent) showGapCount();
    save();
    msg.textContent = "Filled in: " + filled.join(", ") + ".";
    msg.className = "msg ok";
  });

  // ---------- Clicks ----------
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-go],[data-prompt],[data-paste],[data-restart]");
    if (!t) return;
    if (t.dataset.go != null) {
      if (Number(t.dataset.go) > 0 && !checkTopic()) return;
      go(t.dataset.go);
      window.scrollTo({ top: 0 });
    }
    else if (t.dataset.prompt) openSheet("prompt-" + t.dataset.prompt);
    else if (t.dataset.paste) openSheet("paste-" + t.dataset.paste);
    else if (t.hasAttribute("data-restart")) {
      var box = $("#restart");
      box.hidden = false;
      box.scrollIntoView({ block: "center", behavior: "smooth" });
      $("#restart-no").focus();
    }
  });

  $("#restart-no").addEventListener("click", function () { $("#restart").hidden = true; });
  $("#restart-yes").addEventListener("click", function () {
    plan = blank();
    REQUIRED.forEach(function (k) { markField(k, false); });
    $("#topic-error").textContent = "";
    $$("details").forEach(function (d) { d.open = false; });
    fillFields();
    go(0);
    window.scrollTo({ top: 0 });
  });

  // Exposed for tests.
  window.Kalyanamitta = { parseAnswer: parseAnswer, parseSources: parseSources, summaryText: summaryText };

  fillFields();
  go(missing().length ? 0 : plan.step);
})();
