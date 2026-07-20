// Kjør ÉN gang for å flytte de eksisterende leadsene fra Google Sheet til Supabase:
//   node importer.js
require('dotenv').config();

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbwWQn_iHX-6h716fdhdFWC5dilH_enNWbB_6XnHyWFcwaSX_BJOZ570TJvh2GbM4AVomA/exec';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Mangler SUPABASE_URL / SUPABASE_SERVICE_KEY i .env');
  process.exit(1);
}

const SB = `${SUPABASE_URL}/rest/v1`;
const H = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

const pick = (o, keys) => {
  for (const k of keys) if (o[k] != null && String(o[k]).trim() !== '') return String(o[k]).trim();
  return null;
};
const tom = v => !v || ['ikke funnet', 'ingen nettside', 'ingen telefon'].includes(v.toLowerCase());

(async () => {
  console.log('⏳ Henter leads fra arket…');
  let data;
  try {
    data = await (await fetch(APPS_SCRIPT_URL)).json();
  } catch (e) {
    console.error('❌ Klarte ikke hente fra Apps Script-lenka:', e.message);
    console.error('   Sjekk at lenka i .env (APPS_SCRIPT_URL) fortsatt er deployet.');
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error('❌ Uventet svar fra arket (ikke en liste):', data);
    process.exit(1);
  }

  const eks = await (await fetch(`${SB}/crm_leads?select=navn`, { headers: H })).json();
  const sett = new Set((eks || []).map(x => (x.navn || '').toLowerCase().trim()));

  const rows = [];
  for (const l of data) {
    const navn = pick(l, ['Navn', 'navn', 'name', 'bedrift', 'company']);
    if (!navn || sett.has(navn.toLowerCase().trim())) continue;
    if ((pick(l, ['Status', 'status']) || '').toLowerCase() === 'slettet') continue;
    sett.add(navn.toLowerCase().trim());

    const telefon = pick(l, ['NR', 'nr', 'telefon', 'phone']);
    const nettside = pick(l, ['Nett', 'nett', 'nettside', 'website']);
    const fb = pick(l, ['FB', 'fb', 'facebook']);
    const ig = pick(l, ['IG', 'ig', 'instagram']);

    rows.push({
      navn,
      telefon: tom(telefon) ? null : telefon,
      nettside: tom(nettside) ? null : nettside,
      facebook: tom(fb) ? null : fb,
      instagram: tom(ig) ? null : ig,
      status: 'Ny',
      kilde: 'import-google-sheet'
    });
  }

  if (!rows.length) { console.log('✅ Ingen nye leads å importere (alt ligger inne fra før).'); return; }

  const r = await fetch(`${SB}/crm_leads`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(rows)
  });
  if (!r.ok) { console.error('❌ Insert feilet:', r.status, await r.text()); process.exit(1); }
  const inn = await r.json();
  console.log(`✅ Importerte ${inn.length} leads til Supabase.`);
})();
