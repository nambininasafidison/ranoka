#!/usr/bin/env bash
# Validate Ranoka's FHIR output with the official HL7 FHIR validator.
# Needs Java 17+ and internet access (the validator downloads the R4 packages it needs).
set -euo pipefail
cd "$(dirname "$0")/.."
node build.js
[ -f validator_cli.jar ] || curl -L -o validator_cli.jar \
  https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar
java -jar validator_cli.jar \
  dist/fhir/Bundle-example-ikopa.json dist/fhir/Questionnaire-ranoka-stream-check.json \
  dist/fhir/CodeSystem-stream-indicator.json dist/fhir/CodeSystem-stream-answer.json \
  -ig dist/fhir/CodeSystem-stream-indicator.json -ig dist/fhir/CodeSystem-stream-answer.json \
  -ig dist/fhir/Questionnaire-ranoka-stream-check.json \
  -version 4.0.1 "$@"
