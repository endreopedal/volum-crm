/* Nye bedriftsideer — legg til, flytt, la Claude vurdere eller foreslå. */
(() => {
const { useState, api, useApi, n, nar, dato, Laster, Feil, Kort, TallKort, Lapp, Prosa,
        Topp, Tom, Modal, serie } = window.K;

const STATUS_NAVN = { ide: 'Idé', vurderes: 'Vurderes', bygges: 'Bygges', live: 'Live', parkert: 'Parkert' };
const STATUS_TYPE = { ide: '', vurderes: 'adv', bygges: 'inf', live: 'god', parkert: '' };
const REKKEFOLGE = ['ide', 'vurderes', 'bygges', 'live', 'parkert'];

const TOMT = {
  navn: '', tagline: '', beskrivelse: '', kategori: '', status: 'ide', score: '',
  marked: '', malgruppe: '', inntektsmodell: '', forste_steg: '', risiko: '',
  investering_nok: '', tid_til_lansering: '', lenke: '', notat: ''
};

function Skjema({ verdi, sett }) {
  const f = (navn, etikett, props = {}) => (
    <div className="felt">
      <label>{etikett}</label>
      {props.lang
        ? <textarea className="inn" rows={props.rows || 3} value={verdi[navn] ?? ''}
            placeholder={props.hint} onChange={(e) => sett({ ...verdi, [navn]: e.target.value })} />
        : <input className="inn" type={props.type || 'text'} value={verdi[navn] ?? ''}
            placeholder={props.hint} onChange={(e) => sett({ ...verdi, [navn]: e.target.value })} />}
    </div>
  );
  return (
    <>
      {f('navn', 'Navn på bedriften *', { hint: 'F.eks. Mija' })}
      {f('tagline', 'Én setning', { hint: 'Hva er den, sagt kort?' })}
      {f('beskrivelse', 'Beskrivelse', { lang: true, hint: 'Hva gjør den, for hvem, og hvorfor nå?' })}
      <div className="rutenett r2">
        <div className="felt">
          <label>Status</label>
          <select className="inn" value={verdi.status} onChange={(e) => sett({ ...verdi, status: e.target.value })}>
            {REKKEFOLGE.map((s) => <option key={s} value={s}>{STATUS_NAVN[s]}</option>)}
          </select>
        </div>
        {f('kategori', 'Kategori', { hint: 'Byrå, SaaS, digitale produkter …' })}
      </div>
      <div className="rutenett r2">
        {f('score', 'Score 0–100', { type: 'number', hint: 'Hvor godt passer den deg?' })}
        {f('investering_nok', 'Investering (kr)', { type: 'number', hint: '0' })}
      </div>
      <div className="rutenett r2">
        {f('marked', 'Marked', { hint: 'Norge, globalt …' })}
        {f('malgruppe', 'Målgruppe', { hint: 'Hvem betaler?' })}
      </div>
      <div className="rutenett r2">
        {f('inntektsmodell', 'Inntektsmodell', { hint: 'Abonnement, engangskjøp …' })}
        {f('tid_til_lansering', 'Tid til lansering', { hint: '2 uker, 3 måneder …' })}
      </div>
      {f('forste_steg', 'Første steg', { lang: true, rows: 2, hint: 'Hva kan gjøres på én uke?' })}
      {f('risiko', 'Største risiko', { lang: true, rows: 2, hint: 'Hva knekker den?' })}
      {f('lenke', 'Lenke', { hint: 'https://' })}
      {f('notat', 'Notat', { lang: true, rows: 2 })}
    </>
  );
}

function Ideer() {
  const { data, feil, laster, hentPaNytt } = useApi('/api/ideer');
  const [ny, settNy] = useState(null);
  const [rediger, settRediger] = useState(null);
  const [apen, settApen] = useState(null);
  const [lagrer, settLagrer] = useState(false);
  const [skjemaFeil, settSkjemaFeil] = useState(null);
  const [vurdering, settVurdering] = useState({});
  const [vurderer, settVurderer] = useState(null);
  const [foreslar, settForeslar] = useState(false);
  const [filter, settFilter] = useState('alle');

  async function lagre() {
    const rad = ny || rediger;
    if (!rad?.navn?.trim()) { settSkjemaFeil('Navn må fylles ut.'); return; }
    settLagrer(true); settSkjemaFeil(null);
    try {
      if (ny) await api('/api/ideer', { method: 'POST', body: JSON.stringify(rad) });
      else await api(`/api/ideer/${rad.id}`, { method: 'PATCH', body: JSON.stringify(rad) });
      settNy(null); settRediger(null);
      await hentPaNytt(true);
    } catch (e) { settSkjemaFeil(e.message); }
    finally { settLagrer(false); }
  }

  async function flytt(idé, status) {
    await api(`/api/ideer/${idé.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    hentPaNytt(true);
  }

  async function slett(idé) {
    if (!confirm(`Slette «${idé.navn}» for godt?`)) return;
    await api(`/api/ideer/${idé.id}`, { method: 'DELETE' });
    settApen(null);
    hentPaNytt(true);
  }

  async function vurder(idé) {
    settVurderer(idé.id);
    try {
      const r = await api(`/api/ideer/${idé.id}/vurder`, { method: 'POST' });
      settVurdering((v) => ({ ...v, [idé.id]: r.vurdering }));
    } catch (e) {
      settVurdering((v) => ({ ...v, [idé.id]: '⚠️ ' + e.message }));
    } finally { settVurderer(null); }
  }

  async function foresla() {
    settForeslar(true);
    try { await api('/api/ideer/foresla', { method: 'POST', body: JSON.stringify({}) }); await hentPaNytt(true); }
    catch (e) { alert(e.message); }
    finally { settForeslar(false); }
  }

  if (laster) return <Laster tekst="Henter ideene …" />;
  if (feil) return <Feil melding={feil} paNytt={hentPaNytt} />;

  const { ideer, fordeling, kiKlar } = data;
  const vist = filter === 'alle' ? ideer : ideer.filter((i) => i.status === filter);
  const antall = (s) => ideer.filter((i) => i.status === s).length;

  return (
    <>
      <Topp tittel="Bedriftsideer" under="Alt du vurderer å bygge — og alt du allerede har bygget.">
        {kiKlar && (
          <button className="kn" onClick={foresla} disabled={foreslar}>
            {foreslar ? <><span className="snurr" /> Tenker …</> : '✨ Foreslå 3 nye'}
          </button>
        )}
        <button className="kn kn-p" onClick={() => { settNy({ ...TOMT }); settSkjemaFeil(null); }}>
          ＋ Legg til ny bedrift
        </button>
      </Topp>

      <div className="rutenett r4" style={{ marginBottom: 14 }}>
        {REKKEFOLGE.slice(0, 4).map((s, i) => (
          <TallKort key={s} merk={STATUS_NAVN[s]} verdi={n(antall(s))}
            farge={s === 'live' ? 'var(--serie-3)' : undefined}
            under={s === 'live' ? 'kjører i dag' : s === 'bygges' ? 'under arbeid' : 'i vurdering'}
            onClick={() => settFilter(filter === s ? 'alle' : s)} />
        ))}
      </div>

      <div className="pille-rad" style={{ marginBottom: 14 }}>
        <button className={'pille' + (filter === 'alle' ? ' pa' : '')} onClick={() => settFilter('alle')}>
          Alle ({ideer.length})
        </button>
        {REKKEFOLGE.map((s) => (
          <button key={s} className={'pille' + (filter === s ? ' pa' : '')} onClick={() => settFilter(s)}>
            {STATUS_NAVN[s]} ({antall(s)})
          </button>
        ))}
      </div>

      {!vist.length ? (
        <Kort><Tom ikon="💡" tekst="Ingen ideer her. Trykk «Legg til ny bedrift» for å begynne." /></Kort>
      ) : (
        <div className="rutenett r3">
          {vist.map((i) => (
            <Kort key={i.id}>
              <div className="spred" style={{ marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: '-.2px' }}>{i.navn}</div>
                  {i.tagline && <div className="dempet" style={{ fontSize: 12.5, marginTop: 2 }}>{i.tagline}</div>}
                </div>
                {i.score != null && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1,
                      color: i.score >= 75 ? 'var(--serie-3)' : i.score >= 50 ? 'var(--serie-4)' : 'var(--blekk-3)' }}>
                      {i.score}
                    </div>
                    <div className="dempet" style={{ fontSize: 10 }}>SCORE</div>
                  </div>
                )}
              </div>

              <div className="rad" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                <Lapp type={STATUS_TYPE[i.status]}>{STATUS_NAVN[i.status] || i.status}</Lapp>
                {i.kategori && <Lapp>{i.kategori}</Lapp>}
                {i.kilde === 'claude' && <Lapp type="merke">✨ Claude</Lapp>}
              </div>

              {i.beskrivelse && (
                <div style={{ fontSize: 13, color: 'var(--blekk-2)', lineHeight: 1.55, marginBottom: 11 }}>
                  {i.beskrivelse.length > 165 ? i.beskrivelse.slice(0, 165) + '…' : i.beskrivelse}
                </div>
              )}

              <div className="rad" style={{ gap: 6, flexWrap: 'wrap' }}>
                <button className="kn kn-s" onClick={() => settApen(i)}>Åpne</button>
                <select className="inn" style={{ width: 'auto', padding: '5px 9px', fontSize: 12 }}
                        value={i.status} onChange={(e) => flytt(i, e.target.value)}>
                  {REKKEFOLGE.map((s) => <option key={s} value={s}>{STATUS_NAVN[s]}</option>)}
                </select>
                {kiKlar && (
                  <button className="kn kn-s" onClick={() => vurder(i)} disabled={vurderer === i.id}>
                    {vurderer === i.id ? <span className="snurr" /> : '✨ Vurder'}
                  </button>
                )}
              </div>

              {vurdering[i.id] && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--kant)' }}>
                  <Prosa tekst={vurdering[i.id]} />
                </div>
              )}
            </Kort>
          ))}
        </div>
      )}

      {(ny || rediger) && (
        <Modal
          tittel={ny ? 'Ny bedrift' : `Rediger ${rediger.navn}`}
          onLukk={() => { settNy(null); settRediger(null); }}
          bunn={<>
            <button className="kn" onClick={() => { settNy(null); settRediger(null); }}>Avbryt</button>
            <button className="kn kn-p" onClick={lagre} disabled={lagrer}>
              {lagrer ? <><span className="snurr" /> Lagrer …</> : 'Lagre'}
            </button>
          </>}>
          {skjemaFeil && <div className="beskjed beskjed-kri"><span>⚠️</span><div>{skjemaFeil}</div></div>}
          <Skjema verdi={ny || rediger} sett={ny ? settNy : settRediger} />
        </Modal>
      )}

      {apen && (
        <Modal tittel={apen.navn} onLukk={() => settApen(null)}
          bunn={<>
            <button className="kn kn-fare" onClick={() => slett(apen)}>Slett</button>
            <button className="kn" onClick={() => { settRediger({ ...apen }); settApen(null); }}>Rediger</button>
          </>}>
          {apen.tagline && <p style={{ fontSize: 15, marginBottom: 14, color: 'var(--blekk-2)' }}>{apen.tagline}</p>}
          {apen.beskrivelse && <div className="prosa" style={{ marginBottom: 16 }}>{apen.beskrivelse}</div>}
          <div className="rutenett r2">
            {[['Status', STATUS_NAVN[apen.status]], ['Kategori', apen.kategori], ['Score', apen.score],
              ['Marked', apen.marked], ['Målgruppe', apen.malgruppe], ['Inntektsmodell', apen.inntektsmodell],
              ['Investering', apen.investering_nok != null ? n(apen.investering_nok) + ' kr' : null],
              ['Tid til lansering', apen.tid_til_lansering]]
              .filter(([, v]) => v !== null && v !== undefined && v !== '')
              .map(([k, v]) => (
                <div key={k} className="felt" style={{ marginBottom: 8 }}>
                  <label>{k}</label>
                  <div style={{ fontSize: 13.5 }}>{v}</div>
                </div>
              ))}
          </div>
          {apen.forste_steg && <div className="felt"><label>Første steg</label>
            <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{apen.forste_steg}</div></div>}
          {apen.risiko && <div className="felt"><label>Største risiko</label>
            <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{apen.risiko}</div></div>}
          {apen.notat && <div className="felt"><label>Notat</label>
            <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{apen.notat}</div></div>}
          {apen.lenke && <a className="kn kn-s" href={apen.lenke} target="_blank" rel="noreferrer">Åpne lenke ↗</a>}
          <div className="dempet" style={{ fontSize: 11.5, marginTop: 14 }}>
            Lagt inn {dato(apen.opprettet)} · sist endret {nar(apen.oppdatert)}
          </div>
        </Modal>
      )}
    </>
  );
}

window.Sider = window.Sider || {};
window.Sider.ideer = Ideer;
})();
