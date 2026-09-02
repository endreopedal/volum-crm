// Live-simulasjonen: hvordan alt henger sammen.
//
// Grafen er tegnet i kode (det er arkitekturen — den endrer seg ikke av seg selv),
// men hver node får ferske tall fra databasen, og "pulsen" er ekte hendelser
// fra jobs-tabellen som frontend animerer langs kantene.
const express = require('express');
const { sbSql, sbSelect } = require('../lib/sb');
const { svarFeil } = require('../lib/feil');

const router = express.Router();

// gruppe styrer farge, kolonne styrer plassering i flyten (venstre → høyre)
const NODER = [
  // ── Volum.media: fra ukjent bedrift til betalende kunde ──
  { id: 'places',    navn: 'Google Places',     ikon: '🗺️', gruppe: 'kilde',  kolonne: 0, rad: 0, tekst: 'Søker bransje × by' },
  { id: 'ringepanel',navn: 'Ringepanel',        ikon: '📞', gruppe: 'agent',  kolonne: 2, rad: 0, agent: 'ringepanel' },
  { id: 'kunder',    navn: 'Kunder',            ikon: '👥', gruppe: 'data',   kolonne: 3, rad: 0, tabell: 'kunder' },

  // ── Volum.media: agentene som jobber for hver kunde ──
  { id: 'sosiale',   navn: 'Sosiale innlegg',   ikon: '📱', gruppe: 'agent',  kolonne: 4, rad: 0, agent: 'sosiale-innlegg' },
  { id: 'googlebing',navn: 'Google & Bing',     ikon: '📍', gruppe: 'agent',  kolonne: 4, rad: 1, agent: 'google-bing' },
  { id: 'blogg',     navn: 'Blogg',             ikon: '✍️', gruppe: 'agent',  kolonne: 4, rad: 2, agent: 'blogg' },
  { id: 'forum',     navn: 'Forum',             ikon: '💬', gruppe: 'agent',  kolonne: 4, rad: 3, agent: 'forum' },
  { id: 'synlighet', navn: 'AI-synlighet',      ikon: '🔍', gruppe: 'agent',  kolonne: 4, rad: 4, agent: 'synlighet' },

  { id: 'metricool', navn: 'Metricool',         ikon: '🚀', gruppe: 'ut',     kolonne: 5, rad: 0, tekst: 'FB + IG for kundene' },
  { id: 'gbp',       navn: 'Google Business',   ikon: '🏢', gruppe: 'ut',     kolonne: 5, rad: 1, tekst: 'Innlegg + Bing Places' },
  { id: 'bloggsite', navn: 'Anmeldelser.no',    ikon: '🌐', gruppe: 'ut',     kolonne: 5, rad: 2, tabell: 'blogg_innlegg' },
  { id: 'forumut',   navn: 'Forum-tråder',      ikon: '🧵', gruppe: 'ut',     kolonne: 5, rad: 3, tabell: 'forum_historikk' },
  { id: 'rapport',   navn: 'Måned-rapport',     ikon: '📊', gruppe: 'agent',  kolonne: 5, rad: 4, agent: 'maned-rapporter' },

  // ── Mija: butikken som bygger seg selv ──
  { id: 'trend',     navn: 'Trend-scan',        ikon: '📈', gruppe: 'mija',   kolonne: 0, rad: 6, jobb: 'trend.scan',    tabell: 'trend_signals' },
  { id: 'tema',      navn: 'Tema-forslag',      ikon: '🎨', gruppe: 'mija',   kolonne: 1, rad: 6, jobb: 'theme.propose', tabell: 'themes' },
  { id: 'dropplan',  navn: 'Drop-plan',         ikon: '🗓️', gruppe: 'mija',   kolonne: 2, rad: 6, jobb: 'drop.plan',     tabell: 'drops' },
  { id: 'dropbuild', navn: 'Bildegenerering',   ikon: '🖼️', gruppe: 'mija',   kolonne: 3, rad: 6, jobb: 'drop.build',    tabell: 'assets' },
  { id: 'droppub',   navn: 'Publiser drop',     ikon: '🛍️', gruppe: 'mija',   kolonne: 4, rad: 6, jobb: 'drop.publish' },
  { id: 'mijaside',  navn: 'mija.no',           ikon: '🌍', gruppe: 'ut',     kolonne: 5, rad: 6, tabell: 'events', tekst: 'Butikk + besøk' },

  { id: 'someplan',  navn: 'Sosial-plan',       ikon: '🧠', gruppe: 'mija',   kolonne: 3, rad: 7, jobb: 'social.plan',   tabell: 'social_posts' },
  { id: 'somepub',   navn: 'Publiser sosialt',  ikon: '📤', gruppe: 'mija',   kolonne: 4, rad: 7, jobb: 'social.publish' },
  { id: 'igtiktok',  navn: 'Instagram + TikTok',ikon: '🎵', gruppe: 'ut',     kolonne: 5, rad: 7, tekst: 'Trafikk til butikken' },

  { id: 'ordre',     navn: 'Betaling',          ikon: '💳', gruppe: 'data',   kolonne: 5, rad: 8, tabell: 'orders' },
  { id: 'fulfill',   navn: 'Levering',          ikon: '📦', gruppe: 'mija',   kolonne: 4, rad: 8, jobb: 'order.fulfill', tabell: 'download_tokens' },
  { id: 'metrics',   navn: 'Måling',            ikon: '📉', gruppe: 'mija',   kolonne: 3, rad: 8, jobb: 'metrics.sync',  tabell: 'social_metrics' },
  { id: 'eksper',    navn: 'Eksperimenter',     ikon: '🧪', gruppe: 'mija',   kolonne: 2, rad: 8, jobb: 'experiment.conclude', tabell: 'experiments' },

  // ── Founders: podcasten som kunnskapsbase ──
  { id: 'rss',       navn: 'Founders RSS',      ikon: '🎙️', gruppe: 'kilde',  kolonne: 0, rad: 10, tekst: 'David Senra' },
  { id: 'episoder',  navn: 'Episoder',          ikon: '📚', gruppe: 'data',   kolonne: 1, rad: 10, tabell: 'podcast_episodes' },
  { id: 'chunks',    navn: 'Vektor-biter',      ikon: '🧩', gruppe: 'data',   kolonne: 2, rad: 10, tabell: 'podcast_chunks' },
  { id: 'llm',       navn: 'Claude',            ikon: '✨', gruppe: 'llm',    kolonne: 3, rad: 10, tekst: 'claude-opus-5' },
  { id: 'dash',      navn: 'Dette dashbordet',  ikon: '🖥️', gruppe: 'ut',     kolonne: 4, rad: 10, tekst: 'localhost:3000' },

  // ── Navet ──
  { id: 'supabase',  navn: 'Supabase',          ikon: '🗄️', gruppe: 'nav',    kolonne: 2, rad: 12, tekst: 'Alt lagres her' },
  { id: 'jobs',      navn: 'Jobbkø',            ikon: '⚙️', gruppe: 'nav',    kolonne: 3, rad: 12, tabell: 'jobs', tekst: 'Motoren' }
];

