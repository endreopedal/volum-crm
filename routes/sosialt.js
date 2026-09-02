// Sosiale medier: Mija (Instagram/TikTok) og Volum + kundene (Metricool, Google/Bing).
const express = require('express');
const { sbSql } = require('../lib/sb');
const { svarFeil } = require('../lib/feil');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [tall, perPlattform, perStatus, kommende, publisert, perDag, ytelse, kundeinnhold, volumposter, playbook] =
      await Promise.all([
        sbSql(`select
          (select count(*) from social_posts)                                  as poster,
          (select count(*) from social_posts where status='published')         as publisert,
          (select count(*) from social_posts where status='awaiting_approval') as venter,
          (select count(*) from social_posts where status='scheduled')         as planlagt,
          (select count(*) from social_posts where status='failed')            as feilet,
          (select count(*) from social_metrics)                                as malinger,
          (select coalesce(sum(impressions),0) from social_metrics)            as visninger,
          (select coalesce(sum(likes),0) from social_metrics)                  as likes,
          (select coalesce(sum(comments),0) from social_metrics)               as kommentarer,
          (select coalesce(sum(clicks),0) from social_metrics)                 as klikk,
          (select coalesce(sum(attributed_orders),0) from social_metrics)      as tilskrevne_ordre,
          (select coalesce(sum(attributed_cents),0) from social_metrics)       as tilskrevet_cents,
          (select count(*) from volum_uke_poster)                              as volum_poster,
          (select count(*) from ukentlig_innhold)                              as kunde_uker,
          (select count(*) from blogg_innlegg)                                 as blogginnlegg,
          (select count(*) from forum_historikk)                               as forumposter,
          (select value::text from settings where key='some.publiser_automatisk') as auto_publiser,
          (select value::text from settings where key='some.videoer_per_dag')     as per_dag,
          (select value::text from settings where key='some.pause_til')           as pause_til`),

        sbSql(`select platform, count(*) as antall,
                      count(*) filter (where status='published') as publisert,
                      count(*) filter (where status='awaiting_approval') as venter
               from social_posts group by 1 order by 2 desc`),

        sbSql(`select status, count(*) as antall from social_posts group by 1 order by 2 desc`),

        sbSql(`select platform, status, left(coalesce(caption,''),120) as caption, hashtags,
                      scheduled_at, external_url
               from social_posts where scheduled_at is not null and published_at is null
               order by scheduled_at asc limit 30`),

        sbSql(`select platform, status, left(coalesce(caption,''),120) as caption,
                      published_at, external_url, error
               from social_posts where published_at is not null
               order by published_at desc limit 25`),

        // Publiseringstakt siste 30 dager
        sbSql(`select date_trunc('day', coalesce(published_at, scheduled_at))::date as dag,
                      count(*) as antall,
                      count(*) filter (where status='published') as publisert
               from social_posts
               where coalesce(published_at, scheduled_at) > now() - interval '30 days'
               group by 1 order by 1`),

        // Beste poster målt i visninger
        sbSql(`select sp.platform, left(coalesce(sp.caption,''),90) as caption, sp.published_at,
                      sm.impressions, sm.likes, sm.comments, sm.clicks, sm.attributed_orders
               from social_metrics sm join social_posts sp on sp.id = sm.social_post_id
               order by sm.impressions desc nulls last limit 12`),

        // Kundenes ukentlige innhold via Metricool
        sbSql(`select k.navn, u.uke_start, u.publiseringsdato, u.sendt_metricool_dato,
                      jsonb_array_length(coalesce(u.videoer,'[]'::jsonb)) as videoer,
                      jsonb_array_length(coalesce(u.bilder,'[]'::jsonb)) as bilder
               from ukentlig_innhold u left join kunder k on k.id = u.kunde_id
               order by u.uke_start desc limit 15`),

        sbSql(`select uke_start, konsept, status, planlagt_dato, plattformer from volum_uke_poster
               order by uke_start desc limit 15`),

        sbSql(`select scope, platform, rule, weight, active from playbook
               where active order by weight desc limit 15`)
      ]);

    res.json({
      tall: tall[0], perPlattform, perStatus, kommende, publisert, perDag,
      ytelse, kundeinnhold, volumposter, playbook
    });
  } catch (e) {
    svarFeil(res, e);
  }
});

module.exports = router;
