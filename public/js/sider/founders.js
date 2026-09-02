/* Founders — spør 448 episoder om hva grunnleggerne faktisk gjorde. */
(() => {
const { useState, useRef, api, useApi, n, dato, SkjelettSide, Laster, Feil, Kort, TallKort,
        Lapp, Prosa, Topp, Tom, Stolper } = window.K;

const FORSLAG = [
  'Hva gjorde grunnleggere når de nesten gikk konkurs?',
  'Hvordan tenkte de om ansettelser og folk?',
  'Hva sier episodene om prissetting?',
  'Hvilke vaner går igjen hos de mest utholdende?',
  'Hva gjorde de da de var alene i starten?'
];

function Founders() {
  const { data, feil, laster, hentPaNytt } = useApi('/api/founders');
  const [sporsmal, settSporsmal] = useState('');
  const [svar, settSvar] = useState(null);
  const [tenker, settTenker] = useState(false);
  const [svarFeil, settSvarFeil] = useState(null);
  const inn = useRef(null);

  async function spor(tekst) {
    const q = (tekst ?? sporsmal).trim();
    if (!q || tenker) return;
    settSporsmal(q); settTenker(true); settSvarFeil(null); settSvar(null);
    try {
      settSvar(await api('/api/founders/spor', { method: 'POST', body: JSON.stringify({ sporsmal: q }) }));
    } catch (e) { settSvarFeil(e.message); }
    finally { settTenker(false); }
  }

  if (laster) return <SkjelettSide tall={2} kort={2} />;
  if (feil) return <Feil melding={feil} paNytt={hentPaNytt} />;

  const { statistikk: s, episoder, perAar, klar, mangler, modell } = data;

  return (
    <>
      <Topp tittel="Founders"
            under="Hele podcasten ligger som søkbare vektorer. Spørsmålet ditt finner de mest relevante utdragene, og Claude svarer med episodehenvisning.">
        <Lapp type="inf">{n(s.episoder)} episoder</Lapp>
        <Lapp type="inf">{n(s.chunks)} biter</Lapp>
        {modell && <Lapp>{modell}</Lapp>}
      </Topp>

      {!klar && (
        <div className="beskjed beskjed-adv">
          <span>🔑</span>
          <div><b>Søket er avslått.</b> Legg inn i <code>.env</code>: {mangler.join(' og ')}.{' '}
            Episodelista under fungerer uansett.</div>
        </div>
      )}

      <Kort style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <textarea
            ref={inn} className="inn" rows="2" value={sporsmal}
            placeholder="Spør om hva som helst — f.eks. «hvordan taklet de å bli avvist?»"
            onChange={(e) => settSporsmal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) spor(); }}
            style={{ minHeight: 54 }} disabled={!klar} />
          <button className="kn kn-p" style={{ height: 54, padding: '0 20px' }}
                  onClick={() => spor()} disabled={!klar || tenker || !sporsmal.trim()}>
            {tenker ? <><span className="snurr" /> Leter …</> : 'Spør'}
          </button>
        </div>
        <div className="pille-rad" style={{ marginTop: 11 }}>
          {FORSLAG.map((f) => (
            <button key={f} className="pille" onClick={() => spor(f)} disabled={!klar || tenker}>{f}</button>
          ))}
        </div>
        <div className="kort-hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Cmd/Ctrl + Enter sender. Svaret bygger kun på ekte utdrag — finner den ikke svaret, sier den det.
          {modell && <> Svarene skrives av <code>{modell}</code>.</>}
        </div>
      </Kort>

      {svarFeil && <div className="beskjed beskjed-kri"><span>⚠️</span><div>{svarFeil}</div></div>}

      {tenker && (
        <Kort style={{ marginBottom: 14 }}>
          <Laster tekst="Søker gjennom 11 000 utdrag og leser de mest relevante …" />
        </Kort>
      )}

      {svar && (
        <div className="rutenett r32" style={{ marginBottom: 14 }}>
          <Kort tittel="Svar" hoyre={`${svar.kilder.length} utdrag brukt`}>
            <Prosa tekst={svar.svar} />
          </Kort>
          <Kort tittel="Kildene" hint="Utdragene svaret bygger på, mest relevante først.">
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {svar.kilder.map((k, i) => (
                <div key={i} style={{
                  padding: '11px 0', borderBottom: i < svar.kilder.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none'
                }}>
                  <div className="spred" style={{ marginBottom: 5 }}>
                    <b style={{ fontSize: 12.5 }}>{k.episode}</b>
                    <Lapp type={k.likhet > 45 ? 'god' : 'inf'}>{k.likhet} %</Lapp>
                  </div>
                  <div className="dempet" style={{ fontSize: 11.5, marginBottom: 5 }}>
                    {dato(k.dato)}{k.minutt !== null ? ` · ${k.minutt} min ut i episoden` : ''}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--blekk-2)', lineHeight: 1.55 }}>«{k.utdrag}…»</div>
                </div>
              ))}
            </div>
          </Kort>
        </div>
      )}

      <div className="rutenett r23">
        <Kort tittel="Arkivet">
          <div className="rutenett r2" style={{ marginBottom: 16 }}>
            <TallKort merk="Episoder" verdi={n(s.episoder)} under={`${dato(s.forste)} → ${dato(s.siste)}`} />
            <TallKort merk="Søkbare biter" verdi={n(s.chunks)}
              under={`≈ ${Math.round(s.chunks / Math.max(s.episoder, 1))} per episode`} />
          </div>
          <div className="kort-hint">Episoder per år</div>
          <Stolper rader={perAar.map((r) => ({ etikett: String(r.aar), verdi: r.antall }))}
                   farge="var(--serie-2)" hoyde={130} />
        </Kort>

        <Kort tittel="Nyeste episoder" hoyre="60 siste">
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {episoder.length ? episoder.map((e) => (
              <div key={e.id} className="tid-rad" style={{ alignItems: 'flex-start' }}>
                <div className="tid-ikon">🎙️</div>
                <div className="tid-tekst">
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div className="dempet" style={{ fontSize: 11.5, marginTop: 2 }}>
                    {dato(e.published_at)} · {n(e.chunks)} biter
                  </div>
                </div>
              </div>
            )) : <Tom ikon="🎙️" tekst="Ingen episoder i basen." />}
          </div>
        </Kort>
      </div>
    </>
  );
}

window.Sider = window.Sider || {};
window.Sider.founders = Founders;
})();
