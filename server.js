// Serverer CRM-appen lokalt + gir "Hent nye leads fra Google"-endepunktet.
// Selve appen (public/index.html) snakker direkte med Supabase via anon-nøkkelen,
// så denne serveren trenger egentlig bare å servere fila. Google Places kjøres her
// (server-side) fordi API-nøkkelen ikke skal ligge i nettleseren.
require('dotenv').config();
const express = require('express');
const path = require('path');

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_PLACES_API_KEY, PORT = 3000 } = process.env;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const kanSkrive = SUPABASE_URL && SUPABASE_SERVICE_KEY;
const SB = `${SUPABASE_URL}/rest/v1`;
const H = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

const BRANSJER = ['bilpleie', 'bildetailing', 'bilfoliering', 'solfilm bil', 'bilverksted',
  'karosseriverksted', 'dekkhotell', 'bruktbilforhandler', 'bilforhandler', 'lakkering bil'];
const BYER = ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Kristiansand', 'Tønsberg',
  'Drammen', 'Fredrikstad', 'Sandnes', 'Sarpsborg', 'Skien', 'Ålesund', 'Bodø', 'Tromsø'];

const sbSelect = async q => (await fetch(`${SB}/${q}`, { headers: H })).json();
async function sbInsert(t, rows) {
  if (!rows.length) return [];
  const r = await fetch(`${SB}/${t}`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}
async function sbPatch(t, q, p) {
  await fetch(`${SB}/${t}?${q}`, { method: 'PATCH', headers: H, body: JSON.stringify(p) });
}
const googleSok = (n, p) => `https://www.google.com/search?q=${encodeURIComponent(n + ' ' + p)}`;

async function placesDetails(id) {
  const j = await (await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${id}&fields=formatted_phone_number,website&language=no&key=${GOOGLE_PLACES_API_KEY}`)).json();
  if (j.status !== 'OK') return {};
  return { phone: j.result?.formatted_phone_number || null, website: j.result?.website || null };
}

app.post('/api/hent-leads', async (_req, res) => {
  try {
    if (!kanSkrive) return res.status(400).json({ feil: 'Mangler SUPABASE_SERVICE_KEY i .env' });
    if (!GOOGLE_PLACES_API_KEY) return res.status(400).json({ feil: 'GOOGLE_PLACES_API_KEY mangler i .env' });

    const state = (await sbSelect('crm_state?id=eq.1&select=*'))[0] || { bransje_idx: 0, by_idx: 0 };
    const bransje = BRANSJER[state.bransje_idx] || BRANSJER[0];
    const by = BYER[state.by_idx] || BYER[0];
    const query = `${bransje} ${by}`;

    const sj = await (await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&region=no&language=no&key=${GOOGLE_PLACES_API_KEY}`)).json();
    if (sj.status === 'OVER_QUERY_LIMIT' || sj.status === 'REQUEST_DENIED')
      return res.json({ feil: true, query, melding: `Google svarte "${sj.status}" — som regel billing ikke aktivert på Google Cloud-prosjektet. ${sj.error_message || ''}` });

    const funnet = sj.results || [];
    const eks = await sbSelect('crm_leads?select=name');
    const sett = new Set(eks.map(r => (r.name || '').toLowerCase().trim()));
    const nye = [];
    for (const p of funnet) {
      const name = p.name;
      if (!name || sett.has(name.toLowerCase().trim())) continue;
      sett.add(name.toLowerCase().trim());
      let phone = null, website = null;
      try { ({ phone, website } = await placesDetails(p.place_id)); } catch {}
      nye.push({ name, phone, website, fb: googleSok(name, 'facebook'), ig: googleSok(name, 'instagram'), status: 'LEADs', level: 'Første kontakt', bransje, by });
    }
    const lagtInn = await sbInsert('crm_leads', nye);

    let nBy = state.by_idx + 1, nBransje = state.bransje_idx;
    if (nBy >= BYER.length) { nBy = 0; nBransje = state.bransje_idx + 1; }
    if (nBransje >= BRANSJER.length) nBransje = 0;
    await sbPatch('crm_state', 'id=eq.1', { bransje_idx: nBransje, by_idx: nBy, oppdatert: new Date().toISOString() });

    res.json({ query, funnet: funnet.length, lagt_til: lagtInn.length, neste: `${BRANSJER[nBransje]} ${BYER[nBy]}`, melding: `Søkte «${query}» — la til ${lagtInn.length} nye i LEADs.` });
  } catch (e) { res.status(500).json({ feil: e.message }); }
});

app.listen(PORT, () => {
  console.log(`\n✅ Volum Leads-CRM kjører på http://localhost:${PORT}\n`);
  if (!kanSkrive) console.log('   (NB: server-nøkkel mangler i .env — appen funker via anon-nøkkel, men Google-knappen er av.)\n');
});
