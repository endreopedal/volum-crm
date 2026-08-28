// Daglig oppsummering: hva skjedde i går/i dag, hva står på tur, hva står fast.
const express = require('express');
const { sbSql } = require('../lib/sb');
const { spor, harClaude } = require('../lib/llm');
const { svarFeil } = require('../lib/feil');

const router = express.Router();

async function samleDagsdata(dager) {
  const vindu = `now() - interval '${dager} days'`;
  const [nye_leads, ordre, poster, jobber, blogg, oppgaver, drops, feil] = await Promise.all([
    sbSql(`select name, bransje, by, level, created_at from crm_leads
           where created_at > ${vindu} order by created_at desc limit 40`),
    sbSql(`select status, round(amount_cents/100.0,2) as belop, currency, country_code, created_at
           from orders where created_at > ${vindu} order by created_at desc limit 40`),
    sbSql(`select platform, status, left(coalesce(caption,''),80) as caption, published_at, scheduled_at
           from social_posts where coalesce(published_at, scheduled_at) > ${vindu}
           order by coalesce(published_at, scheduled_at) desc limit 40`),
    sbSql(`select type, status, count(*) as antall from jobs
           where updated_at > ${vindu} group by 1,2 order by 3 desc limit 25`),
    sbSql(`select tittel, status, kategori, created_at from blogg_innlegg
           where created_at > ${vindu} order by created_at desc limit 20`),
    sbSql(`select tittel, type, forfaller, status from kalender_oppgaver
           where status <> 'ferdig' order by forfaller asc limit 25`),
    sbSql(`select title, status, edition, published_at from drops
           where coalesce(published_at, created_at) > ${vindu} order by created_at desc limit 10`),
    // Manglet tidsfilteret alle de andre har, så «I dag» meldte om jobber
    // som ga opp for flere dager siden. Oversikt-panelet viser alle uansett.
    sbSql(`select type, last_error, attempts, updated_at from jobs
           where status = 'dead' and updated_at > ${vindu}
           order by updated_at desc limit 10`)
  ]);
  return { nye_leads, ordre, poster, jobber, blogg, oppgaver, drops, feil };
}

// Rådata for dagen — brukes til å tegne kortene.
router.get('/', async (req, res) => {
  try {
    const dager = Math.min(Math.max(Number(req.query.dager) || 1, 1), 30);
    res.json({ dager, ...(await samleDagsdata(dager)) });
  } catch (e) {
    svarFeil(res, e);
  }
});

const SYSTEM = `Du er driftsassistenten til Endre som driver Volum.media (AI-synlighet for norske
småbedrifter) og Mija (automatisert butikk for digitale wallpaper-drops).

Du får rådata fra databasen for en gitt periode. Skriv en kort, konkret daglig oppsummering på norsk.

Regler:
- Skriv som en rolig kollega, ikke som en rapportgenerator. Ingen floskler.
- Bruk KUN tall som finnes i dataene. Finner du ikke noe, si at det ikke skjedde noe der.
- Struktur: "Dette skjedde", "Dette står fast", "Gjør dette i dag" (maks 3 punkter, prioritert).
- Er noe rødt (døde jobber, refusjoner, forfalte oppgaver) — si det først og rett ut.
- Maks 250 ord. Markdown med korte punkter.`;

// Samme data, men tygget gjennom Claude til en oppsummering i klartekst.
router.post('/oppsummer', async (req, res) => {
  try {
    if (!harClaude()) {
      return res.status(400).json({ feil: 'ANTHROPIC_API_KEY mangler i .env — legg den inn for å få AI-oppsummering.' });
    }
    const dager = Math.min(Math.max(Number(req.body?.dager) || 1, 1), 30);
    const data = await samleDagsdata(dager);
    const tekst = await spor(
      SYSTEM,
      `Periode: siste ${dager} døgn. Dagens dato: ${new Date().toLocaleDateString('no-NO')}.\n\n` +
        `Rådata (JSON):\n${JSON.stringify(data, null, 1)}`,
      { maxTokens: 2000 }
    );
    res.json({ dager, tekst, generert: new Date().toISOString() });
  } catch (e) {
    svarFeil(res, e);
  }
});

module.exports = router;
