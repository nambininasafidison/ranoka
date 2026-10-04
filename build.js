// Inline src/*.js into a single self-contained dist/index.html (easy to host or open offline).
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "src");
let html = fs.readFileSync(path.join(src, "index.html"), "utf8");
const scripts = ["core.js", "i18n.js", "app.js"]
  .map((f) => "<script>\n" + fs.readFileSync(path.join(src, f), "utf8") + "\n</script>")
  .join("\n");
html = html.replace(/<!-- SCRIPTS -->[\s\S]*<!-- \/SCRIPTS -->/, () => scripts);
fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "dist", "index.html"), html);

// Also publish the FHIR Questionnaire definition next to the app.
const core = require("./src/core.js");
const { translator } = require("./src/i18n.js");
fs.writeFileSync(
  path.join(__dirname, "dist", "questionnaire.json"),
  JSON.stringify(core.fhirQuestionnaire(translator("en")), null, 2)
);

// Publish the FHIR conformance resources (Questionnaire + CodeSystems) and a worked example
// so anyone can load them into a FHIR server or the HL7 validator.
const t = translator("en");
const fhirDir = path.join(__dirname, "dist", "fhir");
fs.mkdirSync(fhirDir, { recursive: true });
const write = (name, obj) => fs.writeFileSync(path.join(fhirDir, name), JSON.stringify(obj, null, 2));
write("Questionnaire-ranoka-stream-check.json", core.fhirQuestionnaire(t));
for (const cs of core.fhirCodeSystems(t)) write("CodeSystem-" + cs.id + ".json", cs);
const example = core.fhirBundle({
  answers: {
    colour: "brown", smell: "sewage", foam: "little", oil: "no", litter: "lots", deadAnimals: "no",
    algae: "some", banks: "partial", flow: "slow", invasive: "yes", temperature: 22, ph: 7.5,
  },
  meta: {
    siteName: "Ikopa river, Antananarivo", latitude: -18.9245, longitude: 47.4932, accuracy: 15,
    observer: "Demo citizen", authored: "2026-10-04T15:00:00+03:00",
  },
}, t);
example.timestamp = "2026-10-04T12:00:00Z"; // stable example file
write("Bundle-example-ikopa.json", example);
console.log("Built dist/index.html (" + html.length + " bytes), dist/questionnaire.json and dist/fhir/*.json");
