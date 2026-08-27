// Oppsett: les, test og skriv .env — så nøkler kan legges inn fra nettleseren
// i stedet for at man må inn i en terminal.
//
// Alt her er bevisst begrenset til localhost. Serveren skriver bare til .env,
// og bare til de nøklene som står i NOKLER.
const fs = require('fs');
const path = require('path');

const ENV_FIL = path.join(__dirname, '..', '.env');

const NOKLER = {
  SUPABASE_URL: {
    navn: 'Supabase-adresse',
    pakrevd: true,
    hjelp: 'Står i Supabase → Project Settings → Data API → Project URL.',
    standard: 'https://krawpaxzwygnvoueykcc.supabase.co'
  },
  SUPABASE_SERVICE_KEY: {
    navn: 'Supabase hemmelig nøkkel',
    pakrevd: true,
    hemmelig: true,
    hjelp: 'Supabase → Project Settings → API Keys → «service_role» (eller en nøkkel som starter med sb_secret_). '
      + 'Bruk kopiknappen — markerer du med musa får du bare den maskerte visningen.',
    lenke: 'https://supabase.com/dashboard/project/_/settings/api-keys'
  },
  ANTHROPIC_API_KEY: {
    navn: 'Claude',
    hjelp: 'Gir deg Founders-svar, daglig oppsummering og vurdering av bedriftsideer.',
    lenke: 'https://console.anthropic.com/settings/keys',
    hemmelig: true
  },
  OPENAI_API_KEY: {
    navn: 'OpenAI',
    hjelp: 'Brukes kun til å lage søkevektorer for podcast-søket. Selve svarene skriver Claude.',
    lenke: 'https://platform.openai.com/api-keys',
    hemmelig: true
  },
  GOOGLE_PLACES_API_KEY: {
    navn: 'Google Places',
    hjelp: 'Kun for «Hent flere leads» i Leads-CRM-en.',
    lenke: 'https://console.cloud.google.com/apis/credentials',
    hemmelig: true
  }
};

/** Leser .env til et objekt. Tom hvis fila ikke finnes. */
function lesEnv() {
  try {
    const ut = {};
    for (const linje of fs.readFileSync(ENV_FIL, 'utf8').split('\n')) {
      const t = linje.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 1) continue;
      ut[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
    return ut;
  } catch {
    return {};
  }
}

/** Skriver .env på nytt med kommentarer, og beholder ukjente linjer. */
function skrivEnv(verdier) {
  const eksisterende = lesEnv();
  const samlet = { ...eksisterende, ...verdier };
  const linjer = ['# Skrevet av oppsettsiden på http://localhost:3000', ''];
  for (const [nokkel, meta] of Object.entries(NOKLER)) {
    if (!samlet[nokkel]) continue;
    linjer.push(`# ${meta.navn}`, `${nokkel}=${samlet[nokkel]}`, '');
  }
  for (const [k, v] of Object.entries(samlet)) {
    if (NOKLER[k]) continue;
    linjer.push(`${k}=${v}`);
  }
  fs.writeFileSync(ENV_FIL, linjer.join('\n').replace(/\n{3,}/g, '\n\n'), { mode: 0o600 });
}

// ── Diagnose ────────────────────────────────────────────────────────
// Poenget er å si nøyaktig hva som er galt, ikke bare «ugyldig nøkkel».

/** Ser på formen til en Supabase-nøkkel uten å kontakte nettverket. */
function sjekkFormSupabase(nokkel) {
  if (!nokkel) return { ok: false, grunn: 'Ingen nøkkel lagt inn.' };
  if (/^(DIN_|LIM_INN|<|xxx)/i.test(nokkel))
    return { ok: false, grunn: 'Dette er fortsatt plassholderteksten — nøkkelen ble aldri limt inn.' };
  if (/[.]{3}|…/.test(nokkel))
    return { ok: false, grunn: 'Nøkkelen inneholder «...» — du har kopiert den maskerte visningen. Bruk kopiknappen i Supabase i stedet.' };
  if (/\s/.test(nokkel))
    return { ok: false, grunn: 'Nøkkelen inneholder mellomrom eller linjeskift. Den skal være én sammenhengende tekst.' };

  if (nokkel.startsWith('sb_secret_')) return { ok: true, type: 'ny hemmelig nøkkel' };
  if (nokkel.startsWith('sb_publishable_'))
    return { ok: false, grunn: 'Dette er den offentlige nøkkelen (publishable). Du trenger den hemmelige — «Secret keys» i Supabase.' };

  if (nokkel.startsWith('eyJ')) {
    const deler = nokkel.split('.');
    if (deler.length !== 3) return { ok: false, grunn: 'Nøkkelen ser avkortet ut — en JWT skal ha tre deler skilt med punktum.' };
    try {
      const nyttelast = JSON.parse(Buffer.from(deler[1], 'base64').toString('utf8'));
      if (nyttelast.role === 'anon')
        return { ok: false, grunn: 'Dette er «anon»-nøkkelen. Du trenger «service_role».' };
      if (nyttelast.role !== 'service_role')
        return { ok: false, grunn: `Nøkkelen har rollen «${nyttelast.role}». Den skal ha «service_role».` };
      if (nyttelast.exp && nyttelast.exp * 1000 < Date.now())
        return { ok: false, grunn: 'Nøkkelen er utløpt. Lag en ny i Supabase.' };
      return { ok: true, type: 'service_role', prosjekt: nyttelast.ref || null };
    } catch {
      return { ok: false, grunn: 'Nøkkelen ser ut som en JWT, men innholdet lar seg ikke lese. Kopier den på nytt.' };
    }
  }
  if (nokkel.length < 40) return { ok: false, grunn: `Nøkkelen er bare ${nokkel.length} tegn — den er avkortet.` };
  return { ok: false, grunn: 'Ukjent nøkkelformat. Den skal starte med «eyJ» eller «sb_secret_».' };
}

/** Prøver nøkkelen mot Supabase for å se om den faktisk virker. */
async function testSupabase(url, nokkel) {
  const form = sjekkFormSupabase(nokkel);
  if (!form.ok) return { ok: false, ...form };
  if (!url) return { ok: false, grunn: 'Supabase-adressen mangler.' };

  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
  if (form.prosjekt && ref && form.prosjekt !== ref) {
    return {
      ok: false,
      grunn: `Nøkkelen hører til prosjektet «${form.prosjekt}», men adressen peker på «${ref}». Hent nøkkelen fra riktig prosjekt.`
    };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(`${url}/rest/v1/crm_leads?select=id&limit=1`, {
      signal: ctrl.signal,
      headers: { apikey: nokkel, Authorization: `Bearer ${nokkel}` }
    });
    clearTimeout(timer);
    if (r.ok) return { ok: true, type: form.type };
    if (r.status === 401) return { ok: false, grunn: 'Supabase avviste nøkkelen. Den er gyldig i formen, men ikke godtatt — lag en ny i Supabase og lim den inn på nytt.' };
    if (r.status === 404) return { ok: false, grunn: 'Kom fram til Supabase, men fant ikke tabellen crm_leads. Peker adressen på riktig prosjekt?' };
    return { ok: false, grunn: `Supabase svarte ${r.status}: ${(await r.text()).slice(0, 160)}` };
  } catch (e) {
    if (e.name === 'AbortError') return { ok: false, grunn: 'Fikk ikke svar fra Supabase innen ti sekunder. Er du på nett?' };
    return { ok: false, grunn: `Kom ikke fram til Supabase: ${e.message}` };
  }
}

async function testAnthropic(nokkel) {
  if (!nokkel) return { ok: false, grunn: 'Ingen nøkkel lagt inn.' };
  if (!nokkel.startsWith('sk-ant-'))
    return { ok: false, grunn: 'Claude-nøkler starter med «sk-ant-». Sjekk at du kopierte riktig nøkkel.' };
  try {
    const r = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': nokkel, 'anthropic-version': '2023-06-01' }
    });
    if (r.ok) return { ok: true };
    if (r.status === 401) return { ok: false, grunn: 'Anthropic avviste nøkkelen.' };
    return { ok: false, grunn: `Anthropic svarte ${r.status}.` };
  } catch (e) {
    return { ok: false, grunn: `Kom ikke fram til Anthropic: ${e.message}` };
  }
}

