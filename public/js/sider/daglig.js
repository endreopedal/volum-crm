/* Daglig oppsummering — hva skjedde, hva står fast, hva gjør du i dag. */
(() => {
const { useState, api, useApi, useAutoOppfrisk, n, nar, dato, kortDato, SkjelettSide, Laster,
        Feil, Kort, TallKort, Lapp, StatusLapp, Prosa, Topp, Tabell, Tom, Trend } = window.K;

function Daglig() {
  const [dager, settDager] = useState(1);
  const { data, feil, laster, hentPaNytt } = useApi(`/api/daglig?dager=${dager}`, [dager]);
  const [ki, settKi] = useState(null);
  const [kiLaster, settKiLaster] = useState(false);
  const [kiFeil, settKiFeil] = useState(null);

  async function oppsummer() {
    settKiLaster(true); settKiFeil(null);
    try {
      settKi(await api('/api/daglig/oppsummer', { method: 'POST', body: JSON.stringify({ dager }) }));
    } catch (e) { settKiFeil(e.message); }
    finally { settKiLaster(false); }
  }

  if (laster) return <SkjelettSide tall={4} kort={2} />;
  if (feil) return <Feil melding={feil} paNytt={hentPaNytt} />;

  const { ordre, poster, jobber, blogg, oppgaver, drops, feil: dodeJobber } = data;
  const betalt = ordre.filter((o) => o.status === 'paid');
  const inntekt = betalt.reduce((s, o) => s + Number(o.belop || 0), 0);
  const forfalt = oppgaver.filter((o) => o.forfaller && new Date(o.forfaller) < new Date());
  const perioder = [[1, 'I dag'], [3, '3 dager'], [7, 'Uke'], [30, 'Måned']];

  return (
    <>
      <Topp tittel="Daglig oppsummering" under="Alt som har skjedd i perioden — og hva som venter på deg.">
        <div className="pille-rad">
          {perioder.map(([d, navn]) => (
            <button key={d} className={'pille' + (dager === d ? ' pa' : '')} onClick={() => settDager(d)}>{navn}</button>
          ))}
        </div>
        <button className="kn kn-p" onClick={oppsummer} disabled={kiLaster}>
          {kiLaster ? <><span className="snurr" /> Skriver …</> : '✨ Oppsummer med Claude'}
        </button>
      </Topp>

      {dodeJobber.length > 0 && (
        <div className="beskjed beskjed-kri">
          <span>🛑</span>
          <div>
            <b>{dodeJobber.length} {dodeJobber.length === 1 ? 'jobb' : 'jobber'} har gitt opp.</b>{' '}
            {/* Samme jobb dør ofte flere ganger — vis den én gang med antall,
                ellers står det bare det samme navnet om og om igjen. */}
            {Object.entries(
              dodeJobber.reduce((s, f) => ({ ...s, [f.type]: (s[f.type] || 0) + 1 }), {})
            )
              .sort((a, b) => b[1] - a[1])
              .map(([type, antall]) => antall > 1 ? `${type} (${antall}×)` : type)
              .join(', ')}
            {' '}— sist {nar(dodeJobber[0].updated_at)}.
          </div>
        </div>
      )}
      {forfalt.length > 0 && (
        <div className="beskjed beskjed-adv">
          <span>⏰</span>
          <div><b>{forfalt.length} {forfalt.length === 1 ? 'oppgave' : 'oppgaver'} har gått over fristen.</b>{' '}
            Nærmeste: {forfalt[0].tittel} ({dato(forfalt[0].forfaller)}).</div>
        </div>
      )}

      {kiFeil && <div className="beskjed beskjed-kri"><span>⚠️</span><div>{kiFeil}</div></div>}
      {ki && (
        <Kort tittel="Oppsummert" hoyre={`skrevet ${nar(ki.generert)}`} style={{ marginBottom: 14 }}>
          <Prosa tekst={ki.tekst} />
        </Kort>
      )}

      <div className="rutenett r4" style={{ marginBottom: 14 }}>
        <TallKort merk="Salg" verdi={inntekt ? inntekt.toFixed(2) + ' $' : '0 $'}
          under={`${betalt.length} betalte ordre`} farge={inntekt ? 'var(--serie-3)' : undefined} />
        <TallKort merk="Poster" verdi={n(poster.length)} under="publisert eller planlagt" />
        <TallKort merk="Åpne oppgaver" verdi={n(oppgaver.length)}
          under={forfalt.length ? <Lapp type="adv">{forfalt.length} over fristen</Lapp> : 'ingen over fristen'} />
        <TallKort merk="Blogginnlegg" verdi={n(blogg.length)} under="skrevet i perioden" />
      </div>

      <div className="rutenett" style={{ marginBottom: 14 }}>
        <Kort tittel="Det som venter på deg" hint="Sortert etter frist — øverst haster mest.">
          <Tabell
            kolonner={[
              { n: 'Oppgave', vis: (r) => <span className="klipp" title={r.tittel}>{r.tittel}</span> },
              { n: 'Type', vis: (r) => <span className="dempet">{r.type || '–'}</span> },
              { n: 'Frist', num: true, vis: (r) => {
                const over = r.forfaller && new Date(r.forfaller) < new Date();
                return <span style={over ? { color: 'var(--adv-blekk)', fontWeight: 700 } : undefined}>{dato(r.forfaller)}</span>;
              } }
            ]}
            rader={oppgaver}
            tom={<Tom ikon="🎉" tittel="Ingenting står åpent."
                      tekst="Ingen oppgaver venter på deg akkurat nå." />} />
        </Kort>

      </div>

      <div className="rutenett r3">
        <Kort tittel="Salg" hoyre={`${ordre.length} hendelser`}>
          <Tabell
            kolonner={[
              { n: 'Status', vis: (r) => <StatusLapp status={r.status} /> },
              { n: 'Beløp', num: true, vis: (r) => `${r.belop} ${r.currency}` },
              { n: 'Når', num: true, vis: (r) => <span className="dempet">{nar(r.created_at)}</span> }
            ]}
            rader={ordre} tomTekst="Ingen salg i perioden." />
        </Kort>

        <Kort tittel="Sosialt" hoyre={`${poster.length} poster`}>
          <Tabell
            kolonner={[
              { n: 'Kanal', vis: (r) => r.platform },
              { n: 'Status', vis: (r) => <StatusLapp status={r.status} /> },
              { n: 'Når', num: true, vis: (r) => <span className="dempet">{nar(r.published_at || r.scheduled_at)}</span> }
            ]}
            rader={poster.slice(0, 12)} tomTekst="Ingen poster i perioden." />
        </Kort>

        <Kort tittel="Maskineriet" hint="Hva jobbkøen har gjort i perioden.">
          {jobber.length ? (
            <Tabell
              kolonner={[
                { n: 'Jobb', vis: (r) => <code style={{ fontSize: 12 }}>{r.type}</code> },
                { n: 'Status', vis: (r) => <StatusLapp status={r.status} /> },
                { n: 'Antall', num: true, felt: 'antall' }
              ]}
              rader={jobber} />
          ) : <Tom ikon="😴" tekst="Ingen jobber kjørte i perioden." />}
          {(drops.length > 0 || blogg.length > 0) && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--blekk-2)' }}>
              {drops.length > 0 && <div>🛍️ {drops.length} drop: {drops.map((d) => d.title).join(', ')}</div>}
              {blogg.length > 0 && <div>✍️ {blogg.length} nye blogginnlegg</div>}
            </div>
          )}
        </Kort>
      </div>
    </>
  );
}

window.Sider = window.Sider || {};
window.Sider.daglig = Daglig;
})();
