// Alt for Mija: salg, betaling, besøk, drops, pakker, nedlastinger og personvern.
const express = require('express');
const { sbSql } = require('../lib/sb');
const { svarFeil } = require('../lib/feil');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [
      tall, omsetningPerDag, ordre, drops, pakker, trafikk,
      nedlastinger, land, jobber, samtykke, eksperimenter
    ] = await Promise.all([
      sbSql(`select
        (select coalesce(sum(amount_cents),0) from orders where status='paid')        as brutto_cents,
        (select coalesce(sum(fee_cents),0) from orders where status='paid')           as gebyr_cents,
        (select coalesce(sum(tax_cents),0) from orders where status='paid')           as mva_cents,
        (select coalesce(sum(payout_cents),0) from orders where status='paid')        as utbetalt_cents,
        (select count(*) from orders where status='paid')                             as ordre_betalt,
        (select count(*) from orders where status='refunded')                         as ordre_refundert,
        (select count(*) from orders)                                                 as ordre_totalt,
        (select count(distinct email_hash) from orders where status='paid')            as kunder,
        (select count(*) from drops)                                                  as drops,
        (select count(*) from drops where status='published')                         as drops_publisert,
        (select count(*) from packs where is_active)                                  as pakker_aktive,
        (select count(*) from assets)                                                 as assets,
        (select count(*) from events)                                                 as besok_hendelser,
        (select count(distinct session_hash) from events)                             as besok_okter,
        (select count(*) from download_events)                                        as nedlastinger,
        (select count(*) from download_events where not ok)                           as nedlastinger_feil,
        (select count(*) from consent_records)                                        as samtykker,
        (select count(*) from dsr_requests)                                           as dsr,
        (select value::text from settings where key='autopilot')                      as autopilot,
        (select value::text from settings where key='next_edition')                   as neste_edition`),

      // Omsetning per dag siste 30 døgn — grunnlag for grafen
      sbSql(`select date_trunc('day', created_at)::date as dag,
                    sum(case when status='paid' then amount_cents else 0 end) as cents,
                    count(*) filter (where status='paid') as antall
             from orders where created_at > now() - interval '30 days'
             group by 1 order by 1`),

      sbSql(`select o.status, round(o.amount_cents/100.0,2) as belop, o.currency, o.country_code,
                    o.created_at, o.provider,
                    (select string_agg(oi.pack_title, ', ') from order_items oi where oi.order_id = o.id) as pakker
             from orders o order by o.created_at desc limit 30`),

      sbSql(`select d.slug, d.title, d.status, d.edition, d.published_at, d.accent_color,
                    d.build_cost_usd,
                    (select count(*) from assets a where a.drop_id = d.id) as assets,
                    (select count(*) from packs p where p.drop_id = d.id) as pakker
             from drops d order by d.edition desc limit 30`),

      sbSql(`select p.title, p.slug, p.price_cents, p.currency, p.asset_count, p.is_active,
                    (select count(*) from order_items oi where oi.pack_id = p.id) as solgt,
                    (select coalesce(sum(oi.price_cents),0) from order_items oi where oi.pack_id = p.id) as inntekt_cents
             from packs p order by 7 desc, p.price_cents desc limit 30`),

      // Besøk: events-tabellen fylles av nettsiden
      sbSql(`select name, count(*) as antall, count(distinct session_hash) as okter
             from events group by 1 order by 2 desc limit 15`),

      sbSql(`select date_trunc('day', created_at)::date as dag, count(*) as antall,
                    count(*) filter (where not ok) as feilet
             from download_events group by 1 order by 1 desc limit 14`),

      sbSql(`select coalesce(country_code,'?') as land, count(*) as antall,
                    sum(case when status='paid' then amount_cents else 0 end) as cents
             from orders group by 1 order by 2 desc limit 12`),

      sbSql(`select type, status, count(*) as antall, max(updated_at) as sist
             from jobs group by 1,2 order by 3 desc limit 25`),

      sbSql(`select action, count(*) as antall from consent_records group by 1 order by 2 desc limit 8`),

      sbSql(`select key, name, status, dimension, winner, confidence, started_at, concluded_at
             from experiments order by started_at desc nulls last limit 10`)
    ]);

    res.json({
      tall: tall[0], omsetningPerDag, ordre, drops, pakker, trafikk,
      nedlastinger, land, jobber, samtykke, eksperimenter
    });
  } catch (e) {
    svarFeil(res, e);
  }
});

module.exports = router;
