// Nye bedriftsideer: legg til, flytt status, la Claude vurdere eller foreslå nye.
const express = require('express');
const { sbSelect, sbInsert, sbPatch, sbDelete, sbSql } = require('../lib/sb');
const { spor, sporJson, harClaude } = require('../lib/llm');

const router = express.Router();

const STATUSER = ['ide', 'vurderes', 'bygges', 'live', 'parkert'];
const FELT = [
  'navn', 'tagline', 'beskrivelse', 'kategori', 'status', 'score', 'marked', 'malgruppe',
  'inntektsmodell', 'forste_steg', 'risiko', 'investering_nok', 'tid_til_lansering', 'lenke', 'notat'
];

const tall = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

// Plukker ut kjente felt fra en request-body og rydder typene.
function plukk(body) {
  const ut = {};
  for (const k of FELT) {
    if (!(k in body)) continue;
    if (k === 'score' || k === 'investering_nok') ut[k] = tall(body[k]);
    else if (k === 'status') ut[k] = STATUSER.includes(body[k]) ? body[k] : 'ide';
    else ut[k] = body[k] === '' ? null : body[k];
  }
  return ut;
}

router.get('/', async (_req, res) => {
  try {
    const [ideer, fordeling] = await Promise.all([
      sbSelect('bedrift_ideer?select=*&order=opprettet.desc'),
      sbSql(`select status, count(*) as antall, round(avg(score)) as snitt_score
             from bedrift_ideer group by 1`)
    ]);
    res.json({ ideer, fordeling, statuser: STATUSER, kiKlar: harClaude() });
  } catch (e) {
    res.status(500).json({ feil: e.message });
  }
});

// «＋ Legg til ny bedrift»
router.post('/', async (req, res) => {
  try {
    const rad = plukk(req.body || {});
    if (!rad.navn || !rad.navn.trim()) return res.status(400).json({ feil: 'Navn må fylles ut.' });
    rad.status ||= 'ide';
    rad.kilde = req.body?.kilde || 'manuell';
    const [ny] = await sbInsert('bedrift_ideer', [rad]);
    res.json(ny);
  } catch (e) {
    res.status(500).json({ feil: e.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const rad = plukk(req.body || {});
    if (!Object.keys(rad).length) return res.status(400).json({ feil: 'Ingenting å oppdatere.' });
    const [oppdatert] = await sbPatch('bedrift_ideer', `id=eq.${req.params.id}`, rad);
    res.json(oppdatert);
  } catch (e) {
    res.status(500).json({ feil: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await sbDelete('bedrift_ideer', `id=eq.${req.params.id}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ feil: e.message });
  }
});

const SYSTEM_VURDER = `Du er en nøktern forretningsrådgiver for Endre, som driver Volum.media
(AI-synlighet for norske småbedrifter) og Mija (automatisert butikk for digitale produkter).

Han jobber alene med AI-agenter som arbeidskraft. Det betyr: lave faste kostnader, høy automatisering,
og at ideer som krever mange ansatte eller mye kapital er dårlig match.

Vurder ideen han gir deg. Vær ærlig — er den svak, si det. Maks 220 ord, norsk, markdown.
Struktur: hva som er sterkt, hva som er svakt, den ene tingen som avgjør om den funker,
og et konkret første steg som kan gjøres på en uke.`;

// Claude vurderer én idé.
router.post('/:id/vurder', async (req, res) => {
  try {
    if (!harClaude()) return res.status(400).json({ feil: 'ANTHROPIC_API_KEY mangler i .env.' });
    const rader = await sbSelect(`bedrift_ideer?id=eq.${req.params.id}&select=*`);
    if (!rader.length) return res.status(404).json({ feil: 'Fant ikke ideen.' });
    const tekst = await spor(SYSTEM_VURDER, `Idé (JSON):\n${JSON.stringify(rader[0], null, 1)}`, {
      maxTokens: 1600, effort: 'high'
    });
    res.json({ vurdering: tekst });
  } catch (e) {
    res.status(500).json({ feil: e.message });
  }
});

const SKJEMA_FORSLAG = {
  type: 'object',
  additionalProperties: false,
  required: ['ideer'],
  properties: {
    ideer: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['navn', 'tagline', 'beskrivelse', 'kategori', 'score', 'marked',
                   'malgruppe', 'inntektsmodell', 'forste_steg', 'risiko',
                   'investering_nok', 'tid_til_lansering'],
        properties: {
          navn: { type: 'string' },
          tagline: { type: 'string' },
          beskrivelse: { type: 'string' },
          kategori: { type: 'string' },
          score: { type: 'integer', minimum: 0, maximum: 100 },
          marked: { type: 'string' },
          malgruppe: { type: 'string' },
          inntektsmodell: { type: 'string' },
          forste_steg: { type: 'string' },
          risiko: { type: 'string' },
          investering_nok: { type: 'integer', minimum: 0 },
          tid_til_lansering: { type: 'string' }
        }
      }
    }
  }
};

// Claude foreslår tre nye ideer bygget på det som allerede finnes i basen.
router.post('/foresla', async (req, res) => {
  try {
    if (!harClaude()) return res.status(400).json({ feil: 'ANTHROPIC_API_KEY mangler i .env.' });

    const [fins, kunder, trender] = await Promise.all([
      sbSelect('bedrift_ideer?select=navn,tagline,status,score'),
      sbSelect('kunder?select=navn,bransje,by,kunde_status'),
      sbSelect('trend_signals?select=term,source,score&order=score.desc&limit=15')
    ]);

    const forslag = await sporJson(
      `Du foreslår nye forretningsideer for Endre. Han jobber alene med AI-agenter som arbeidskraft,
har allerede en CRM med 150+ norske leads innen bilpleie/håndverk, en automatisert butikk for
digitale produkter, og en vektordatabase med hele Founders-podcasten.

Foreslå 3 NYE ideer som gjenbruker noe han allerede har (data, kunder, kode eller distribusjon).
Ikke gjenta ideer han allerede har. Alt på norsk. Score 0-100 = hvor godt den passer ham spesifikt.
Vær konkret — «AI-plattform for bedrifter» er ikke en idé, det er en floskel.`,
      `Ideer han allerede har:\n${JSON.stringify(fins)}\n\n` +
        `Kunder:\n${JSON.stringify(kunder)}\n\n` +
        `Ferske trendsignaler:\n${JSON.stringify(trender)}\n\n` +
        (req.body?.retning ? `Han vil at du tenker i denne retningen: ${req.body.retning}` : ''),
      SKJEMA_FORSLAG,
      { maxTokens: 4000, effort: 'high' }
    );

    // Lagres direkte, merket som KI-generert så de er lette å skille fra hans egne.
    const lagt = await sbInsert(
      'bedrift_ideer',
      forslag.ideer.map((i) => ({ ...i, status: 'ide', kilde: 'claude' }))
    );
    res.json({ lagt_til: lagt.length, ideer: lagt });
  } catch (e) {
    res.status(500).json({ feil: e.message });
  }
});

module.exports = router;
