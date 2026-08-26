/* Oversikt — alt på ett brett. */
(() => {
const { useApi, n, kr, nar, Laster, Feil, Kort, TallKort, Lapp, Topp, Tabell, Rangering, Fordeling, serie } = window.K;

const IKON = { lead: '🎯', ordre: '💳', drop: '🛍️', blogg: '✍️', jobb: '⚙️' };

function Oversikt({ gaTil }) {
  const { data, feil, laster, hentPaNytt } = useApi('/api/oversikt');
  if (laster) return <Laster tekst="Henter status fra alle systemene …" />;
  if (feil) return <Feil melding={feil} paNytt={hentPaNytt} />;

  const { tall: t, pipeline, siste, kunder, jobber } = data;
  const omsetning = Number(t.omsetning_cents || 0);
  const doede = Number(t.jobber_døde || 0);
  const autopilot = String(t.autopilot).includes('true');

  return (
    <>
      <Topp tittel="Oversikt" under="Alt du driver med, samlet. Tallene er live fra Supabase.">
        <button className="kn" onClick={() => hentPaNytt(true)}>↻ Oppdater</button>
      </Topp>

      {doede > 0 && (
        <div className="beskjed beskjed-kri">
          <span>🛑</span>
          <div><b>{doede} {doede === 1 ? 'jobb har' : 'jobber har'} gitt opp.</b>{' '}
            Automatikken kjører videre på resten, men disse må ses på.{' '}
            <button className="kn kn-s" style={{ marginLeft: 6 }} onClick={() => gaTil('agenter')}>Se agentene</button>
          </div>
        </div>
      )}

      <div className="rutenett r4" style={{ marginBottom: 14 }}>
        <TallKort merk="Leads" verdi={n(t.leads_totalt)}
          under={<><Lapp type="inf">{n(t.leads_uke)} nye denne uka</Lapp></>} />
        <TallKort merk="Møter booket" verdi={n(t.leads_moter)}
          under={`av ${n(t.leads_nye)} i «LEADs»`} farge="var(--serie-3)" />
        <TallKort merk="Kunder" verdi={n(t.kunder_totalt)}
          under={`${n(t.kunder_aktive)} aktive akkurat nå`} />
        <TallKort merk="Omsetning Mija" verdi={kr(omsetning)}
          under={`${n(t.ordre_betalt)} betalte ordre`} farge="var(--serie-4)" />
      </div>

      <div className="rutenett r4" style={{ marginBottom: 14 }}>
        <TallKort merk="Agenter" verdi={n(t.agenter_aktive)}
          under={<><span className={autopilot ? 'puls' : ''} />{autopilot ? 'autopilot på' : 'autopilot av'}</>} />
        <TallKort merk="Poster i kø" verdi={n(t.poster_venter)}
          under={`${n(t.poster_publisert)} publisert totalt`} />
        <TallKort merk="Podcast-biter" verdi={n(t.chunks)}
          under={`fra ${n(t.episoder)} episoder`} />
        <TallKort merk="Bedriftsideer" verdi={n(t.ideer)}
          under="klikk for å se dem" onClick={() => gaTil('ideer')} />
      </div>

      <div className="rutenett r23" style={{ marginBottom: 14 }}>
        <Kort tittel="Salgstrakten" hint="Hvor de 150+ leadsene står akkurat nå.">
          <Rangering rader={pipeline.map((p) => ({ etikett: p.nivaa, verdi: p.antall }))}
                     farge="var(--serie-1)" />
        </Kort>

        <Kort tittel="Siste aktivitet" hoyre="alle systemer">
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {siste.map((s, i) => (
              <div className="tid-rad" key={i}>
                <div className="tid-ikon">{IKON[s.type] || '•'}</div>
                <div className="tid-tekst klipp" title={s.tekst}>{s.tekst}</div>
                <div className="tid-nar">{nar(s.tid)}</div>
              </div>
            ))}
          </div>
        </Kort>
      </div>

      <div className="rutenett r2">
        <Kort tittel="Kundene" hoyre={`${kunder.length} totalt`}>
          <Tabell
            kolonner={[
              { n: 'Kunde', vis: (r) => <div><div style={{ fontWeight: 600 }}>{r.navn}</div>
                <div className="dempet" style={{ fontSize: 12 }}>{r.bransje} · {r.by}</div></div> },
              { n: 'Status', vis: (r) => <Lapp type={r.kunde_status === 'inaktiv' ? '' : r.kunde_status === 'pause' ? 'adv' : 'god'}>{r.kunde_status || '–'}</Lapp> },
              { n: 'AI-score', num: true, vis: (r) => r.siste_score != null ? Math.round(r.siste_score) + ' %' : '–' },
              { n: 'Google', num: true, vis: (r) => r.google_rating ? `${r.google_rating} ★ (${r.google_antall})` : '–' }
            ]}
            rader={kunder} tomTekst="Ingen kunder lagt inn ennå." />
        </Kort>

        <Kort tittel="Jobbkøen" hint="Motoren bak Mija. «done» er ferdig, «dead» ga opp.">
          <Fordeling rader={jobber.map((j) => ({
            etikett: j.status, verdi: j.antall,
            farge: j.status === 'dead' ? 'var(--kritisk)' : j.status === 'done' ? 'var(--serie-3)' : serie(2)
          }))} />
          <div className="rutenett r2" style={{ marginTop: 16 }}>
            <TallKort merk="I kø / kjører" verdi={n(t.jobber_kø)} under="venter på tur" />
            <TallKort merk="Åpne oppgaver" verdi={n(t.oppgaver_åpne)} under="i kalenderen" />
          </div>
        </Kort>
      </div>
    </>
  );
}

window.Sider = window.Sider || {};
window.Sider.oversikt = Oversikt;
})();
