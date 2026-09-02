// Oppsett fra nettleseren. Kun tilgjengelig fra maskinen appen kjører på.
const express = require('express');
const oppsett = require('../lib/oppsett');
const { svarFeil } = require('../lib/feil');

const router = express.Router();

// Nøkler skal aldri kunne settes fra en annen maskin, selv om noen skulle
// eksponere porten. Vi slipper kun gjennom loopback.
router.use((req, res, next) => {
  const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  if (ip === '127.0.0.1' || ip === '::1') return next();
  res.status(403).json({ feil: 'Oppsett kan bare gjøres fra maskinen appen kjører på.' });
});

router.get('/', async (_req, res) => {
  try { res.json(await oppsett.status()); }
  catch (e) { svarFeil(res, e); }
});

// Tester en nøkkel uten å lagre den — så man ser om den virker før man lagrer.
router.post('/test', async (req, res) => {
  try {
    const { nokkel, verdi, url } = req.body || {};
    const v = (verdi || '').trim();
    if (nokkel === 'SUPABASE_SERVICE_KEY')
      return res.json(await oppsett.testSupabase(url || process.env.SUPABASE_URL, v));
    if (nokkel === 'ANTHROPIC_API_KEY') return res.json(await oppsett.testAnthropic(v));
    if (nokkel === 'OPENAI_API_KEY') return res.json(await oppsett.testOpenAI(v));
    if (nokkel === 'GOOGLE_PLACES_API_KEY')
      return res.json(v ? { ok: true } : { ok: false, grunn: 'Ingen nøkkel lagt inn.' });
    res.status(400).json({ feil: 'Ukjent nøkkel.' });
  } catch (e) { svarFeil(res, e); }
});

// Lagrer til .env og oppdaterer prosessen, så det virker uten omstart.
router.post('/lagre', async (req, res) => {
  try {
    const inn = req.body || {};
    const skriv = {};
    for (const nokkel of Object.keys(oppsett.NOKLER)) {
      if (!(nokkel in inn)) continue;
      const v = String(inn[nokkel] ?? '').trim();
      if (v) skriv[nokkel] = v;
    }
    if (!Object.keys(skriv).length) return res.status(400).json({ feil: 'Ingenting å lagre.' });

    if (skriv.SUPABASE_SERVICE_KEY || skriv.SUPABASE_URL) {
      const test = await oppsett.testSupabase(
        skriv.SUPABASE_URL || process.env.SUPABASE_URL,
        skriv.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY
      );
      if (!test.ok) return res.status(400).json({ feil: test.grunn, felt: 'SUPABASE_SERVICE_KEY' });
    }

    oppsett.skrivEnv(skriv);
    // Legg dem inn i prosessen også, så sidene virker med én gang.
    for (const [k, v] of Object.entries(skriv)) process.env[k] = v;
    req.app.get('nullstillSupabaseSjekk')?.();

    res.json({ ok: true, status: await oppsett.status() });
  } catch (e) { svarFeil(res, e); }
});

module.exports = router;