async function testOpenAI(nokkel) {
  if (!nokkel) return { ok: false, grunn: 'Ingen nøkkel lagt inn.' };
  if (!nokkel.startsWith('sk-'))
    return { ok: false, grunn: 'OpenAI-nøkler starter med «sk-».' };
  try {
    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${nokkel}` }
    });
    if (r.ok) return { ok: true };
    if (r.status === 401) return { ok: false, grunn: 'OpenAI avviste nøkkelen.' };
    return { ok: false, grunn: `OpenAI svarte ${r.status}.` };
  } catch (e) {
    return { ok: false, grunn: `Kom ikke fram til OpenAI: ${e.message}` };
  }
}

/** Full status for alle nøkler — det oppsettsiden tegnes fra. */
async function status() {
  const env = { ...lesEnv(), ...prosessNokler() };
  const [supabase, claude, openai] = await Promise.all([
    testSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY),
    env.ANTHROPIC_API_KEY ? testAnthropic(env.ANTHROPIC_API_KEY) : Promise.resolve({ ok: false, mangler: true }),
    env.OPENAI_API_KEY ? testOpenAI(env.OPENAI_API_KEY) : Promise.resolve({ ok: false, mangler: true })
  ]);
  return {
    supabase, claude, openai,
    google_places: { ok: Boolean(env.GOOGLE_PLACES_API_KEY), mangler: !env.GOOGLE_PLACES_API_KEY },
    lagt_inn: Object.fromEntries(
      Object.keys(NOKLER).map((k) => [k, Boolean(env[k])])
    ),
    supabase_url: env.SUPABASE_URL || NOKLER.SUPABASE_URL.standard,
    nokler: NOKLER,
    env_finnes: fs.existsSync(ENV_FIL)
  };
}

// Nøkler som allerede er lastet inn i prosessen (fra .env ved oppstart).
const prosessNokler = () =>
  Object.fromEntries(Object.keys(NOKLER).filter((k) => process.env[k]).map((k) => [k, process.env[k]]));

module.exports = {
  NOKLER, ENV_FIL, lesEnv, skrivEnv, status,
  testSupabase, testAnthropic, testOpenAI, sjekkFormSupabase
};
