// Hurtigsøk på tvers av alt — det Cmd+K spør mot.
//
// Går bevisst via PostgREST og ikke rå SQL: søketeksten kommer fra brukeren,
// og her slipper vi å flette den inn i en spørring i det hele tatt.
const express = require('express');
const { sbSelect } = require('../lib/sb');
const { svarFeil } = require('../lib/feil');

const router = express.Router();

// Hvor det søkes, hva som vises, og hvor treffet fører hen.
const KILDER = [
  { tabell: 'crm_leads', felt: ['name'], vis: 'name', ikon: '🎯', side: 'oversikt',
    merk: (r) => 'Lead · ' + (r.by || '?'), velg: 'name,by', antall: 6 },
  { tabell: 'kunder', felt: ['navn'], vis: 'navn', ikon: '👥', side: 'oversikt',
    merk: (r) => 'Kunde · ' + (r.bransje || ''), velg: 'navn,bransje', antall: 4 },
  { tabell: 'bedrift_ideer', felt: ['navn', 'tagline'], vis: 'navn', ikon: '💡', side: 'ideer',
    merk: (r) => 'Idé · ' + (r.status || ''), velg: 'navn,tagline,status', antall: 5 },
  { tabell: 'drops', felt: ['title'], vis: 'title', ikon: '🛍️', side: 'mija',
    merk: (r) => 'Mija-utgivelse · ' + (r.status || ''), velg: 'title,status', antall: 5 },
  { tabell: 'agenter', felt: ['navn', 'avdeling'], vis: 'navn', ikon: '🧠', side: 'agenter',
    merk: (r) => 'Agent · ' + (r.avdeling || ''), velg: 'navn,avdeling', antall: 4 },
  { tabell: 'podcast_episodes', felt: ['title'], vis: 'title', ikon: '🎙️', side: 'founders',
    merk: (r) => 'Episode · ' + (r.published_at || ''), velg: 'title,published_at', antall: 6 },
  { tabell: 'blogg_innlegg', felt: ['tittel'], vis: 'tittel', ikon: '✍️', side: 'sosialt',
    merk: (r) => 'Blogg · ' + (r.status || ''), velg: 'tittel,status', antall: 4 }
];

/** PostgREST-verdier kan ikke inneholde komma eller parentes ubeskyttet. */
const rens = (s) => s.replace(/[,()*"\\]/g, ' ').trim();

router.get('/', async (req, res) => {
  try {
    const q = rens((req.query.q || '').trim());
    if (q.length < 2) return res.json({ treff: [] });
    const monster = encodeURIComponent(`*${q}*`);

    const alle = await Promise.all(KILDER.map(async (k) => {
      const filter = k.felt.length === 1
        ? `${k.felt[0]}=ilike.${monster}`
        : `or=(${k.felt.map((f) => `${f}.ilike.${monster}`).join(',')})`;
      try {
        const rader = await sbSelect(`${k.tabell}?select=${k.velg}&${filter}&limit=${k.antall}`);
        return rader.map((r) => ({ ikon: k.ikon, tekst: r[k.vis], under: k.merk(r), side: k.side }));
      } catch {
        return [];   // én tabell som feiler skal ikke ta ned hele søket
      }
    }));

    res.json({ treff: alle.flat().filter((t) => t.tekst).slice(0, 25) });
  } catch (e) { svarFeil(res, e); }
});

module.exports = router;
