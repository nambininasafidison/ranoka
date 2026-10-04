const test = require("node:test");
const assert = require("node:assert");
const core = require("../src/core.js");
const { STRINGS, translator } = require("../src/i18n.js");

const clean = {
  colour: "clear", smell: "none", foam: "none", oil: "no", litter: "none",
  deadAnimals: "no", algae: "none", banks: "natural", flow: "flowing", invasive: "no",
};

test("clean stream scores 100 / good with no factors", () => {
  const r = core.score(clean);
  assert.strictEqual(r.index, 100);
  assert.strictEqual(r.level, "good");
  assert.deepStrictEqual(r.factors, []);
});

test("worst answers score 0", () => {
  const worst = {
    colour: "unusual", smell: "sewage", foam: "lots", oil: "yes", litter: "lots", deadAnimals: "yes",
    algae: "mat", banks: "bare", flow: "stagnant", invasive: "yes", temperature: 32, ph: 5,
  };
  const r = core.score(worst);
  assert.strictEqual(r.index, 0);
  assert.strictEqual(r.level, "alert");
});

test("a single critical sign forces an alert even with a high score", () => {
  const r = core.score({ ...clean, deadAnimals: "yes" });
  assert.ok(r.index > 60);
  assert.strictEqual(r.level, "alert");
  assert.ok(r.advice.includes("people.avoid"));
  assert.ok(r.advice.includes("animals.keepAway"));
});

test("thick algae warns about toxicity for animals", () => {
  const r = core.score({ ...clean, algae: "mat" });
  assert.ok(r.advice.includes("animals.algaeToxic"));
});

test("factors explain the whole penalty, biggest first", () => {
  const r = core.score({ ...clean, colour: "brown", litter: "some", temperature: 27 });
  assert.strictEqual(r.factors.reduce((s, f) => s + f.penalty, 0), r.penalty);
  assert.strictEqual(r.factors[0].question, "colour");
});

test("quality: complete answers with precise location are high confidence", () => {
  const q = core.quality(clean, { latitude: -18.9, longitude: 47.5, accuracy: 10 });
  assert.strictEqual(q.confidence, "high");
  assert.deepStrictEqual(q.issues, []);
});

test("quality: out-of-range pH and missing answers lower confidence", () => {
  const q = core.quality({ colour: "clear", ph: 14 }, {});
  assert.strictEqual(q.confidence, "low");
  const codes = q.issues.map((i) => i.code);
  assert.ok(codes.includes("range.ph"));
  assert.ok(codes.includes("missing.smell"));
  assert.ok(codes.includes("missing.location"));
});

test("quality: dry stream with water signs is flagged once", () => {
  const q = core.quality({ ...clean, flow: "dry", foam: "lots", oil: "yes" }, { latitude: 1, longitude: 1 });
  assert.strictEqual(q.issues.filter((i) => i.code === "inconsistent.dryWater").length, 1);
});

test("FHIR bundle is a valid transaction with resolvable references", () => {
  const record = {
    answers: { ...clean, colour: "green", temperature: 24.5, ph: 7.2 },
    meta: { siteName: "Ikopa", latitude: -18.9, longitude: 47.5, authored: "2026-10-04T10:00:00Z", observer: "Nambinina" },
  };
  const b = core.fhirBundle(record, translator("en"));
  assert.deepStrictEqual(core.validateBundle(b), []);
  const types = b.entry.map((e) => e.resource.resourceType);
  assert.strictEqual(types[0], "Location");
  assert.strictEqual(types[1], "QuestionnaireResponse");
  // 12 indicator observations + 1 summary
  assert.strictEqual(types.filter((t) => t === "Observation").length, 13);
  const summary = b.entry[b.entry.length - 1].resource;
  assert.strictEqual(summary.code.coding[0].code, "stream-health-index");
  assert.strictEqual(summary.hasMember.length, 12);
  const temp = b.entry.find((e) => e.resource.code && e.resource.code.coding[0].code === "temperature").resource;
  assert.deepStrictEqual(temp.valueQuantity, { value: 24.5, unit: "°C", system: "http://unitsofmeasure.org", code: "Cel" });
  const loc = b.entry[0].resource;
  assert.deepStrictEqual(loc.position, { latitude: -18.9, longitude: 47.5 });
});

test("Questionnaire covers every question and answer", () => {
  const q = core.fhirQuestionnaire(translator("fr"));
  assert.strictEqual(q.item.length, core.QUESTIONS.length);
  for (const item of q.item) {
    const def = core.QUESTIONS.find((x) => x.id === item.linkId);
    if (def.type === "choice") assert.strictEqual(item.answerOption.length, def.options.length);
  }
});

test("all three languages translate every key", () => {
  const keys = Object.keys(STRINGS.en);
  for (const lang of ["fr", "mg"]) {
    const missing = keys.filter((k) => !(k in STRINGS[lang]));
    assert.deepStrictEqual(missing, [], lang + " missing keys");
  }
  // every question/answer/advice/issue key used by the core exists
  for (const q of core.QUESTIONS) {
    assert.ok(STRINGS.en["q." + q.id], q.id);
    if (q.options) for (const o of q.options) assert.ok(STRINGS.en["a." + q.id + "." + o.code]);
  }
});
