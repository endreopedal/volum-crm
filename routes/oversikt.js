// Komplett oversikt på tvers av alle systemer — én spørring, ett svar.
const express = require('express');
const { sbSql } = require('../lib/sb');

const router = express.Router();

const SPORRING = `
select
  (select count(*) from crm_leads)                                            as leads_totalt,
  (select count(*) from crm_leads where status = 'LEADs')                     as leads_nye,
  (select count(*) from crm_leads where level = 'Møte booket')                as leads_moter,
  (select count(*) from crm_leads where created_at > now() - interval '7 days') as leads_uke,
  (select count(*) from kunder)                                               as kunder_totalt,
  (select count(*) from kunder where kunde_status not in ('inaktiv','pause')) as kunder_aktive,
  (select count(*) from agenter where aktiv)                                  as agenter_aktive,
  (select count(*) from podcast_episodes)                                     as episoder,
  (select count(*) from podcast_chunks)                                       as chunks,
  (select count(*) from drops)                                                as drops_totalt,
  (select count(*) from drops where status = 'published')                     as drops_publisert,
  (select count(*) from assets)                                               as assets,
  (select coalesce(sum(amount_cents),0) from orders where status='paid')       as omsetning_cents,
  (select count(*) from orders where status='paid')                           as ordre_betalt,
  (select count(*) from social_posts)                                         as poster_totalt,
  (select count(*) from social_posts where status='published')                as poster_publisert,
  (select count(*) from social_posts where status='awaiting_approval')        as poster_venter,
  (select count(*) from blogg_innlegg)                                        as blogginnlegg,
  (select count(*) from bedrift_ideer)                                        as ideer,
  (select count(*) from jobs where status in ('queued','running'))            as jobber_kø,
  (select count(*) from jobs where status = 'dead')                           as jobber_døde,
  (select count(*) from kalender_oppgaver where status <> 'ferdig')           as oppgaver_åpne,
  (select value::text from settings where key = 'autopilot')                  as autopilot
`;

router.get('/', async (_req, res) => {
  try {
    const [tall] = await sbSql(SPORRING);

    const [pipeline, siste, kunder, jobber] = await Promise.all([
      // Salgstrakten: hvor mange leads står på hvert nivå
      sbSql(`select coalesce(level,'Ukjent') as nivaa, count(*) as antall
             from crm_leads group by 1 order by 2 desc`),
      // Siste aktivitet på tvers av systemene, samlet i én tidslinje
      sbSql(`select * from (
        (select 'lead' as type, name as tekst, created_at as tid from crm_leads order by created_at desc limit 6)
        union all
        (select 'ordre', 'Salg ' || round(amount_cents/100.0,2)::text || ' ' || currency, created_at from orders where status='paid' order by created_at desc limit 5)
        union all
        (select 'drop', title, published_at from drops where published_at is not null order by published_at desc limit 5)
        union all
        (select 'blogg', tittel, created_at from blogg_innlegg order by created_at desc limit 4)
        union all
        (select 'jobb', type || ' → ' || status, updated_at from jobs order by updated_at desc limit 6)
      ) t order by tid desc nulls last limit 18`),
      sbSql(`select navn, bransje, by, kunde_status, siste_score, google_rating, google_antall
             from kunder order by opprettet desc`),
      sbSql(`select status, count(*) as antall from jobs group by 1 order by 2 desc`)
    ]);

    res.json({ tall, pipeline, siste, kunder, jobber });
  } catch (e) {
    res.status(500).json({ feil: e.message });
  }
});

module.exports = router;
