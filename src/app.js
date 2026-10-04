/* Ranoka UI: one question per screen, explained result, local history, FHIR export. */
(function () {
  "use strict";
  const Core = window.RanokaCore;
  const I18n = window.RanokaI18n;
  const STORE_KEY = "ranoka.checks.v1";
  const LANG_KEY = "ranoka.lang";

  const state = {
    lang: safeGet(LANG_KEY) || pickLang(),
    view: "check",
    step: 0, // 0 = site, 1..N = questions, N+1 = result
    answers: {},
    meta: {},
    savedId: null,
  };
  let t = I18n.translator(state.lang);

  function pickLang() {
    const l = (navigator.language || "en").slice(0, 2);
    return I18n.LANGS.includes(l) ? l : "en";
  }
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function loadChecks() {
    try { return JSON.parse(safeGet(STORE_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveChecks(list) { safeSet(STORE_KEY, JSON.stringify(list)); }

  const $ = (sel) => document.querySelector(sel);
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    }
    return el;
  }

  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/fhir+json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function renderChrome() {
    document.documentElement.lang = state.lang === "mg" ? "mg" : state.lang;
    $("#tagline").textContent = t("app.tagline");
    const nav = $("#nav");
    nav.replaceChildren(
      ...["check", "history", "about"].map((v) =>
        h("button", {
          class: "tab" + (state.view === v ? " active" : ""),
          "aria-current": state.view === v ? "page" : false,
          onclick: () => { state.view = v; render(); },
        }, t("nav." + v))
      )
    );
    const langs = $("#langs");
    langs.replaceChildren(
      ...I18n.LANGS.map((l) =>
        h("button", {
          class: "lang" + (state.lang === l ? " active" : ""),
          "aria-pressed": state.lang === l ? "true" : "false",
          onclick: () => { state.lang = l; safeSet(LANG_KEY, l); t = I18n.translator(l); render(); },
        }, l.toUpperCase())
      )
    );
  }

  function render() {
    renderChrome();
    const main = $("#main");
    if (state.view === "history") main.replaceChildren(renderHistory());
    else if (state.view === "about") main.replaceChildren(renderAbout());
    else main.replaceChildren(renderCheck());
    main.focus({ preventScroll: true });
  }

  function progress() {
    const total = Core.QUESTIONS.length + 1;
    const pct = Math.round((Math.min(state.step, total) / total) * 100);
    return h("div", { class: "progress", role: "progressbar", "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100 },
      h("div", { class: "bar", style: "width:" + pct + "%" }));
  }

  function renderCheck() {
    const n = Core.QUESTIONS.length;
    if (state.step === 0) return renderSite();
    if (state.step <= n) return renderQuestion(Core.QUESTIONS[state.step - 1]);
    return renderResult();
  }

  function renderSite() {
    const m = state.meta;
    const status = h("p", { class: "muted", id: "locstatus" },
      typeof m.latitude === "number" ? t("site.located") + " (" + m.latitude.toFixed(5) + ", " + m.longitude.toFixed(5) + ")" : "");
    const latIn = h("input", { type: "number", step: "any", id: "lat", value: m.latitude ?? "", inputmode: "decimal" });
    const lonIn = h("input", { type: "number", step: "any", id: "lon", value: m.longitude ?? "", inputmode: "decimal" });
    const nameIn = h("input", { type: "text", id: "site", value: m.siteName || "", autocomplete: "off" });
    const obsIn = h("input", { type: "text", id: "observer", value: m.observer || "", autocomplete: "nickname" });
    return h("section", { class: "card" },
      progress(),
      h("h2", {}, t("site.title")),
      h("label", { for: "site" }, t("site.name")), nameIn,
      h("label", { for: "observer" }, t("site.observer")), obsIn,
      h("button", { class: "secondary", onclick: () => {
        if (!navigator.geolocation) { status.textContent = t("site.locError"); return; }
        navigator.geolocation.getCurrentPosition((p) => {
          m.latitude = +p.coords.latitude.toFixed(6);
          m.longitude = +p.coords.longitude.toFixed(6);
          m.accuracy = Math.round(p.coords.accuracy);
          latIn.value = m.latitude; lonIn.value = m.longitude;
          status.textContent = t("site.located") + " (±" + m.accuracy + " m)";
        }, () => { status.textContent = t("site.locError"); }, { enableHighAccuracy: true, timeout: 10000 });
      } }, "📍 " + t("site.locate")),
      status,
      h("div", { class: "row" },
        h("div", {}, h("label", { for: "lat" }, t("site.lat")), latIn),
        h("div", {}, h("label", { for: "lon" }, t("site.lon")), lonIn)),
      h("div", { class: "actions" },
        h("span"),
        h("button", { class: "primary", onclick: () => {
          m.siteName = nameIn.value.trim();
          m.observer = obsIn.value.trim();
          const la = parseFloat(latIn.value), lo = parseFloat(lonIn.value);
          if (!Number.isNaN(la) && !Number.isNaN(lo)) { m.latitude = la; m.longitude = lo; }
          else { delete m.latitude; delete m.longitude; }
          state.step = 1; render();
        } }, t("form.next") + " →"))
    );
  }

  function renderQuestion(q) {
    const back = h("button", { class: "secondary", onclick: () => { state.step--; render(); } }, "← " + t("form.back"));
    const isLast = state.step === Core.QUESTIONS.length;
    const nextLabel = isLast ? t("form.submit") : t("form.next") + " →";
    if (q.type === "choice") {
      const choices = h("div", { class: "choices", role: "radiogroup", "aria-label": t("q." + q.id) },
        q.options.map((o) => h("button", {
          class: "choice" + (state.answers[q.id] === o.code ? " selected" : ""),
          role: "radio",
          "aria-checked": state.answers[q.id] === o.code ? "true" : "false",
          onclick: () => { state.answers[q.id] = o.code; state.step++; render(); },
        }, t("a." + q.id + "." + o.code))));
      return h("section", { class: "card" }, progress(),
        h("p", { class: "muted" }, state.step + " / " + Core.QUESTIONS.length),
        h("h2", {}, t("q." + q.id)), choices,
        h("div", { class: "actions" }, back, state.answers[q.id]
          ? h("button", { class: "primary", onclick: () => { state.step++; render(); } }, nextLabel) : h("span")));
    }
    const input = h("input", { type: "number", step: "0.1", id: "num", inputmode: "decimal", value: state.answers[q.id] ?? "" });
    return h("section", { class: "card" }, progress(),
      h("p", { class: "muted" }, state.step + " / " + Core.QUESTIONS.length + " · " + t("form.optional")),
      h("h2", {}, h("label", { for: "num" }, t("q." + q.id))), input,
      h("div", { class: "actions" }, back,
        h("button", { class: "primary", onclick: () => {
          const v = input.value.trim();
          if (v === "") delete state.answers[q.id]; else state.answers[q.id] = parseFloat(v);
          if (isLast) state.meta.authored = new Date().toISOString();
          state.step++; render();
        } }, nextLabel)));
  }

  function gauge(index, level) {
    const r = 52, c = 2 * Math.PI * r;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("class", "gauge lvl-" + level);
    svg.setAttribute("aria-hidden", "true");
    const mk = (tag, a) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
    svg.appendChild(mk("circle", { cx: 60, cy: 60, r, class: "track" }));
    svg.appendChild(mk("circle", { cx: 60, cy: 60, r, class: "value", "stroke-dasharray": c, "stroke-dashoffset": c * (1 - index / 100), transform: "rotate(-90 60 60)" }));
    const txt = mk("text", { x: 60, y: 68, "text-anchor": "middle", class: "num" });
    txt.textContent = index;
    svg.appendChild(txt);
    return svg;
  }

  function factorLabel(f) {
    const q = Core.QUESTIONS.find((x) => x.id === f.question);
    const ans = q.type === "choice" ? t("a." + f.question + "." + f.answer) : String(f.answer);
    return t("q." + f.question) + " → " + ans;
  }

  function renderResult() {
    if (!state.meta.authored) state.meta.authored = new Date().toISOString();
    const r = Core.score(state.answers);
    const q = Core.quality(state.answers, state.meta);
    const record = { id: state.savedId, answers: state.answers, meta: state.meta };
    const savedMsg = h("p", { class: "muted", role: "status" }, state.savedId ? t("result.saved") : "");
    return h("section", { class: "card result" },
      h("h2", {}, t("result.title") + (state.meta.siteName ? " — " + state.meta.siteName : "")),
      h("div", { class: "score" }, gauge(r.index, r.level),
        h("div", {}, h("div", { class: "badge lvl-" + r.level }, t("level." + r.level)),
          h("p", { class: "muted" }, new Date(state.meta.authored).toLocaleString(state.lang)))),
      r.critical.length ? h("div", { class: "alert" },
        h("strong", {}, "⚠ " + t("result.criticalTitle")),
        h("ul", {}, r.critical.map((c) => h("li", {}, factorLabel(c))))) : null,
      h("h3", {}, t("result.why")),
      r.factors.length
        ? h("ul", { class: "factors" }, r.factors.map((f) =>
            h("li", {}, h("span", {}, factorLabel(f)), h("span", { class: "pen" }, "−" + Math.round((100 * f.penalty) / r.maxPenalty)))))
        : h("p", {}, t("result.noFactors")),
      h("h3", {}, t("result.advice")),
      h("ul", { class: "advice" }, r.advice.map((a) => h("li", { class: "adv-" + a.split(".")[0] }, t("advice." + a)))),
      h("h3", {}, t("result.quality")),
      h("p", {}, t("result.confidence") + ": ", h("strong", { class: "conf-" + q.confidence }, t("conf." + q.confidence))),
      q.issues.length ? h("ul", { class: "issues" }, q.issues.map((i) => h("li", { class: i.severity }, t("issue." + i.code)))) : null,
      h("div", { class: "actions wrap" },
        h("button", { class: "primary", disabled: !!state.savedId, onclick: (e) => {
          const list = loadChecks();
          const id = Date.now().toString(36);
          list.unshift({ id, answers: { ...state.answers }, meta: { ...state.meta } });
          saveChecks(list);
          state.savedId = id;
          e.target.disabled = true;
          savedMsg.textContent = t("result.saved");
        } }, t("result.save")),
        h("button", { class: "secondary", onclick: () => {
          download("ranoka-check-" + state.meta.authored.slice(0, 10) + ".json", Core.fhirBundle(record, t));
        } }, "⬇ " + t("result.fhir")),
        h("button", { class: "secondary", onclick: resetCheck }, t("result.new"))),
      savedMsg);
  }

  function resetCheck() {
    const keep = { siteName: state.meta.siteName, observer: state.meta.observer, latitude: state.meta.latitude, longitude: state.meta.longitude, accuracy: state.meta.accuracy };
    state.answers = {}; state.meta = keep; state.step = 0; state.savedId = null; state.view = "check";
    render();
  }

  function renderHistory() {
    const list = loadChecks();
    if (!list.length) return h("section", { class: "card" }, h("p", {}, t("history.empty")));
    const bySite = {};
    for (const c of list) (bySite[c.meta.siteName || "—"] ||= []).push(c);
    return h("section", { class: "card" },
      h("h2", {}, t("nav.history")),
      Object.entries(bySite).map(([site, checks]) => {
        const scores = checks.map((c) => Core.score(c.answers)).reverse();
        return h("div", { class: "site" },
          h("h3", {}, site),
          sparkline(scores.map((s) => s.index)),
          h("ul", { class: "hist" }, checks.map((c) => {
            const s = Core.score(c.answers);
            return h("li", {},
              h("span", { class: "badge small lvl-" + s.level }, s.index),
              h("span", {}, new Date(c.meta.authored).toLocaleString(state.lang)),
              h("span", { class: "muted" }, t("level." + s.level)));
          })));
      }),
      h("div", { class: "actions wrap" },
        h("button", { class: "primary", onclick: () => {
          const bundles = list.map((c) => Core.fhirBundle(c, t));
          download("ranoka-all-checks.json", { resourceType: "Bundle", type: "batch",
            entry: bundles.map((b) => ({ resource: b, request: { method: "POST", url: "/" } })) });
        } }, "⬇ " + t("history.export")),
        h("button", { class: "danger", onclick: () => {
          if (confirm(t("history.confirmClear"))) { saveChecks([]); render(); }
        } }, t("history.clear"))));
  }

  function sparkline(values) {
    if (values.length < 2) return null;
    const w = 240, hgt = 48;
    const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 8) + 4, hgt - 4 - (v / 100) * (hgt - 8)]);
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + w + " " + hgt);
    svg.setAttribute("class", "spark");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", values.join(", "));
    const p = document.createElementNS(ns, "polyline");
    p.setAttribute("points", pts.map((x) => x.join(",")).join(" "));
    svg.appendChild(p);
    return svg;
  }

  function renderAbout() {
    return h("section", { class: "card" },
      h("h2", {}, "Ranoka"),
      h("p", {}, t("about.text")),
      h("h3", {}, "HL7 FHIR R4"),
      h("p", { class: "muted" }, "Questionnaire · QuestionnaireResponse · Location · Observation (survey) · transaction Bundle"),
      h("button", { class: "secondary", onclick: () => download("ranoka-questionnaire.json", Core.fhirQuestionnaire(t)) },
        "⬇ Questionnaire (FHIR)"));
  }

  window.addEventListener("DOMContentLoaded", render);
})();
