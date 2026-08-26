// Founders-podcasten som kunnskapsbase.
//
// Flyten er den samme som i det gamle prosjektet:
//   spørsmål → OpenAI-embedding (1536d) → match_chunks() i Supabase → Claude med chunkene som kontekst
// De 448 episodene og 11 000 chunkene ligger allerede i podcast_episodes / podcast_chunks.
const express = require('express');
const { sbSql, sbRpc, sbSelect } = require('../lib/sb');
const { spor, embed, harClaude, harEmbedding } = require('../lib/llm');

const router = express.Router();

const SYSTEM = `Du er en analytiker som kan hele Founders-podcasten (David Senra) utenat.

Du får utdrag fra ekte episode-transkripsjoner. Svar på norsk, med mindre brukeren spør på engelsk.

Regler:
- Svar KUN ut fra utdragene du får. Er ikke svaret der, si det rett ut — ikke dikt opp.
- Referer alltid til grunnleggeren og episoden, f.eks. «(#423 Soichiro Honda)».
- Trekk fram det konkrete: hva personen faktisk gjorde, ikke abstrakte leksjoner.
- Er det mønstre på tvers av flere grunnleggere, si hvem som deler mønsteret.
- Vær direkte og konsis. Ingen innledning som gjentar spørsmålet.`;

// Statistikk + episodeliste til venstrekolonnen.
router.get('/', async (_req, res) => {
  try {
    const [statistikk, episoder, perAar] = await Promise.all([
      sbSql(`select (select count(*) from podcast_episodes) as episoder,
                    (select count(*) from podcast_chunks) as chunks,
                    (select min(published_at) from podcast_episodes) as forste,
                    (select max(published_at) from podcast_episodes) as siste`),
      sbSql(`select e.id, e.title, e.published_at, left(coalesce(e.shownotes,''), 220) as shownotes,
                    (select count(*) from podcast_chunks c where c.episode_id = e.id) as chunks
             from podcast_episodes e order by e.published_at desc nulls last limit 60`),
      sbSql(`select extract(year from published_at)::int as aar, count(*) as antall
             from podcast_episodes where published_at is not null group by 1 order by 1`)
    ]);
    res.json({
      statistikk: statistikk[0],
      episoder,
      perAar,
      klar: harClaude() && harEmbedding(),
      mangler: [
        !harEmbedding() && 'OPENAI_API_KEY (embeddings for søk)',
        !harClaude() && 'ANTHROPIC_API_KEY (Claude for svar)'
      ].filter(Boolean)
    });
  } catch (e) {
    res.status(500).json({ feil: e.message });
  }
});

// Selve spørsmålet: semantisk søk → Claude.
router.post('/spor', async (req, res) => {
  try {
    const sporsmal = (req.body?.sporsmal || '').trim();
    if (!sporsmal) return res.status(400).json({ feil: 'Skriv et spørsmål først.' });
    if (!harEmbedding() || !harClaude()) {
      return res.status(400).json({
        feil: `Mangler nøkkel i .env: ${[!harEmbedding() && 'OPENAI_API_KEY', !harClaude() && 'ANTHROPIC_API_KEY'].filter(Boolean).join(' og ')}`
      });
    }

    const antall = Math.min(Math.max(Number(req.body?.antall) || 14, 4), 30);
    const vektor = await embed(sporsmal);
    const treff = await sbRpc('match_chunks', { query_embedding: vektor, match_count: antall });

    if (!treff.length) return res.json({ sporsmal, svar: 'Fant ingen relevante utdrag.', kilder: [] });

    const kontekst = treff
      .map((t, i) => {
        const tid = t.start_seconds ? ` @ ${Math.floor(t.start_seconds / 60)} min` : '';
        return `[${i + 1}] ${t.episode_title}${tid}\n${t.content}`;
      })
      .join('\n\n---\n\n');

    const svar = await spor(SYSTEM, `Spørsmål: ${sporsmal}\n\nUtdrag fra episodene:\n\n${kontekst}`, {
      maxTokens: 3000,
      effort: 'high'
    });

    res.json({
      sporsmal,
      svar,
      kilder: treff.map((t) => ({
        episode: t.episode_title,
        dato: t.episode_date,
        minutt: t.start_seconds ? Math.floor(t.start_seconds / 60) : null,
        likhet: Math.round((t.similarity || 0) * 100),
        utdrag: (t.content || '').slice(0, 260)
      }))
    });
  } catch (e) {
    res.status(500).json({ feil: e.message });
  }
});

// Hele shownotes for én episode.
router.get('/episode/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ feil: 'Ugyldig episode-id' });
    const rader = await sbSelect(`podcast_episodes?id=eq.${id}&select=id,title,published_at,shownotes,audio_url,chapters`);
    if (!rader.length) return res.status(404).json({ feil: 'Fant ikke episoden' });
    res.json(rader[0]);
  } catch (e) {
    res.status(500).json({ feil: e.message });
  }
});

module.exports = router;
