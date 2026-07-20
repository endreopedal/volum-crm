# Volum Leads-CRM

Enkel lokal CRM. Kjører på `localhost`, lagrer alt i Supabase (`crm_leads`), og har én knapp
som henter nye leads fra Google Places.

## Oppsett (én gang)

1. **Node 18+** må være installert (`node -v`).
2. Legg filene i en mappe, åpne terminal i mappa.
3. Kopier `.env.example` → `.env` og fyll inn:
   ```
   cp .env.example .env
   ```
   - `SUPABASE_SERVICE_KEY` — Supabase → Project Settings → API → **service_role** (secret).
   - `GOOGLE_PLACES_API_KEY` — samme nøkkel du brukte i det gamle scriptet.
   - `SUPABASE_URL` er allerede fylt inn (LEADS-prosjektet).
4. Installer:
   ```
   npm install
   ```

## Flytt de gamle leadsene inn (én gang)

```
node importer.js
```
Henter de eksisterende leadsene fra arket og legger dem i Supabase. Kjør gjerne flere ganger —
den hopper over det som allerede ligger inne.

## Start appen

```
npm start
```
Åpne **http://localhost:3000**

## Bruk

- **＋ Hent flere leads** — søker én bransje+by i Google Places, legger nye leads i «Ny».
  Neste trykk går videre til neste kombinasjon (rotasjonen huskes i Supabase).
- Flytt en lead med **statusvelgeren** på kortet (Ny → Kontaktet → Venter → Møte booket).
  Alt lagres automatisk i Supabase — appen husker alt neste gang du åpner den.
- Bransjer og byer redigerer du øverst i `server.js` (`BRANSJER` / `BYER`).

## Viktig

- **Google billing må være aktivt** på Google Cloud-prosjektet, ellers svarer Places
  `OVER_QUERY_LIMIT`. Appen sier fra i en rød melding hvis det skjer.
- `.env` skal **aldri** pushes til GitHub (ligger i `.gitignore`).
