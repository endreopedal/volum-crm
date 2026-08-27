# Volum Kontroll

Kontrollpanelet for alt du driver med. Kjører lokalt på **http://localhost:3000**
og henter alt live fra Supabase.

## Sidene

| Side | Hva den viser |
|------|---------------|
| **Oversikt** | Nøkkeltall på tvers av alt: leads, kunder, omsetning, agenter, poster, ideer — pluss salgstrakt, siste aktivitet og jobbkø. |
| **I dag** | Daglig oppsummering: hva som skjedde, hva som står over fristen, hva som venter. Knappen «Oppsummer med Claude» skriver sammendraget i klartekst. |
| **AI-agenter** | Live-kart over hele maskineriet. Prikkene som renner langs linjene viser hvilken vei dataene går. Klikk på en boks for å se hva den gjør og hva den henger sammen med. Filtrer på Volum.media, Mija eller Founders for å følge én historie av gangen. |
| **Sosialt** | Alt av sosiale medier: publiseringstakt, hva som venter på godkjenning, hva som er publisert, resultater per post, kundenes ukesleveranser og lærdommene systemet har trukket. |
| **Mija** | Butikken: omsetning, ordre, refusjoner, pakker, drops, besøk, nedlastinger, personvern og eksperimenter. |
| **Ideer** | Nye bedriftsideer. «＋ Legg til ny bedrift» oppretter en, Claude kan vurdere en enkelt idé eller foreslå tre nye bygget på det du allerede har. |
| **Founders** | Hele Founders-podcasten som kunnskapsbase — 448 episoder delt i 11 000 søkbare biter. Spør om hva som helst og få svar med henvisning til episode og tidspunkt. |
| **Leads-CRM** | Den gamle CRM-en, uendret, på `/leads.html`. |

**Gjennom hele dashbordet:** `⌘K` åpner søk på tvers av leads, kunder, drops,
ideer, agenter og episoder. Tastene `1`–`7` hopper mellom sidene. Temaet følger
systemet ditt, men kan låses til lyst eller mørkt nederst i menyen. Sidene
frisker seg opp av seg selv når fanen er synlig.

## Oppsett

```
npm install
npm start
```

Åpne **http://localhost:3000**. Mangler nøklene, møter du oppsettsiden — lim dem
inn der, så testes hver enkelt med en gang og lagres til `.env`. Du trenger ikke
terminalen, og du trenger ikke starte på nytt etterpå.

Går noe galt med en nøkkel, sier siden hva som er galt: avkortet kopi, feil
prosjekt, `anon` i stedet for `service_role`, plassholder som aldri ble byttet ut.

Nøklene kan når som helst endres igjen under **Nøkler** nederst i menyen.

### Nøkler

| Nøkkel | Trengs til | Uten den |
|--------|-----------|----------|
| `SUPABASE_SERVICE_KEY` | alt | appen starter ikke |
| `ANTHROPIC_API_KEY` | Founders-svar, daglig oppsummering, idévurdering | de knappene sier fra at nøkkelen mangler — resten fungerer |
| `OPENAI_API_KEY` | semantisk søk i podcasten | Founders-søket er avslått, episodelista virker |
| `GOOGLE_PLACES_API_KEY` | «Hent flere leads» i CRM-en | knappen sier fra |

Bare Supabase-nøkkelen er påkrevd. Uten de andre fungerer resten av dashbordet
som normalt — knappene som trenger dem sier fra.

**Merk om embeddings:** `OPENAI_API_KEY` brukes *kun* til å lage søkevektorer, og må
være OpenAI. De 11 000 bitene i `podcast_chunks` er allerede lagret med
`text-embedding-3-small` (1536 dimensjoner) — bytter du modell, matcher ikke
vektorene og søket blir ubrukelig. Selve svarene skrives av Claude.

## Slik henger det sammen

```
routes/        ett API-endepunkt per side  (/api/oversikt, /api/mija, …)
lib/sb.js      Supabase (REST + SQL via ceo_readonly_query)
lib/llm.js     Claude (claude-opus-5) + OpenAI-embeddings
lib/oppsett.js leser, tester og skriver .env — det oppsettsiden bruker
lib/feil.js    ett felles feilsvar, så «nøkler mangler» alltid ser likt ut
public/        dashbordet — React via Babel i nettleseren, ingen byggesteg
  css/app.css    designsystemet: alle farger er tokens, lys og mørk
  js/kjerne.js   felles komponenter og grafer
  js/sider/      én fil per side
  leads.html     den gamle CRM-en
```

**To ting verdt å vite hvis du skal endre noe:**

`ceo_readonly_query` i Supabase avviser spørringer som inneholder ordene
`insert`, `update`, `delete`, `drop`, `create`, `alter`, `truncate`, `grant`
eller `revoke` etterfulgt av mellomrom — også inne i tekststrenger. Derfor heter
det «Mija-utgivelse», ikke «Drop», i søkeresultatene.

Grafene setter `viewBox` i faktiske piksler ved hjelp av en `ResizeObserver`.
Uten det skalerer nettleseren akseteksten opp eller ned sammen med grafen.

React og Babel serveres fra `node_modules` via `/bibliotek/*`, så dashbordet
tegner seg uten internett. Ingen byggesteg — rediger en fil under `public/` og
last siden på nytt.

## Data

Alt ligger i Supabase-prosjektet **LEADS** (`krawpaxzwygnvoueykcc`). Dashbordet
kun leser, med to unntak: bedriftsideer (`bedrift_ideer`) og leads-endringer
skrives tilbake.

Tabellen `bedrift_ideer` ble lagt til for Ideer-siden. Resten var der fra før.
