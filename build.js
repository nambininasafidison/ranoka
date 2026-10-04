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
console.log("Built dist/index.html (" + html.length + " bytes) and dist/questionnaire.json");
