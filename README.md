# 💧 Ranoka — 60-second citizen stream checks, explained, FHIR-ready

**OneAquaHealth IEEE Global Hackathon 2026** · Tracks: **1 (Citizen UX)**, **4 (Plain-language advice)**, **7 (Digital Health Standards)**

*Ranoka* means **"water"** in Malagasy.

> **▶ Try it now:** https://nambininasafidison.github.io/ranoka/dist/ (works on any phone, also offline)
> **🎬 2-minute demo video:** https://youtu.be/7rVk4XMnvXM
> **✅ FHIR:** the export passes the **official HL7 FHIR Validator with 0 errors** in English, French and Malagasy ([details](docs/FHIR.md))

## For judges: a 2-minute tour

1. Open the [live app](https://nambininasafidison.github.io/ranoka/dist/) and switch **EN → FR → MG** in the top right.
2. Run a check: answer *Rotten / sewage* for the smell and *A lot* for the litter. You get an **Alert**, with **every lost point explained**.
3. Read the **One Health advice**, split into people, animals and environment.
4. Run a second check with a pH of 14. The **data check** flags it and lowers the confidence to *low*.
5. Click **Download FHIR data** and open the JSON: a transaction Bundle with Location, QuestionnaireResponse and Observations, ready for any FHIR server ([example](dist/fhir/Bundle-example-ikopa.json)).

## How Ranoka answers the judging criteria

- **Impact and alignment with OneAquaHealth.** It turns the people who live next to urban streams into early-warning sensors for the health of people, animals and the environment (One Health). Critical signs such as sewage, chemicals, oil, dead animals or a thick algae mat always raise an alert. The data is clean enough for researchers and city dashboards.
- **Innovation.** The score is explainable, with no black box. The data-quality check runs on the phone, before the data is shared. The app speaks Malagasy, a language that almost no environmental tool supports.
- **Technical implementation.** It is a single offline file with no dependencies. 15 automated tests cover it. The HL7 FHIR R4 export passes the official validator, and the Questionnaire and CodeSystems are published and generated from the same definition as the form.
- **Usability.** There is one question per screen, with big buttons, no jargon and three languages. A full check takes under a minute.
- **Feasibility and scalability.** It costs nothing to host, because it is a static page (GitHub Pages today). It needs no account or server to collect data. Any FHIR server can receive the exports, and new cities only need new translations or new weights.

Anyone can stand next to an urban stream and answer 10 visual questions in about a minute. Ranoka turns those answers into:

1. **An explained stream-health index (0–100).** The result lists every answer that cost points, so it is never a black box.
2. **One Health advice in plain language**, split into *people*, *animals* and *environment* (for example: "keep dogs away, thick algae can be toxic cyanobacteria").
3. **A data-quality check before the data reaches scientists**: missing answers, impossible pH or temperature, contradictions (a "dry" stream reported with foam or oil), missing or imprecise GPS. Each check gets a confidence of high, medium or low.
4. **HL7 FHIR R4 data**: a `transaction` Bundle with `Location`, `QuestionnaireResponse`, one `Observation` per indicator (UCUM units for °C and pH), and a summary `Observation` (stream-health index with `interpretation`, explanation and `hasMember`). The `Questionnaire` and the two `CodeSystem`s (with French and Malagasy designations) are generated from the same definition, so the form and the standard never drift apart. The export passes the **official HL7 FHIR Validator with 0 errors** ([docs/FHIR.md](docs/FHIR.md)).

It runs **offline**, in **English, French and Malagasy**, and keeps data **only on the device** until the user exports it. This matters for citizen scientists in the Global South, where connectivity and language are the first barriers.

![Explained result](docs/screenshots/3-result.png)

| | |
|---|---|
| ![Multilingual](docs/screenshots/1-multilingual.png) | ![Question](docs/screenshots/2-question.png) |
| ![Advice](docs/screenshots/4-advice.png) | ![Data quality](docs/screenshots/5-data-quality.png) |
| ![FHIR](docs/screenshots/6-fhir.png) | ![History](docs/screenshots/7-history.png) |

## Try it

- Open `dist/index.html` in any browser (one self-contained file, no server, no install).
- Or build it from source: `node build.js`.

## Tests

```bash
node --test test/core.test.js
```

There are 15 tests. They cover:

- scoring bounds, critical-sign overrides and explanation completeness;
- the data-quality checks;
- the FHIR Bundle structure: every `urn:uuid` reference resolves, there is one `value[x]` per Observation, and quantities use UCUM;
- narratives, canonical displays in every language, and CodeSystem coverage;
- Questionnaire coverage, and full translation coverage in all 3 languages.

To check the FHIR output with the official HL7 validator, run `./scripts/validate-fhir.sh`.

## How the score works

| Indicator | Answers → penalty |
|---|---|
| Colour | clear 0 · cloudy 1 · brown 2 · green 2 · unusual 3 |
| Smell | none/earthy 0 · sewage 3⚠ · chemical 3⚠ |
| Foam | none 0 · little 1 · lots 2 |
| Oil film | no 0 · yes 3⚠ |
| Litter | none 0 · some 1 · lots 2 |
| Dead fish/animals | no 0 · yes 4⚠ |
| Algae | none 0 · some 1 · thick mat 3⚠ |
| Bank vegetation | natural 0 · partial 1 · bare/concrete 2 |
| Flow | flowing 0 · slow 1 · stagnant/dry 2 |
| Invasive species | no/unsure 0 · yes 1 |
| Temperature (opt.) | ≤25 °C 0 · >25 1 · >30 2 |
| pH (opt.) | 6.5–8.5 0 · 6–6.5/8.5–9 1 · otherwise 2 |

`index = 100 − 100 × penalty / 29`. The levels are good ≥ 80, moderate ≥ 60, poor ≥ 40, and alert below that. **Any ⚠ sign forces "alert"** whatever the total: a single dead fish matters more than an average.

## Files

- `src/core.js`: questionnaire, scoring, quality checks, FHIR export (no dependencies, works in the browser and in Node).
- `src/i18n.js`: EN / FR / MG strings.
- `src/app.js`, `src/index.html`: mobile-first UI.
- `build.js` → `dist/index.html` (single file), `dist/questionnaire.json`, and `dist/fhir/` (Questionnaire, CodeSystems and an example Bundle).
- `docs/FHIR.md`: the resource model, the validator results and the FAIR principles.

## Limits and next steps

- The canonical URLs and code systems are project-local, but published and validated. The next step is to map them to the OneAquaHealth FHIR IG profiles once they are available.
- The penalty weights are expert-chosen defaults. With paired lab samples they can be calibrated per city.
- Next features: photo attachments (`Media`), a sync queue to a FHIR server, and a map of all checks for a city.
