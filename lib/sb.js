// Supabase REST-hjelpere. Bruker service_role — kjører kun lokalt/server, aldri i frontend.
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

const SB = `${SUPABASE_URL}/rest/v1`;
const H = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

async function sbSelect(q) {
  const r = await fetch(`${SB}/${q}`, { headers: H });
  if (!r.ok) throw new Error(`Supabase select ${r.status}: ${await r.text()}`);
  return r.json();
}

// Antall rader uten å hente dem (bruker Content-Range fra PostgREST).
async function sbCount(table, filter = '') {
  const q = `${table}?select=id${filter ? '&' + filter : ''}`;
  const r = await fetch(`${SB}/${q}`, {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' }
  });
  if (!r.ok) throw new Error(`Supabase count ${r.status}: ${await r.text()}`);
  const cr = r.headers.get('content-range') || '';
  return Number(cr.split('/')[1]) || 0;
}

async function sbInsert(table, rows) {
  const liste = Array.isArray(rows) ? rows : [rows];
  if (!liste.length) return [];
  const r = await fetch(`${SB}/${table}`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(liste)
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

// Kaller en Postgres-funksjon (f.eks. match_chunks for Founders-søket).
async function sbRpc(navn, args) {
  const r = await fetch(`${SB}/rpc/${navn}`, {
    method: 'POST', headers: H, body: JSON.stringify(args || {})
  });
  if (!r.ok) throw new Error(`Supabase rpc ${navn} ${r.status}: ${await r.text()}`);
  return r.json();
}

// Kjører en ren SELECT via ceo_readonly_query (funksjonen blokkerer skriving selv).
const sbSql = (q) => sbRpc('ceo_readonly_query', { q });

module.exports = { sbSelect, sbCount, sbInsert, sbPatch, sbDelete, sbRpc, sbSql };
