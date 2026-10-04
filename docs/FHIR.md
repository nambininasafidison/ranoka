# Ranoka and HL7 FHIR R4

Ranoka exports every stream check as one FHIR R4 `transaction` Bundle, ready to `POST` to any FHIR server.

## Validation with the official HL7 validator

We ran the official **HL7 FHIR Validator 6.10.4** (`validator_cli.jar`, FHIR 4.0.1) on the example Bundle, on Bundles exported in **English, French and Malagasy**, on an incomplete check, and on the published Questionnaire and CodeSystems.

| File | Result |
|---|---|
| `Bundle-example-ikopa.json` (EN) | **0 errors**, 2 warnings |
| Bundle exported in French | **0 errors**, 2 warnings |
| Bundle exported in Malagasy | **0 errors**, 2 warnings |
| Incomplete check (1 answer, no GPS) | **0 errors**; `QuestionnaireResponse.status` is `in-progress`, and the validator lists the missing required answers as warnings |
| `Questionnaire-ranoka-stream-check.json` | **0 errors**, 0 warnings |
| `CodeSystem-stream-indicator.json`, `CodeSystem-stream-answer.json` | **0 errors** |

The only remaining warnings come from running the validator **offline** (`-tx n/a`). Without a terminology server it cannot check UCUM units (`Cel`, `[pH]`) or BCP-47 language codes (`fr`, `mg`). They are standard codes.

To reproduce it, run `./scripts/validate-fhir.sh`. You need Java 17+ and internet access.

### What the first validator run taught us (and what we fixed)

| First run | Fix |
|---|---|
| No narrative on any resource (`dom-6`) | Every resource now carries a generated, human-readable `text` |
| "Observations should have a performer" | `performer` records the citizen observer (by display only: citizens are not Practitioners) |
| Local CodeSystems could not be found | We now publish `CodeSystem-stream-indicator` and `CodeSystem-stream-answer`, generated from the same definition as the form |
| `{score}` UCUM annotation is discouraged | The index is now `valueInteger` (0–100) |
| French/Malagasy exports had "wrong display" errors | `Coding.display` always uses the canonical English display. The citizen's own wording goes in `CodeableConcept.text`, and the CodeSystems carry `fr` and `mg` **designations** |
| Incomplete checks were marked `completed` | The status is `in-progress` until every required question is answered |

## Resource model

```
Bundle (transaction)
├── Location                  the stream site (name, GPS position)
├── QuestionnaireResponse     the raw answers → Questionnaire ranoka-stream-check
├── Observation × n           one per indicator (colour, smell, foam, oil, litter, dead animals,
│                             algae, banks, flow, invasive species, temperature °C, pH)
│                             subject → Location, derivedFrom → QuestionnaireResponse
└── Observation               stream-health index 0–100 (valueInteger)
                              interpretation N / IND / A / AA (v3-ObservationInterpretation)
                              note: explanation of every lost point + data-confidence flags
                              hasMember → the indicator Observations
```

## Published conformance resources (`dist/fhir/`)

- `Questionnaire-ranoka-stream-check.json`: the form, generated from the code.
- `CodeSystem-stream-indicator.json`: 13 indicator codes (12 questions + the index), with FR and MG designations.
- `CodeSystem-stream-answer.json`: 32 answer codes, with FR and MG designations.
- `Bundle-example-ikopa.json`: a worked example from the Ikopa river in Antananarivo.

## FAIR data

- **Findable**: every check has a `Location` with GPS, a time and a stable canonical Questionnaire URL.
- **Accessible**: a plain JSON file that any FHIR server accepts, exported by the user, with no account.
- **Interoperable**: HL7 FHIR R4, UCUM units, HL7 interpretation codes, and published CodeSystems.
- **Reusable**: each result carries its explanation, its data-confidence flags and its provenance (the citizen observer).

## Next steps

- Map the local codes to the OneAquaHealth FHIR IG profiles and code systems when they are published.
- Validate against a terminology server, so UCUM and language codes are checked online too.