const KANTER = [
  ['places', 'ringepanel', 'nye bedrifter'],
  ['ringepanel', 'kunder', 'signert'],
  ['kunder', 'sosiale', ''], ['kunder', 'googlebing', ''], ['kunder', 'blogg', ''],
  ['kunder', 'forum', ''], ['kunder', 'synlighet', ''],
  ['sosiale', 'metricool', 'video + bilde'],
  ['googlebing', 'gbp', 'innlegg'],
  ['blogg', 'bloggsite', 'artikkel'],
  ['forum', 'forumut', 'tråd'],
  ['synlighet', 'rapport', 'score'],

  ['trend', 'tema', 'signaler'],
  ['tema', 'dropplan', 'valgt tema'],
  ['dropplan', 'dropbuild', 'brief'],
  ['dropbuild', 'droppub', 'bilder'],
  ['droppub', 'mijaside', 'live'],
  ['dropbuild', 'someplan', 'råmateriale'],
  ['someplan', 'somepub', 'planlagt'],
  ['somepub', 'igtiktok', 'publisert'],
  ['igtiktok', 'mijaside', 'trafikk'],
  ['mijaside', 'ordre', 'kjøp'],
  ['ordre', 'fulfill', 'kvittering'],
  ['fulfill', 'mijaside', 'nedlasting'],
  ['igtiktok', 'metrics', 'tall'],
  ['metrics', 'eksper', 'resultat'],
  ['eksper', 'someplan', 'lærdom'],

  ['rss', 'episoder', 'nye episoder'],
  ['episoder', 'chunks', 'oppdeling'],
  ['chunks', 'llm', 'semantisk søk'],
  ['llm', 'dash', 'svar'],

  ['jobs', 'trend', ''], ['jobs', 'dropbuild', ''], ['jobs', 'somepub', ''], ['jobs', 'fulfill', ''],
  ['supabase', 'jobs', 'køer opp'],
  ['kunder', 'supabase', ''], ['chunks', 'supabase', ''],
  ['ordre', 'supabase', ''], ['someplan', 'supabase', '']
];

