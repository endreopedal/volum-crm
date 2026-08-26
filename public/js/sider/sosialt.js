/* Sosiale medier — Mija (IG/TikTok) og Volum + kundene (Metricool, Google/Bing). */
(() => {
const { useApi, n, kr, nar, dato, kortDato, Laster, Feil, Kort, TallKort, Lapp,
        StatusLapp, Topp, Tabell, Tom, Stolper, Rangering, Fordeling, serie } = window.K;

const KANAL_IKON = { instagram: '📸', tiktok: '🎵', facebook: '👥', linkedin: '💼', x: '𝕏' };

function Sosialt() {
  const { data, feil, laster, hentPaNytt } = useApi('/api/sosialt');
  if (laster) return <Laster tekst="Henter poster og tall …" />;
  if (feil) return <Feil melding={feil} paNytt={hentPaNytt} />;

  const { tall: t, perPlattform, perStatus, kommende, publisert, perDag, ytelse, kundeinnhold, volumposter, playbook } = data;

  const visninger = Number(t.visninger || 0);
  const ingenMaling = Number(t.malinger || 0) === 0;
  const auto = String(t.auto_publiser).includes('true');
  const pauseTil = String(t.pause_til || '').replace(/"/g, '');
  const iPause = pauseTil && new Date(pauseTil) > new Date();
  const engasjement = visninger
    ? ((Number(t.likes) + Number(t.kommentarer)) / visninger * 100).toFixed(1) + ' %'
    : '–';

  return (
    <>
      <Topp tittel="Sosiale medier"
            under="Mija poster automatisk til Instagram og TikTok. Kundene får sitt via Metricool. Volum poster sitt eget.">
        <Lapp type={auto ? 'god' : 'adv'}>{auto ? '● publiserer automatisk' : '○ krever godkjenning'}</Lapp>
        {iPause && <Lapp type="adv">pause til {dato(pauseTil)}</Lapp>}
        <button className="kn" onClick={() => hentPaNytt(true)}>↻</button>
      </Topp>

      {Number(t.venter) > 0 && (
        <div className="beskjed beskjed-adv">
          <span>✋</span>
          <div><b>{n(t.venter)} poster venter på godkjenning.</b> De går ikke ut før noen sier ja —
            se «Klar til å gå ut» under.</div>
        </div>
      )}

      <div className="rutenett r4" style={{ marginBottom: 14 }}>
        <TallKort merk="Poster totalt" verdi={n(t.poster)}
          under={`${n(t.publisert)} publisert`} />
        <TallKort merk="Venter på deg" verdi={n(t.venter)}
          under={Number(t.feilet) ? <Lapp type="kri">{n(t.feilet)} feilet</Lapp> : 'ingen feilet'}
          farge={Number(t.venter) ? 'var(--serie-4)' : undefined} />
        <TallKort merk="Visninger" verdi={n(visninger)}
          under={ingenMaling ? <Lapp type="adv">ingen målinger ennå</Lapp> : `${engasjement} engasjement`} />
        <TallKort merk="Salg fra sosialt" verdi={n(t.tilskrevne_ordre)}
          under={Number(t.tilskrevet_cents) ? kr(t.tilskrevet_cents) : 'ikke målt ennå'}
          farge={Number(t.tilskrevne_ordre) ? 'var(--serie-3)' : undefined} />
      </div>

      {ingenMaling && (
        <div className="beskjed beskjed-adv">
          <span>📉</span>
          <div><b>Ingen resultattall.</b> <code>social_metrics</code> er tom — <code>metrics.sync</code>-jobben
            har ikke hentet visninger og likes fra plattformene ennå. Publiseringen fungerer;
            det er bare målingen som mangler.</div>
        </div>
      )}

      <div className="rutenett r32" style={{ marginBottom: 14 }}>
        <Kort tittel="Publiseringstakt" hint="Poster per dag siste 30 døgn, publisert og planlagt.">
          <Stolper rader={perDag.map((r) => ({ etikett: kortDato(r.dag), verdi: r.antall }))}
                   farge="var(--serie-1)" />
        </Kort>
        <Kort tittel="Fordelt på status">
          <Fordeling rader={perStatus.map((s) => ({
            etikett: s.status, verdi: s.antall,
            farge: s.status === 'published' ? 'var(--serie-3)'
              : s.status === 'failed' ? 'var(--kritisk)'
              : s.status === 'awaiting_approval' ? 'var(--serie-4)' : serie(0)
          }))} />
          <div style={{ marginTop: 18 }}>
            <div className="kort-hint">Per kanal</div>
            <Rangering rader={perPlattform.map((p, i) => ({
              etikett: `${KANAL_IKON[p.platform] || '•'} ${p.platform}`, verdi: p.antall, farge: serie(i)
            }))} />
          </div>
        </Kort>
      </div>

      <div className="rutenett r2" style={{ marginBottom: 14 }}>
        <Kort tittel="Klar til å gå ut" hoyre={`${kommende.length} planlagt`}
              hint="Neste poster i køen, tidligste først.">
          <Tabell
            kolonner={[
              { n: 'Kanal', vis: (r) => <span>{KANAL_IKON[r.platform] || '•'} {r.platform}</span> },
              { n: 'Tekst', vis: (r) => <span className="klipp" title={r.caption}>{r.caption || '–'}</span> },
              { n: 'Status', vis: (r) => <StatusLapp status={r.status} /> },
              { n: 'Går ut', num: true, vis: (r) => <span className="dempet">{nar(r.scheduled_at)}</span> }
            ]}
            rader={kommende} tomTekst="Ingenting står i kø." />
        </Kort>

        <Kort tittel="Sist publisert" hoyre={`${publisert.length} siste`}>
          <Tabell
            kolonner={[
              { n: 'Kanal', vis: (r) => <span>{KANAL_IKON[r.platform] || '•'} {r.platform}</span> },
              { n: 'Tekst', vis: (r) => r.external_url
                ? <a className="klipp" href={r.external_url} target="_blank" rel="noreferrer"
                     style={{ display: 'block' }} title={r.caption}>{r.caption || '–'} ↗</a>
                : <span className="klipp" title={r.caption}>{r.caption || '–'}</span> },
              { n: 'Når', num: true, vis: (r) => <span className="dempet">{nar(r.published_at)}</span> }
            ]}
            rader={publisert} tomTekst="Ingenting publisert ennå." />
        </Kort>
      </div>

      <div className="rutenett r2" style={{ marginBottom: 14 }}>
        <Kort tittel="Beste poster" hint="Sortert på visninger. Krever at metrics.sync har kjørt.">
          {ytelse.length ? (
            <Tabell
              kolonner={[
                { n: 'Kanal', vis: (r) => <span>{KANAL_IKON[r.platform] || '•'}</span> },
                { n: 'Tekst', vis: (r) => <span className="klipp" title={r.caption}>{r.caption}</span> },
                { n: 'Visninger', num: true, vis: (r) => n(r.impressions) },
                { n: 'Likes', num: true, vis: (r) => n(r.likes) },
                { n: 'Klikk', num: true, vis: (r) => n(r.clicks) },
                { n: 'Salg', num: true, vis: (r) => n(r.attributed_orders) }
              ]}
              rader={ytelse} />
          ) : <Tom ikon="📊" tekst="Ingen målinger hentet inn ennå." />}
        </Kort>

        <Kort tittel="Kundenes uke" hint="Innhold Volum lager og sender til Metricool for hver kunde.">
          <Tabell
            kolonner={[
              { n: 'Kunde', vis: (r) => <span className="klipp">{r.navn || '–'}</span> },
              { n: 'Uke', vis: (r) => <span className="dempet">{dato(r.uke_start)}</span> },
              { n: 'Video', num: true, felt: 'videoer' },
              { n: 'Bilde', num: true, felt: 'bilder' },
              { n: 'Sendt', num: true, vis: (r) => r.sendt_metricool_dato
                ? <Lapp type="god">ja</Lapp> : <Lapp type="adv">nei</Lapp> }
            ]}
            rader={kundeinnhold} tomTekst="Ingen ukesleveranser registrert." />
        </Kort>
      </div>

      <div className="rutenett r2">
        <Kort tittel="Volum sine egne poster" hoyre={`${volumposter.length} uker`}>
          <Tabell
            kolonner={[
              { n: 'Uke', vis: (r) => dato(r.uke_start) },
              { n: 'Konsept', vis: (r) => <span className="klipp" title={r.konsept}>{r.konsept || '–'}</span> },
              { n: 'Status', vis: (r) => <StatusLapp status={r.status} /> },
              { n: 'Planlagt', num: true, vis: (r) => <span className="dempet">{dato(r.planlagt_dato)}</span> }
            ]}
            rader={volumposter} tomTekst="Ingen Volum-poster planlagt." />
        </Kort>

        <Kort tittel="Lærdommer" hint="Regler systemet har lært av egne resultater — tyngste øverst.">
          {playbook.length ? (
            <div>
              {playbook.map((p, i) => (
                <div key={i} className="tid-rad" style={{ alignItems: 'flex-start' }}>
                  <div className="tid-ikon">💡</div>
                  <div className="tid-tekst">
                    <div>{p.rule}</div>
                    <div className="dempet" style={{ fontSize: 11.5, marginTop: 2 }}>
                      {p.platform || p.scope || 'generelt'} · vekt {p.weight}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <Tom ikon="💡" tekst="Ingen lærdommer registrert ennå." />}
          <div className="rutenett r3" style={{ marginTop: 16 }}>
            <TallKort merk="Blogg" verdi={n(t.blogginnlegg)} under="innlegg" />
            <TallKort merk="Forum" verdi={n(t.forumposter)} under="tråder" />
            <TallKort merk="Kunde-uker" verdi={n(t.kunde_uker)} under="levert" />
          </div>
        </Kort>
      </div>
    </>
  );
}

window.Sider = window.Sider || {};
window.Sider.sosialt = Sosialt;
})();
