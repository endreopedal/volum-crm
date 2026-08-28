/* Oversikt — hva krever handling, og hvordan ligger vi an. */
(() => {
const { useApi, useAutoOppfrisk, n, kort, kr, nar, SkjelettSide, Feil, Kort, TallKort,
        Trend, Lapp, Topp, Tabell, Rangering, Fordeling, Tom, serie } = window.K;

const IKON = { lead: '🎯', ordre: '💳', drop: '🛍️', blogg: '✍️', jobb: '⚙️' };

const VEKT = {
  kritisk:  { ikon: '🔴', bak: 'var(--kri-glo)',  blekk: 'var(--kri-blekk)' },
  advarsel: { ikon: '🟡', bak: 'var(--adv-glo)',  blekk: 'var(--adv-blekk)' },
  info:     { ikon: '🔵', bak: 'var(--inf-glo)',  blekk: 'var(--inf-blekk)' }
};

function Handlinger({ handlinger, gaTil }) {
  if (!handlinger?.length) {
    return (
      <Tom ikon="✨" tittel="Ingenting krever handling."
           tekst="Ingen døde jobber, ingen forfalte oppgaver, ingenting som venter. Fint sted å være." />
    );
  }
  return (
    <div>
      {handlinger.map((h, i) => {
        const v = VEKT[h.vekt] || VEKT.info;
        return (
          <button className="handling" key={i} onClick={() => gaTil(h.side)}>
            <div className="handling-ikon" style={{ background: v.bak }}>{v.ikon}</div>
            <div className="handling-tekst">
              <div className="handling-tittel">
                <span style={{ color: v.blekk }}>{n(h.antall)}</span> {h.tekst}
              </div>
              {h.detalj && <div className="handling-under klipp" title={h.detalj}>{h.detalj}</div>}
            </div>
            <span className="handling-pil">›</span>
          </button>
        );
      })}
    </div>
  );
}

function Oversikt({ gaTil }) {
  const { data, feil, laster, hentPaNytt } = useApi('/api/oversikt');
  useAutoOppfrisk(hentPaNytt, 90);

  if (laster) return <SkjelettSide />;
  if (feil) return <Feil melding={feil} paNytt={hentPaNytt} />;

  const { tall: t, pipeline, siste, kunder, jobber, handlinger, trender, gnister } = data;
  const autopilot = String(t.autopilot).includes('true');
  const kritiske = handlinger.filter((h) => h.vekt === 'kritisk').length;

  return (
    <>
      <Topp tittel="Oversikt" under="Alt du driver med, samlet. Tallene er live fra Supabase og friskes opp av seg selv.">
        <span className="rad" style={{ fontSize: 12, color: 'var(--blekk-3)' }}>
          <span className={autopilot ? 'puls' : ''} />
          {autopilot ? 'autopilot på' : 'autopilot av'}
        </span>
        <button className="kn" onClick={() => hentPaNytt(true)}>↻ Oppdater</button>
      </Topp>

      <div className="rutenett r4" style={{ marginBottom: 13 }}>
        <TallKort merk="Leads" verdi={n(t.leads_totalt)} gnist={gnister.leads}
          trend={<Trend na={trender.leads_na} for={trender.leads_for} />}
          under={`${n(t.leads_uke)} nye denne uka`} />
        <TallKort merk="Møter booket" verdi={n(t.leads_moter)} farge="var(--serie-3)"
          under={`av ${n(t.leads_nye)} i «LEADs»`} />
        <TallKort merk="Omsetning Mija" verdi={kr(t.omsetning_cents)} farge="var(--serie-4)"
          gnist={gnister.salg} gnistFarge="var(--serie-4)"
          trend={<Trend na={trender.salg_na} for={trender.salg_for} />}
          under={`${n(t.ordre_betalt)} betalte ordre`} />
        <TallKort merk="Aktivitet" verdi={n(trender.jobber_na)} gnist={gnister.jobber}
          gnistFarge="var(--serie-3)"
          trend={<Trend na={trender.jobber_na} for={trender.jobber_for} />}
          under="jobber kjørt siste uke" />
      </div>

      <div className="rutenett r23" style={{ marginBottom: 13 }}>
        <Kort tittel="Krever handling nå"
              hoyre={kritiske ? <Lapp type="kri">{kritiske} kritisk</Lapp> : <Lapp type="god">alt i rute</Lapp>}
              hint="Samlet fra alle systemene, viktigst øverst. Klikk for å gå dit problemet er.">
          <Handlinger handlinger={handlinger} gaTil={gaTil} />
        </Kort>

        <Kort tittel="Siste aktivitet" hoyre="alle systemer">
          <div style={{ maxHeight: 330, overflowY: 'auto' }}>
            {siste.length ? siste.map((s, i) => (
              <div className="tid-rad" key={i}>
                <div className="tid-ikon">{IKON[s.type] || '•'}</div>
                <div className="tid-tekst klipp" title={s.tekst}>{s.tekst}</div>
                <div className="tid-nar">{nar(s.tid)}</div>
              </div>
            )) : <Tom ikon="😴" tekst="Ingen aktivitet registrert." />}
          </div>
        </Kort>
      </div>

      <div className="rutenett r4" style={{ marginBottom: 13 }}>
        <TallKort merk="Kunder" verdi={n(t.kunder_totalt)} under={`${n(t.kunder_aktive)} aktive`}
          onClick={() => gaTil('sosialt')} />
        <TallKort merk="Agenter" verdi={n(t.agenter_aktive)} under="i arbeid"
          onClick={() => gaTil('agenter')} />
        <TallKort merk="Podcast-biter" verdi={kort(t.chunks)} under={`fra ${n(t.episoder)} episoder`}
          onClick={() => gaTil('founders')} />
        <TallKort merk="Bedriftsideer" verdi={n(t.ideer)} under="på lista"
          onClick={() => gaTil('ideer')} />
      </div>

      <div className="rutenett r2">
        <Kort tittel="Salgstrakten" hint="Hvor de 150+ leadsene står akkurat nå.">
          <Rangering rader={pipeline.map((p) => ({ etikett: p.nivaa, verdi: p.antall }))} />
        </Kort>

        <Kort tittel="Kundene" hoyre={`${kunder.length} totalt`}>
          <Tabell
            kolonner={[
              { n: 'Kunde', vis: (r) => <div>
                <div style={{ fontWeight: 700 }}>{r.navn}</div>
                <div className="dempet" style={{ fontSize: 11.5 }}>{r.bransje} · {r.by}</div></div> },
              { n: 'Status', vis: (r) => <Lapp type={r.kunde_status === 'inaktiv' ? 'kri' : r.kunde_status === 'pause' ? 'adv' : 'god'}>{r.kunde_status || '–'}</Lapp> },
              { n: 'AI-score', num: true, vis: (r) => r.siste_score != null ? Math.round(r.siste_score) + ' %' : '–' },
              { n: 'Google', num: true, vis: (r) => r.google_rating ? `${r.google_rating} ★` : '–' }
            ]}
            rader={kunder}
            tom={<Tom ikon="👥" tittel="Ingen kunder ennå."
                      tekst="Når en lead blir kunde dukker den opp her." />} />
        </Kort>
      </div>
    </>
  );
}

window.Sider = window.Sider || {};
window.Sider.oversikt = Oversikt;
})();
