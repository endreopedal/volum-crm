require('dotenv').config();
const express = require('express');
const path = require('path');

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  GOOGLE_PLACES_API_KEY
} = process.env;

// Fast port – ignorerer PORT i .env med vilje (3000 er opptatt)
const PORT = 3500;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Mangler SUPABASE_URL eller SUPABASE_SERVICE_KEY i .env');
  process.exit(1);
}

const SB = `${SUPABASE_URL}/rest/v1`;
const H = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

// ── Bransjer × byer som "Hent flere leads"-knappen roterer gjennom ──
// Rediger fritt. Hver knappetrykk kjører ÉN bransje+by, og går videre til neste.
const BRANSJER = [
  'bilpleie', 'bildetailing', 'bilfoliering', 'solfilm bil', 'bilverksted',
  'karosseriverksted', 'dekkhotell', 'bruktbilforhandler', 'bilforhandler', 'lakkering bil'
];
const BYER = [
  'Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Kristiansand', 'Tønsberg',
  'Drammen', 'Fredrikstad', 'Sandnes', 'Sarpsborg', 'Skien', 'Ålesund', 'Bodø', 'Tromsø'
];

// ── Supabase-hjelpere ──────────────────────────────────────────────
async function sbSelect(q) {
  const r = await fetch(`${SB}/${q}`, { headers: H });
  if (!r.ok) throw new Error(`Supabase select ${r.status}: ${await r.text()}`);
  return r.json();
}
async function sbInsert(table, rows) {
  if (!rows.length) return [];
  const r = await fetch(`${SB}/${table}`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(rows)
  });
  if (!r.ok) throw new Error(`Supabase insert ${r.status}: ${await r.text()}`);
  return r.json();
}
async function sbPatch(table, q, patch) {
  const r = await fetch(`${SB}/${table}?${q}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  });
  if (!r.ok) throw new Error(`Supabase patch ${r.status}: ${await r.text()}`);
  return r.json();
}
async function sbDelete(table, q) {
  const r = await fetch(`${SB}/${table}?${q}`, { method: 'DELETE', headers: H });
  if (!r.ok) throw new Error(`Supabase delete ${r.status}: ${await r.text()}`);
}

// ── App ────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Alle leads
app.get('/api/leads', async (_req, res) => {
  try { res.json(await sbSelect('crm_leads?select=*&order=opprettet.desc')); }
  catch (e) { res.status(500).json({ feil: e.message }); }
});

// Ny lead manuelt
app.post('/api/leads', async (req, res) => {
  try {
    const { navn, telefon, nettside, facebook, instagram } = req.body;
    if (!navn) return res.status(400).json({ feil: 'navn mangler' });
    const rows = await sbInsert('crm_leads', [{
      navn, telefon, nettside, facebook, instagram, status: 'Ny', kilde: 'manuell'
    }]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ feil: e.message }); }
});

// Oppdater lead (status, notat osv.) — persisterer i Supabase
app.patch('/api/leads/:id', async (req, res) => {
  try {
    const patch = { oppdatert: new Date().toISOString() };
    ['status', 'telefon', 'nettside', 'facebook', 'instagram', 'notat', 'navn']
      .forEach(k => { if (k in req.body) patch[k] = req.body[k]; });
    const rows = await sbPatch('crm_leads', `id=eq.${req.params.id}`, patch);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ feil: e.message }); }
});

// Slett lead
app.delete('/api/leads/:id', async (req, res) => {
  try { await sbDelete('crm_leads', `id=eq.${req.params.id}`); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ feil: e.message }); }
});

// ── Google Places: "Hent flere leads" ──────────────────────────────
const googleSok = (navn, plattform) =>
  `https://www.google.com/search?q=${encodeURIComponent(navn + ' ' + plattform)}`;

async function placesDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json`
    + `?place_id=${placeId}&fields=formatted_phone_number,website,address_component,formatted_address&language=no&key=${GOOGLE_PLACES_API_KEY}`;
  const j = await (await fetch(url)).json();
  if (j.status !== 'OK') return {};
  const komp = j.result?.address_components || [];
  const finn = (typ) => (komp.find(c => (c.types || []).includes(typ)) || {}).long_name || null;
  return {
    telefon: j.result?.formatted_phone_number || null,
    nettside: j.result?.website || null,
    // faktisk by fra adressen (postal_town/locality), ikke byen vi søkte på
    byReell: finn('postal_town') || finn('locality') || finn('administrative_area_level_2') || null
  };
}

// ── Finn ekte FB/IG-profil ved å lese bedriftens nettside ──────────────────
const FB_JUNK = /facebook\.com\/(sharer|share\.php|plugins|tr[\/?]|dialog|login|help|policies|privacy|business\b|ads\b|connect\b|v\d)/i;
const IG_JUNK = /instagram\.com\/(p|reel|reels|tv|explore|accounts|about|legal|developer)\//i;

function trekkProfil(html, domeneRe, junkRe) {
  const treff = html.match(domeneRe) || [];
  for (let u of treff) {
    u = u.replace(/&amp;/g, '&').replace(/[.,);]+$/, '');
    if (junkRe.test(u)) continue;
    return u;
  }
  return null;
}

async function finnSosiale(website) {
  if (!website || !/^https?:\/\//i.test(website)) return { fb: null, ig: null };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(website, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VolumLeadBot/1.0)' }
    });
    clearTimeout(timer);
    const html = await r.text();
    return {
      fb: trekkProfil(html, /https?:\/\/(?:[a-z0-9-]+\.)?facebook\.com\/[^"'\s<>)\\]+/ig, FB_JUNK),
      ig: trekkProfil(html, /https?:\/\/(?:www\.)?instagram\.com\/[^"'\s<>)\\]+/ig, IG_JUNK)
    };
  } catch {
    return { fb: null, ig: null };
  }
}

app.post('/api/hent-leads', async (_req, res) => {
  try {
    if (!GOOGLE_PLACES_API_KEY)
      return res.status(400).json({ feil: 'GOOGLE_PLACES_API_KEY mangler i .env' });

    // 1. Hvor er vi i rotasjonen?
    const state = (await sbSelect('crm_state?id=eq.1&select=*'))[0] || { bransje_idx: 0, by_idx: 0 };
    const bransje = BRANSJER[state.bransje_idx] || BRANSJER[0];
    const by = BYER[state.by_idx] || BYER[0];
    const query = `${bransje} ${by}`;

    // 2. Text Search (legacy)
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json`
      + `?query=${encodeURIComponent(query)}&region=no&language=no&key=${GOOGLE_PLACES_API_KEY}`;
    const sj = await (await fetch(url)).json();

    if (sj.status === 'OVER_QUERY_LIMIT' || sj.status === 'REQUEST_DENIED') {
      return res.json({
        feil: true, query,
        melding: `Google svarte "${sj.status}". Som regel = billing ikke aktivert på `
          + `Google Cloud-prosjektet, eller nøkkelen mangler tilgang til Places API (legacy). `
          + `${sj.error_message || ''}`
      });
    }

    const funnet = sj.results || [];

    // 3. Dedup mot det som allerede ligger inne
    const eks = await sbSelect('crm_leads?select=name');
    const sett = new Set(eks.map(r => (r.name || '').toLowerCase().trim()));

    // 4. Bygg nye rader (henter telefon + nettside via Place Details)
    const nye = [];
    let utenFb = 0;
    for (const p of funnet) {
      const navn = p.name;
      if (!navn || sett.has(navn.toLowerCase().trim())) continue;
      sett.add(navn.toLowerCase().trim());
      let telefon = null, nettside = null, byReell = null;
      try { ({ telefon, nettside, byReell } = await placesDetails(p.place_id)); } catch { /* hopp over */ }
      let fb = null, ig = null;
      try { ({ fb, ig } = await finnSosiale(nettside)); } catch { /* hopp over */ }
      if (!fb) { utenFb++; continue; }   // Facebook er minimumskrav – ingen FB = ikke lagt inn
      nye.push({
        name: navn,
        phone: telefon,
        website: nettside,
        fb,   // ekte facebook.com-profil fra nettsiden, ellers tomt
        ig,   // ekte instagram.com-profil fra nettsiden, ellers tomt
        status: 'LEADs',
        level: 'Første kontakt',
        bransje,
        by: byReell || by   // faktisk by fra adressen, fallback til søkebyen
      });
    }

    const lagtInn = await sbInsert('crm_leads', nye);

    // 5. Rull rotasjonen videre
    let nBy = state.by_idx + 1, nBransje = state.bransje_idx;
    if (nBy >= BYER.length) { nBy = 0; nBransje = state.bransje_idx + 1; }
    if (nBransje >= BRANSJER.length) nBransje = 0;
    await sbPatch('crm_state', 'id=eq.1',
      { bransje_idx: nBransje, by_idx: nBy, oppdatert: new Date().toISOString() });

    res.json({
      query,
      funnet: funnet.length,
      lagt_til: lagtInn.length,
      neste: `${BRANSJER[nBransje]} ${BYER[nBy]}`,
      melding: `Søkte «${query}» — fant ${funnet.length}, la til ${lagtInn.length} med Facebook (hoppet over ${utenFb} uten).`
    });
  } catch (e) {
    res.status(500).json({ feil: e.message });
  }
});

app.listen(PORT, () =>
  console.log(`\n✅ Volum Leads-CRM kjører på http://localhost:${PORT}\n`));