// Tabeller vi trenger antall fra — bygges av NODER så de aldri kommer i utakt.
const TABELLER = [...new Set(NODER.map((n) => n.tabell).filter(Boolean))];

router.get('/graf', async (_req, res) => {
  try {
    const tellSql =
      'select ' + TABELLER.map((t) => `(select count(*) from ${t}) as "${t}"`).join(', ');

    const [tell, jobbTall, agentRader, puls, koStatus] = await Promise.all([
      sbSql(tellSql),
      sbSql(`select type, status, count(*) as antall, max(updated_at) as sist
             from jobs group by 1,2`),
      sbSelect('agenter?select=slug,navn,avdeling,ikon,farge,aktiv&order=sort'),
      // Ekte hendelser siste døgn — det er disse som animeres langs kantene
      sbSql(`select type, status, updated_at, coalesce(last_error,'') as feil
             from jobs order by updated_at desc limit 40`),
      sbSql(`select status, count(*) as antall from jobs group by 1`)
    ]);

    const antall = tell[0] || {};
    const perJobb = {};
    for (const r of jobbTall) {
      const j = (perJobb[r.type] ||= { totalt: 0, døde: 0, sist: null });
      j.totalt += Number(r.antall);
      if (r.status === 'dead') j.døde += Number(r.antall);
      if (!j.sist || r.sist > j.sist) j.sist = r.sist;
    }
    const agentInfo = Object.fromEntries(agentRader.map((a) => [a.slug, a]));

    const noder = NODER.map((n) => {
      const a = n.agent ? agentInfo[n.agent] : null;
      const j = n.jobb ? perJobb[n.jobb] : null;
      return {
        ...n,
        navn: a?.navn || n.navn,
        ikon: a?.ikon || n.ikon,
        tekst: a?.avdeling || n.tekst || '',
        antall: n.tabell ? Number(antall[n.tabell] ?? 0) : j ? j.totalt : null,
        enhet: n.tabell ? 'rader' : j ? 'kjøringer' : null,
        sist: j?.sist || null,
        varsel: j?.døde > 0 ? `${j.døde} døde jobber` : a && !a.aktiv ? 'satt på pause' : null
      };
    });

    res.json({
      noder,
      kanter: KANTER.map(([fra, til, etikett]) => ({ fra, til, etikett })),
      puls,
      koStatus,
      oppdatert: new Date().toISOString()
    });
  } catch (e) {
    svarFeil(res, e);
  }
});

// Agentliste med ukeplan og oppgaver — «hvem gjør hva».
router.get('/liste', async (_req, res) => {
  try {
    const [agenter, oppgaver, uke] = await Promise.all([
      sbSelect('agenter?select=*&order=sort'),
      sbSelect('agent_oppgaver?select=*&order=sort'),
      sbSelect('agent_uke?select=*')
    ]);
    res.json({
      agenter: agenter.map((a) => ({
        ...a,
        system_prompt: undefined, // ikke send prompten til nettleseren
        oppgaver: oppgaver.filter((o) => o.agent_id === a.id),
        uke: uke.find((u) => u.agent_id === a.id) || null
      }))
    });
  } catch (e) {
    svarFeil(res, e);
  }
});

module.exports = router;
