// Supabase REST-hjelpere. Bruker service_role — kjører kun lokalt/server, aldri i frontend.
// Leses ved hvert kall, ikke ved oppstart — oppsettsiden kan legge inn
// nøkler mens appen kjører, og da skal de virke uten omstart.
const SB = () => `${process.env.SUPABASE_URL}/rest/v1`;
const H = () => ({
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json'
});

/** Kastes når nøklene ikke er på plass, så sidene kan vise oppsettet i stedet for en rå feil. */
function krevNokler() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    const e = new Error('Supabase-nøklene mangler.');
    e.oppsettMangler = true;
    throw e;
  }
}

/**
 * Gjør et mislykket Supabase-svar om til en feil.
 *
 * En nøkkel som finnes men blir avvist skal føre til oppsettet på samme måte
 * som en nøkkel som mangler — ellers står brukeren igjen med «Invalid API key»
 * og ingen vei videre.
 */
async function kastFeil(r, hva) {
  const tekst = await r.text();
  if (r.status === 401 || r.status === 403) {
    const e = new Error('Supabase avviste nøkkelen.');
    e.oppsettMangler = true;
    throw e;
  }
  throw new Error(`Supabase ${hva} ${r.status}: ${tekst}`);
}

async function sbSelect(q) {
  krevNokler();
  const r = await fetch(`${SB()}/${q}`, { headers: H() });
  if (!r.ok) await kastFeil(r, 'select');
  return r.json();
}

// Antall rader uten å hente dem (bruker Content-Range fra PostgREST).
async function sbCount(table, filter = '') {
  const q = `${table}?select=id${filter ? '&' + filter : ''}`;
  krevNokler();
  const r = await fetch(`${SB()}/${q}`, {
    headers: { ...H(), Prefer: 'count=exact', Range: '0-0' }
  });
  if (!r.ok) await kastFeil(r, 'count');
  const cr = r.headers.get('content-range') || '';
  return Number(cr.split('/')[1]) || 0;
}

async function sbInsert(table, rows) {
  const liste = Array.isArray(rows) ? rows : [rows];
  if (!liste.length) return [];
  krevNokler();
  const r = await fetch(`${SB()}/${table}`, {
    method: 'POST',
    headers: { ...H(), Prefer: 'return=representation' },
    body: JSON.stringify(liste)
  });
  if (!r.ok) await kastFeil(r, 'insert');
  return r.json();
}

async function sbPatch(table, q, patch) {
  krevNokler();
  const r = await fetch(`${SB()}/${table}?${q}`, {
    method: 'PATCH',
    headers: { ...H(), Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  });
  if (!r.ok) await kastFeil(r, 'patch');
  return r.json();
}

async function sbDelete(table, q) {
  krevNokler();
  const r = await fetch(`${SB()}/${table}?${q}`, { method: 'DELETE', headers: H() });
  if (!r.ok) await kastFeil(r, 'delete');
}

// Kaller en Postgres-funksjon (f.eks. match_chunks for Founders-søket).
async function sbRpc(navn, args) {
  krevNokler();
  const r = await fetch(`${SB()}/rpc/${navn}`, {
    method: 'POST', headers: H(), body: JSON.stringify(args || {})
  });
  if (!r.ok) await kastFeil(r, `rpc ${navn}`);
  return r.json();
}

// Kjører en ren SELECT via ceo_readonly_query (funksjonen blokkerer skriving selv).
const sbSql = (q) => sbRpc('ceo_readonly_query', { q });

module.exports = { sbSelect, sbCount, sbInsert, sbPatch, sbDelete, sbRpc, sbSql };
