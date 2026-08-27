require('dotenv').config();
const express = require('express');
const path = require('path');

// Appen starter selv om nøklene mangler — da møter du oppsettsiden i
// nettleseren i stedet for en feilmelding i terminalen.
// Dashbordet skal alltid ligge på localhost:3000.
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// React og Babel serveres lokalt — dashbordet skal ikke trenge internett for å
// tegne seg. Kun disse tre filene eksponeres, ikke hele node_modules.
const BIBLIOTEK = {
  '/bibliotek/react.js': 'react/umd/react.production.min.js',
  '/bibliotek/react-dom.js': 'react-dom/umd/react-dom.production.min.js',
  '/bibliotek/babel.js': '@babel/standalone/babel.min.js'
};
for (const [rute, fil] of Object.entries(BIBLIOTEK)) {
  app.get(rute, (_req, res) =>
    res.sendFile(path.join(__dirname, 'node_modules', fil), { maxAge: '30d', immutable: true }));
}

// ── API ────────────────────────────────────────────────────────────
app.use('/api/oppsett', require('./routes/oppsett'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/oversikt', require('./routes/oversikt'));
app.use('/api/daglig', require('./routes/daglig'));
app.use('/api/founders', require('./routes/founders'));
app.use('/api/mija', require('./routes/mija'));
app.use('/api/ideer', require('./routes/ideer'));
app.use('/api/agenter', require('./routes/agenter'));
app.use('/api/sosialt', require('./routes/sosialt'));
app.use('/api/sok', require('./routes/sok'));

// Hvilke nøkler som faktisk er på plass — styrer varslene i grensesnittet.
app.get('/api/status', (_req, res) => {
  res.json({
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    embeddings: Boolean(process.env.OPENAI_API_KEY),
    google_places: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    port: PORT
  });
});

app.use('/api', (_req, res) => res.status(404).json({ feil: 'Ukjent endepunkt' }));

// Feil fra rutene ender her. Mangler nøklene, sier vi det tydelig så
// grensesnittet kan sende brukeren til oppsettet i stedet for å vise en rå feil.
app.use('/api', (feil, _req, res, _next) => {
  if (feil?.oppsettMangler) return res.status(503).json({ feil: feil.message, oppsett: true });
  res.status(500).json({ feil: feil?.message || 'Ukjent feil' });
});

// Alt annet er dashbordet — klienten håndterer sine egne stier.
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '127.0.0.1', () => {
  const adresse = `http://localhost:${PORT}`;
  console.log(`\n  ✦  Volum Kontroll\n     ${adresse}\n`);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.log('     Nøklene mangler ennå — åpne adressen over, så');
    console.log('     tar oppsettet deg gjennom det. Ingen terminal nødvendig.\n');
  } else {
    const mangler = [
      !process.env.ANTHROPIC_API_KEY && 'Claude',
      !process.env.OPENAI_API_KEY && 'podcast-søk',
      !process.env.GOOGLE_PLACES_API_KEY && 'Google Places'
    ].filter(Boolean);
    if (mangler.length) console.log(`     Avslått til nøkkel er lagt inn: ${mangler.join(', ')}\n`);
  }
});
