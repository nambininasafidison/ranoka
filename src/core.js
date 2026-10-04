/*
 * Ranoka core: questionnaire definition, explainable stream-health scoring,
 * data-quality checks and HL7 FHIR R4 export.
 * Works in the browser (window.RanokaCore) and in Node (module.exports).
 */
(function (root) {
  "use strict";

  const CANONICAL = "https://nambininasafidison.github.io/ranoka/fhir";
  const QUESTIONNAIRE_URL = CANONICAL + "/Questionnaire/ranoka-stream-check";
  const INDICATOR_SYSTEM = CANONICAL + "/CodeSystem/stream-indicator";
  const ANSWER_SYSTEM = CANONICAL + "/CodeSystem/stream-answer";
  const UCUM = "http://unitsofmeasure.org";

  // Each choice carries a penalty. "critical" choices trigger an immediate
  // One Health warning whatever the overall score is.
  const QUESTIONS = [
    { id: "colour", type: "choice", options: [
      { code: "clear", penalty: 0 },
      { code: "cloudy", penalty: 1 },
      { code: "brown", penalty: 2 },
      { code: "green", penalty: 2 },
      { code: "unusual", penalty: 3 },
    ] },
    { id: "smell", type: "choice", options: [
      { code: "none", penalty: 0 },
      { code: "earthy", penalty: 0 },
      { code: "sewage", penalty: 3, critical: true },
      { code: "chemical", penalty: 3, critical: true },
    ] },
    { id: "foam", type: "choice", options: [
      { code: "none", penalty: 0 },
      { code: "little", penalty: 1 },
      { code: "lots", penalty: 2 },
    ] },
    { id: "oil", type: "choice", options: [
      { code: "no", penalty: 0 },
      { code: "yes", penalty: 3, critical: true },
    ] },
    { id: "litter", type: "choice", options: [
      { code: "none", penalty: 0 },
      { code: "some", penalty: 1 },
      { code: "lots", penalty: 2 },
    ] },
    { id: "deadAnimals", type: "choice", options: [
      { code: "no", penalty: 0 },
      { code: "yes", penalty: 4, critical: true },
    ] },
    { id: "algae", type: "choice", options: [
      { code: "none", penalty: 0 },
      { code: "some", penalty: 1 },
      { code: "mat", penalty: 3, critical: true },
    ] },
    { id: "banks", type: "choice", options: [
      { code: "natural", penalty: 0 },
      { code: "partial", penalty: 1 },
      { code: "bare", penalty: 2 },
    ] },
    { id: "flow", type: "choice", options: [
      { code: "flowing", penalty: 0 },
      { code: "slow", penalty: 1 },
      { code: "stagnant", penalty: 2 },
      { code: "dry", penalty: 2 },
    ] },
    { id: "invasive", type: "choice", options: [
      { code: "no", penalty: 0 },
      { code: "unsure", penalty: 0 },
      { code: "yes", penalty: 1 },
    ] },
    { id: "temperature", type: "decimal", optional: true, unit: "Cel", min: 0, max: 40 },
    { id: "ph", type: "decimal", optional: true, unit: "[pH]", min: 3, max: 11 },
  ];

  const MAX_PENALTY = QUESTIONS.reduce((sum, q) => {
    if (q.type === "choice") return sum + Math.max(...q.options.map((o) => o.penalty));
    return sum + 2; // numeric indicators contribute at most 2
  }, 0);

  function question(id) {
    return QUESTIONS.find((q) => q.id === id);
  }

  function numericPenalty(id, value) {
    if (value === null || value === undefined || Number.isNaN(value)) return 0;
    if (id === "temperature") {
      if (value > 30) return 2;
      if (value > 25) return 1;
      return 0;
    }
    if (id === "ph") {
      if (value < 6 || value > 9) return 2;
      if (value < 6.5 || value > 8.5) return 1;
      return 0;
    }
    return 0;
  }

  /**
   * Score an observation. Returns { index, level, factors, critical, advice }.
   * index: 0 (very poor) .. 100 (good). factors explain every point lost.
   */
  function score(answers) {
    const factors = [];
    const critical = [];
    let penalty = 0;
    for (const q of QUESTIONS) {
      const value = answers[q.id];
      if (value === undefined || value === null || value === "") continue;
      if (q.type === "choice") {
        const opt = q.options.find((o) => o.code === value);
        if (!opt) continue;
        if (opt.penalty > 0) factors.push({ question: q.id, answer: value, penalty: opt.penalty });
        if (opt.critical) critical.push({ question: q.id, answer: value });
        penalty += opt.penalty;
      } else {
        const p = numericPenalty(q.id, Number(value));
        if (p > 0) factors.push({ question: q.id, answer: Number(value), penalty: p });
        penalty += p;
      }
    }
    const index = Math.max(0, Math.round(100 - (100 * penalty) / MAX_PENALTY));
    let level;
    if (critical.length > 0 || index < 40) level = "alert";
    else if (index < 60) level = "poor";
    else if (index < 80) level = "moderate";
    else level = "good";
    factors.sort((a, b) => b.penalty - a.penalty);
    return { index, level, penalty, maxPenalty: MAX_PENALTY, factors, critical, advice: advice(level, answers) };
  }

  /** One Health advice keys: people, animals, environment. */
  function advice(level, answers) {
    const out = [];
    if (level === "alert") {
      out.push("people.avoid", "animals.keepAway", "env.report");
    } else if (level === "poor") {
      out.push("people.washHands", "animals.noDrink", "env.report");
    } else if (level === "moderate") {
      out.push("people.washHands", "env.monitor");
    } else {
      out.push("people.ok", "env.monitor");
    }
    if (answers.algae === "mat") out.push("animals.algaeToxic");
    if (answers.litter === "lots") out.push("env.cleanup");
    if (answers.invasive === "yes") out.push("env.invasive");
    return Array.from(new Set(out));
  }

  /**
   * Data-quality checks before data reaches scientists.
   * Returns { confidence: "high"|"medium"|"low", issues: [{code, severity}] }.
   */
  function quality(answers, meta) {
    const issues = [];
    meta = meta || {};
    for (const q of QUESTIONS) {
      if (q.optional) continue;
      if (!answers[q.id]) issues.push({ code: "missing." + q.id, severity: "error" });
    }
    for (const id of ["temperature", "ph"]) {
      const v = answers[id];
      if (v === undefined || v === null || v === "") continue;
      const q = question(id);
      const n = Number(v);
      if (Number.isNaN(n) || n < q.min || n > q.max) issues.push({ code: "range." + id, severity: "error" });
    }
    if (answers.flow === "dry") {
      for (const id of ["foam", "oil", "algae"]) {
        const v = answers[id];
        if (v && v !== "none" && v !== "no") issues.push({ code: "inconsistent.dryWater", severity: "warning" });
      }
    }
    if (answers.colour === "clear" && answers.algae === "mat") {
      issues.push({ code: "inconsistent.clearAlgae", severity: "warning" });
    }
    if (!meta.latitude && meta.latitude !== 0) issues.push({ code: "missing.location", severity: "warning" });
    if (meta.accuracy && meta.accuracy > 200) issues.push({ code: "location.imprecise", severity: "warning" });
    if (meta.authored && new Date(meta.authored).getTime() > Date.now() + 5 * 60 * 1000) {
      issues.push({ code: "time.future", severity: "error" });
    }
    const unique = [];
    const seen = new Set();
    for (const i of issues) {
      if (!seen.has(i.code)) { seen.add(i.code); unique.push(i); }
    }
    const errors = unique.filter((i) => i.severity === "error").length;
    const warnings = unique.length - errors;
    const confidence = errors > 0 ? "low" : warnings > 1 ? "medium" : warnings === 1 ? "medium" : "high";
    return { confidence, issues: unique };
  }

  function uuid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    // RFC 4122 v4 fallback
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /** FHIR R4 Questionnaire resource generated from QUESTIONS. */
  function fhirQuestionnaire(t) {
    t = t || ((k) => k);
    return {
      resourceType: "Questionnaire",
      id: "ranoka-stream-check",
      url: QUESTIONNAIRE_URL,
      version: "1.0.0",
      name: "RanokaStreamCheck",
      title: "Ranoka citizen stream check",
      status: "active",
      subjectType: ["Location"],
      item: QUESTIONS.map((q) => {
        const item = {
          linkId: q.id,
          code: [{ system: INDICATOR_SYSTEM, code: q.id }],
          text: t("q." + q.id),
          type: q.type === "choice" ? "choice" : "decimal",
          required: !q.optional,
        };
        if (q.type === "choice") {
          item.answerOption = q.options.map((o) => ({
            valueCoding: { system: ANSWER_SYSTEM, code: q.id + "." + o.code, display: t("a." + q.id + "." + o.code) },
          }));
        }
        return item;
      }),
    };
  }

  /**
   * Build a FHIR R4 transaction Bundle for one stream check:
   * Location + QuestionnaireResponse + one Observation per indicator
   * + a summary Observation (stream health index) derived from them.
   */
  function fhirBundle(record, t) {
    t = t || ((k) => k);
    const { answers, meta } = record;
    const result = score(answers);
    const q = quality(answers, meta);
    const authored = meta.authored || new Date().toISOString();
    const locId = uuid();
    const qrId = uuid();
    const entries = [];
    const ref = (id) => ({ reference: "urn:uuid:" + id });

    const location = {
      resourceType: "Location",
      status: "active",
      name: meta.siteName || "Stream site",
      mode: "instance",
      physicalType: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/location-physical-type", code: "area", display: "Area" }],
      },
    };
    if (typeof meta.latitude === "number" && typeof meta.longitude === "number") {
      location.position = { latitude: meta.latitude, longitude: meta.longitude };
    }
    entries.push({ id: locId, resource: location });

    const qr = {
      resourceType: "QuestionnaireResponse",
      questionnaire: QUESTIONNAIRE_URL,
      status: "completed",
      subject: ref(locId),
      authored,
      item: [],
    };
    if (meta.observer) qr.author = { display: meta.observer };
    const obsIds = [];
    for (const def of QUESTIONS) {
      const v = answers[def.id];
      if (v === undefined || v === null || v === "") continue;
      let answer;
      let obsValue;
      if (def.type === "choice") {
        const coding = { system: ANSWER_SYSTEM, code: def.id + "." + v, display: t("a." + def.id + "." + v) };
        answer = { valueCoding: coding };
        obsValue = { valueCodeableConcept: { coding: [coding], text: coding.display } };
      } else {
        const n = Number(v);
        answer = { valueDecimal: n };
        obsValue = { valueQuantity: { value: n, unit: def.unit === "Cel" ? "°C" : "pH", system: UCUM, code: def.unit } };
      }
      qr.item.push({ linkId: def.id, text: t("q." + def.id), answer: [answer] });
      const obsId = uuid();
      obsIds.push(obsId);
      entries.push({
        id: obsId,
        resource: Object.assign({
          resourceType: "Observation",
          status: "final",
          category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "survey", display: "Survey" }] }],
          code: { coding: [{ system: INDICATOR_SYSTEM, code: def.id, display: t("q." + def.id) }], text: t("q." + def.id) },
          subject: ref(locId),
          effectiveDateTime: authored,
          derivedFrom: [ref(qrId)],
        }, obsValue),
      });
    }
    entries.splice(1, 0, { id: qrId, resource: qr });

    const interpretationCode = { good: "N", moderate: "IND", poor: "A", alert: "AA" }[result.level];
    const summary = {
      resourceType: "Observation",
      status: "final",
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "survey", display: "Survey" }] }],
      code: { coding: [{ system: INDICATOR_SYSTEM, code: "stream-health-index", display: "Stream health index (0-100)" }], text: "Stream health index" },
      subject: ref(locId),
      effectiveDateTime: authored,
      valueQuantity: { value: result.index, unit: "score", system: UCUM, code: "{score}" },
      interpretation: [{
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: interpretationCode }],
        text: result.level,
      }],
      note: [
        { text: "Explanation: " + (result.factors.length
          ? result.factors.map((f) => f.question + "=" + f.answer + " (-" + f.penalty + ")").join("; ")
          : "no negative signs observed") },
        { text: "Data confidence: " + q.confidence + (q.issues.length ? " [" + q.issues.map((i) => i.code).join(", ") + "]" : "") },
      ],
      derivedFrom: [ref(qrId)],
      hasMember: obsIds.map(ref),
    };
    entries.push({ id: uuid(), resource: summary });

    return {
      resourceType: "Bundle",
      type: "transaction",
      timestamp: new Date().toISOString(),
      entry: entries.map((e) => ({
        fullUrl: "urn:uuid:" + e.id,
        resource: e.resource,
        request: { method: "POST", url: e.resource.resourceType },
      })),
    };
  }

  /** Minimal structural validation of a Bundle (used by tests and the UI). */
  function validateBundle(bundle) {
    const errors = [];
    if (bundle.resourceType !== "Bundle") errors.push("not a Bundle");
    if (bundle.type !== "transaction") errors.push("Bundle.type must be transaction");
    const urls = new Set((bundle.entry || []).map((e) => e.fullUrl));
    for (const e of bundle.entry || []) {
      const r = e.resource;
      if (!/^urn:uuid:[0-9a-f-]{36}$/.test(e.fullUrl)) errors.push("bad fullUrl " + e.fullUrl);
      if (!e.request || e.request.method !== "POST" || e.request.url !== r.resourceType) errors.push("bad request on " + e.fullUrl);
      if (r.resourceType === "Observation") {
        if (!r.status || !r.code) errors.push("Observation missing status/code");
        const values = Object.keys(r).filter((k) => k.startsWith("value"));
        if (values.length > 1) errors.push("Observation has several value[x]");
      }
      if (r.resourceType === "QuestionnaireResponse" && !r.status) errors.push("QR missing status");
      // every internal reference must resolve inside the bundle
      JSON.stringify(r, (k, v) => {
        if (k === "reference" && typeof v === "string" && v.startsWith("urn:uuid:") && !urls.has(v)) {
          errors.push("dangling reference " + v);
        }
        return v;
      });
    }
    return errors;
  }

  const api = { QUESTIONS, MAX_PENALTY, score, quality, advice, fhirQuestionnaire, fhirBundle, validateBundle, QUESTIONNAIRE_URL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RanokaCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
