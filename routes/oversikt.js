// Komplett oversikt på tvers av alle systemer — én spørring, ett svar.
const express = require('express');
const { sbSql } = require('../lib/sb');
const { svarFeil } = require('../lib/feil');

const router = express.Router();

// Alt som krever handling, samlet ett sted. Hver rad vet hvor den hører hjemme,
// så det går an å klikke seg rett til problemet.
const HANDLINGER = `select * from (
  select 'jobb-dod' as slag, 'kritisk' as vekt, count(*) as antall,
         'jobber har gitt opp' as tekst,
         coalesce(string_agg(distinct type, ', '), '') as detalj, 'agenter' as side
    from jobs where status = 'dead' having count(*) > 0
  union all
  select 'oppgave-forfalt', 'kritisk', count(*), 'oppgaver er over fristen',
         coalesce(min(tittel), ''), 'daglig'
    from kalender_oppgaver where status <> 'ferdig' and forfaller < current_date having count(*) > 0
  union all
  select 'post-venter', 'advarsel', count(*), 'poster venter på godkjenning',
         coalesce(string_agg(distinct platform, ', '), ''), 'sosialt'
    from social_posts where status = 'awaiting_approval' having count(*) > 0
  union all
  select 'post-feilet', 'kritisk', count(*), 'poster feilet ved publisering',
         coalesce(string_agg(distinct platform, ', '), ''), 'sosialt'
    from social_posts where status = 'failed' having count(*) > 0
  union all
  select 'ordre-refundert', 'advarsel', count(*), 'ordre er refundert siste 30 dager', '', 'mija'
    from orders where status = 'refunded' and created_at > now() - interval '30 days' having count(*) > 0
  union all
  select 'nedlasting-feilet', 'advarsel', count(*), 'nedlastinger feilet', '', 'mija'
    from download_events where not ok and created_at > now() - interval '30 days' having count(*) > 0
  union all
  select 'kunde-pause', 'advarsel', count(*), 'kunder står på pause eller er inaktive',
         coalesce(string_agg(navn, ', '), ''), 'oversikt'
    from kunder where kunde_status in ('pause','inaktiv') having count(*) > 0
  union all
  select 'lead-stille', 'info', count(*), 'leads har ligget urørt i over 30 dager', '', 'leads'
    from crm_leads where level = 'Første kontakt' and created_at < now() - interval '30 days' having count(*) > 0
  union all
  select 'drop-klar', 'info', count(*), 'drops er ferdig bygget, men ikke publisert',
         coalesce(string_agg(title, ', '), ''), 'mija'
    from drops where status = 'ready' having count(*) > 0
) h order by case vekt when 'kritisk' then 0 when 'advarsel' then 1 else 2 end, antall desc`;

// Sammenlikner de siste sju dagene med de sju før, så tallene får retning.
const TRENDER = `select
  (select count(*) from crm_leads where created_at > now() - interval '7 days') as leads_na,
  (select count(*) from crm_leads where created_at between now() - interval '14 days' and now() - interval '7 days') as leads_for,
  (select coalesce(sum(amount_cents),0) from orders where status='paid' and created_at > now() - interval '7 days') as salg_na,
  (select coalesce(sum(amount_cents),0) from orders where status='paid' and created_at between now() - interval '14 days' and now() - interval '7 days') as salg_for,
  (select count(*) from social_posts where published_at > now() - interval '7 days') as poster_na,
  (select count(*) from social_posts where published_at between now() - interval '14 days' and now() - interval '7 days') as poster_for,
  (select count(*) from jobs where updated_at > now() - interval '7 days') as jobber_na,
  (select count(*) from jobs where updated_at between now() - interval '14 days' and now() - interval '7 days') as jobber_for`;

// Daglig forløp til sparklines bak nøkkeltallene.
const FORLOP = `select * from (
  select 'leads' as serie, d::date as dag,
         (select count(*) from crm_leads l where l.created_at::date = d::date) as verdi
    from generate_series(now() - interval '13 days', now(), interval '1 day') d
  union all
  select 'salg', d::date,
         (select coalesce(sum(amount_cents),0) from orders o where o.status='paid' and o.created_at::date = d::date)
    from generate_series(now() - interval '13 days', now(), interval '1 day') d
  union all
  select 'jobber', d::date,
         (select count(*) from jobs j where j.updated_at::date = d::date)
    from generate_series(now() - interval '13 days', now(), interval '1 day') d
) f order by serie, dag`;

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

    const [pipeline, siste, kunder, jobber, handlinger, trender, forlop] = await Promise.all([
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
      sbSql(`select status, count(*) as antall from jobs group by 1 order by 2 desc`),
      sbSql(HANDLINGER),
      sbSql(TRENDER),
      sbSql(FORLOP)
    ]);

    // Forløpet grupperes per serie, så frontend bare trenger en liste med tall.
    const gnister = {};
    for (const r of forlop) (gnister[r.serie] ||= []).push(Number(r.verdi) || 0);

    res.json({ tall, pipeline, siste, kunder, jobber, handlinger, trender: trender[0], gnister });
  } catch (e) {
    svarFeil(res, e);
  }
});

module.exports = router;
