require('dotenv').config();
const express = require('express');
const path = require('path');

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Mangler SUPABASE_URL eller SUPABASE_SERVICE_KEY i .env');
  process.exit(1);
}

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
app.use('/api/leads', require('./routes/leads'));
app.use('/api/oversikt', require('./routes/oversikt'));
app.use('/api/daglig', require('./routes/daglig'));
app.use('/api/founders', require('./routes/founders'));
app.use('/api/mija', require('./routes/mija'));
app.use('/api/ideer', require('./routes/ideer'));
app.use('/api/agenter', require('./routes/agenter'));
app.use('/api/sosialt', require('./routes/sosialt'));

// Hvilke nøkler som faktisk er på plass — styrer varslene i grensesnittet.
app.get('/api/status', (_req, res) => {
  res.json({
    supabase: true,
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    embeddings: Boolean(process.env.OPENAI_API_KEY),
    google_places: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    port: PORT
  });
});

app.use('/api', (_req, res) => res.status(404).json({ feil: 'Ukjent endepunkt' }));

// Alt annet er dashbordet — klienten håndterer sine egne stier.
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n✅ Volum Kontroll kjører på http://localhost:${PORT}\n`);
  const mangler = [
    !process.env.ANTHROPIC_API_KEY && 'ANTHROPIC_API_KEY (Founders-svar, daglig oppsummering, idévurdering)',
    !process.env.OPENAI_API_KEY && 'OPENAI_API_KEY (semantisk søk i podcasten)',
    !process.env.GOOGLE_PLACES_API_KEY && 'GOOGLE_PLACES_API_KEY (hente nye leads)'
  ].filter(Boolean);
  if (mangler.length) {
    console.log('⚠️  Disse sidene er avslått til nøklene ligger i .env:');
    mangler.forEach((m) => console.log('   • ' + m));
    console.log('');
  }
});
