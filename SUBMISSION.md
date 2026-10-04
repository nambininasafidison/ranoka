# Soumission Devpost — à faire AVANT le 4 oct. 21:00 PDT (5 oct. 04:00 UTC)

## Étapes (≈ 45 min)
1. Va sur https://oneaquahealth-ieee-hackathon.devpost.com/ et clique **Join hackathon** (si ce n'est pas déjà fait).
2. Clique **Enter a submission** / **Start project**.
3. Ouvre `dist/index.html` sur ton PC ou ton téléphone, puis enregistre la **vidéo (2–3 min)** avec le script ci-dessous. OBS, l'enregistreur d'écran du téléphone ou Loom font l'affaire. Mets-la sur YouTube en « Non répertoriée ».
4. Copie-colle les textes ci-dessous dans les champs Devpost.
5. Lien du code : https://github.com/nambininasafidison/ranoka. **Le dépôt doit être public.**
6. Choisis les tracks : 1, 4 et 7. Ajoute 2 ou 3 captures d'écran. **Submit.**

---

## Project name
Ranoka — 60-second citizen stream checks, explained and FHIR-ready

## Tagline (elevator pitch)
Anyone can check an urban stream in one minute, in English, French or Malagasy, and get an explained One Health result. Scientists get clean HL7 FHIR R4 data.

## Inspiration
In Antananarivo, rivers like the Ikopa run through neighbourhoods where people wash, fish and let animals drink. The people who see the water every day are not scientists, often have poor connectivity, and don't always speak English. Citizen science only works if the form is easy, the result is understandable, and the data is good enough for experts to trust. We built Ranoka ("water" in Malagasy) for that.

## What it does
- **10 visual questions, one per screen, with big tap targets** (colour, smell, foam, oil film, litter, dead animals, algae, banks, flow, invasive species), plus optional temperature and pH.
- **Explained stream-health index (0–100).** Every lost point is shown next to the answer that caused it. Critical signs (sewage or chemical smell, oil, dead animals, thick algae) always trigger an alert.
- **One Health advice in plain language** for people, animals and the environment, for example "keep dogs away: thick algae can be toxic cyanobacteria".
- **Data-quality check before the data leaves the phone**: missing answers, impossible values, contradictions, missing or imprecise GPS, all summarised as a High, Medium or Low confidence.
- **HL7 FHIR R4 export**: a transaction Bundle with Location, QuestionnaireResponse, one Observation per indicator (UCUM units), and a summary Observation with interpretation, explanation and hasMember. The FHIR Questionnaire is generated from the same definition.
- **Offline-first, trilingual (EN/FR/MG), private by default**: data stays on the device until it is exported. A history view shows the trend per site.

## How we built it
Plain HTML, CSS and JavaScript with no dependencies, built into a single self-contained file that works offline on any phone. The core (questionnaire, scoring, quality checks, FHIR generation) is one pure module that also runs in Node. It is covered by 11 automated tests, including structural FHIR checks (every reference resolves, one value[x] per Observation, UCUM quantities) and full translation coverage.

## Challenges we ran into
- **Keeping the score explainable.** We chose a transparent additive model with a hard override for critical signs instead of a black-box model.
- **Writing advice that is both accurate and short** in three languages.
- **Mapping a citizen form to FHIR cleanly.** The stream is a Location and is the subject of every Observation, and the summary links back to the raw observations.

## Accomplishments that we're proud of
- A full check takes under a minute.
- Every result can be explained.
- The data is standards-ready.
- It works in Malagasy, a language almost no environmental tool supports.

## What we learned
Data quality starts at the citizen's phone: catching contradictions and missing GPS at entry time is cheaper than cleaning the data later. Plain-language advice is what makes people come back.

## What's next for Ranoka
- Map the codes to the OneAquaHealth FHIR IG profiles and validate with the HL7 validator.
- Calibrate the weights against lab samples.
- Add photo attachments.
- Add a sync queue to a FHIR server and a city map of all checks.

## Built with
javascript, html5, css3, hl7-fhir, node.js

---

## Script vidéo (2 min 30)
1. **(0:00–0:20)** « Hi, this is Ranoka, which means "water" in Malagasy. Anyone next to an urban stream can check it in 60 seconds, and scientists get standards-ready FHIR data. »
2. **(0:20–0:40)** Montre le choix de langue EN → FR → MG. Entre le nom du site et clique « Use my location ».
3. **(0:40–1:20)** Réponds aux questions, avec une odeur d'égout et beaucoup de déchets. « One question per screen, big buttons, no jargon. »
4. **(1:20–1:50)** Sur le résultat : « The score is explained: each answer shows how many points it cost. A sewage smell is a critical sign, so it's an alert. Advice is split into people, animals and environment: One Health. »
5. **(1:50–2:10)** Section *Data check* : montre un cas avec un pH à 14 (confiance faible). « Quality is checked before data reaches scientists. »
6. **(2:10–2:30)** Clique « Download FHIR » et montre le JSON (Location, QuestionnaireResponse, Observations). « It's an HL7 FHIR R4 transaction bundle, ready for a FHIR server. It works offline and data stays on the device. Thank you! »
