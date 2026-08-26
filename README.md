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

## Oppsett

1. **Node 18+** (`node -v`).
2. Kopier `.env.example` → `.env` og fyll inn nøklene:
   ```
   cp .env.example .env
   ```
3. Installer og start:
   ```
   npm install
   npm start
   ```
4. Åpne **http://localhost:3000**

### Nøkler

| Nøkkel | Trengs til | Uten den |
|--------|-----------|----------|
| `SUPABASE_SERVICE_KEY` | alt | appen starter ikke |
| `ANTHROPIC_API_KEY` | Founders-svar, daglig oppsummering, idévurdering | de knappene sier fra at nøkkelen mangler — resten fungerer |
| `OPENAI_API_KEY` | semantisk søk i podcasten | Founders-søket er avslått, episodelista virker |
| `GOOGLE_PLACES_API_KEY` | «Hent flere leads» i CRM-en | knappen sier fra |

Sidemenyen viser nederst hvilke nøkler som er på plass.

**Merk om embeddings:** `OPENAI_API_KEY` brukes *kun* til å lage søkevektorer, og må
være OpenAI. De 11 000 bitene i `podcast_chunks` er allerede lagret med
`text-embedding-3-small` (1536 dimensjoner) — bytter du modell, matcher ikke
vektorene og søket blir ubrukelig. Selve svarene skrives av Claude.

## Slik henger det sammen

```
routes/     ett API-endepunkt per side  (/api/oversikt, /api/mija, …)
lib/sb.js   Supabase (REST + SQL via ceo_readonly_query)
lib/llm.js  Claude (claude-opus-5) + OpenAI-embeddings
public/     dashbordet — React via Babel i nettleseren, ingen byggesteg
  js/kjerne.js   felles komponenter og grafer
  js/sider/      én fil per side
  leads.html     den gamle CRM-en
```

React og Babel serveres fra `node_modules` via `/bibliotek/*`, så dashbordet
tegner seg uten internett. Ingen byggesteg — rediger en fil under `public/` og
last siden på nytt.

## Data

Alt ligger i Supabase-prosjektet **LEADS** (`krawpaxzwygnvoueykcc`). Dashbordet
kun leser, med to unntak: bedriftsideer (`bedrift_ideer`) og leads-endringer
skrives tilbake.

Tabellen `bedrift_ideer` ble lagt til for Ideer-siden. Resten var der fra før.
