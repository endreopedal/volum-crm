/* Oppsett — legg inn nøkler i nettleseren, se med én gang om de virker. */
(() => {
const { useState, useEffect, api, Laster, Kort, Lapp } = window.K;

const REKKEFOLGE = ['SUPABASE_SERVICE_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_PLACES_API_KEY'];
const TEST_NAVN = { SUPABASE_SERVICE_KEY: 'supabase', ANTHROPIC_API_KEY: 'claude', OPENAI_API_KEY: 'openai', GOOGLE_PLACES_API_KEY: 'google_places' };

function Nokkelfelt({ nokkel, meta, tilstand, verdi, settVerdi, test, tester, lagre, lagrer }) {
  const [vis, settVis] = useState(false);
  const alt = tilstand?.ok;
  const berort = verdi.length > 0;

  return (
    <div className={'nokkel' + (alt ? ' nokkel-ok' : '')}>
      <div className="nokkel-topp">
        <div className="nokkel-merke">{alt ? '✓' : meta.pakrevd ? '!' : '○'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nokkel-navn">
            {meta.navn}
            {meta.pakrevd && !alt && <Lapp type="kri">påkrevd</Lapp>}
            {alt && <Lapp type="god">virker</Lapp>}
          </div>
          <div className="nokkel-hjelp">{meta.hjelp}</div>
        </div>
        {meta.lenke && (
          <a className="kn kn-s" href={meta.lenke} target="_blank" rel="noreferrer">Hent nøkkel ↗</a>
        )}
      </div>

      {!alt && (
        <>
          <div className="nokkel-rad">
            <input
              className="inn" type={vis ? 'text' : 'password'} value={verdi}
              spellCheck="false" autoComplete="off"
              placeholder={tilstand?.mangler ? 'Lim inn nøkkelen her' : 'Lim inn en ny nøkkel'}
              onChange={(e) => settVerdi(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && berort && lagre()} />
            <button className="kn kn-s" onClick={() => settVis(!vis)} title={vis ? 'Skjul' : 'Vis'}>
              {vis ? '🙈' : '👁'}
            </button>
            <button className="kn kn-s" onClick={test} disabled={!berort || tester}>
              {tester ? <span className="snurr" /> : 'Test'}
            </button>
            <button className="kn kn-p kn-s" onClick={lagre} disabled={!berort || lagrer}>
              {lagrer ? <span className="snurr" /> : 'Lagre'}
            </button>
          </div>
          {tilstand?.grunn && !tilstand.mangler && (
            <div className="nokkel-feil">⚠️ {tilstand.grunn}</div>
          )}
        </>
      )}
    </div>
  );
}

function Oppsett({ ferdig }) {
  const [status, settStatus] = useState(null);
  const [verdier, settVerdier] = useState({});
  const [tester, settTester] = useState(null);
  const [lagrer, settLagrer] = useState(null);
  const [melding, settMelding] = useState(null);

  const hent = async () => { try { settStatus(await api('/api/oppsett')); } catch (e) { settMelding({ type: 'kri', tekst: e.message }); } };
  useEffect(() => { hent(); }, []);

  if (!status) return <div className="oppsett-ramme"><Laster tekst="Sjekker hva som er på plass …" /></div>;

  const sett = (k, v) => settVerdier((o) => ({ ...o, [k]: v }));

  async function test(nokkel) {
    settTester(nokkel); settMelding(null);
    try {
      const r = await api('/api/oppsett/test', {
        method: 'POST',
        body: JSON.stringify({ nokkel, verdi: verdier[nokkel], url: status.supabase_url })
      });
      settMelding(r.ok
        ? { type: 'god', tekst: `${status.nokler[nokkel].navn}: nøkkelen virker. Trykk Lagre.` }
        : { type: 'kri', tekst: r.grunn });
    } catch (e) { settMelding({ type: 'kri', tekst: e.message }); }
    finally { settTester(null); }
  }

  async function lagre(nokkel) {
    settLagrer(nokkel); settMelding(null);
    try {
      const kropp = { [nokkel]: verdier[nokkel] };
      if (nokkel === 'SUPABASE_SERVICE_KEY') kropp.SUPABASE_URL = status.supabase_url;
      const r = await api('/api/oppsett/lagre', { method: 'POST', body: JSON.stringify(kropp) });
      settStatus(r.status);
      settVerdier((o) => ({ ...o, [nokkel]: '' }));
      settMelding({ type: 'god', tekst: `${status.nokler[nokkel].navn} er lagret og virker.` });
    } catch (e) { settMelding({ type: 'kri', tekst: e.message }); }
    finally { settLagrer(null); }
  }

  const klar = status.supabase?.ok;
  const antallOk = REKKEFOLGE.filter((k) => status[TEST_NAVN[k]]?.ok).length;

  return (
    <div className="oppsett-ramme">
      <div className="oppsett-hode">
        <div className="merke-prikk stor">◆</div>
        <h1>Volum Kontroll</h1>
        <p>
          {klar
            ? 'Alt som må være på plass er på plass. Legg gjerne inn resten — eller gå rett inn.'
            : 'Én nøkkel til, så er du i gang. Du trenger ikke terminalen — lim inn her, så tester jeg den med en gang.'}
        </p>
        {!klar && status.supabase?.grunn && !status.supabase?.mangler && (
          <div className="beskjed beskjed-kri" style={{ textAlign: 'left', marginTop: 16 }}>
            <span>⚠️</span>
            <div><b>Nøkkelen som ligger inne nå virker ikke.</b> {status.supabase.grunn}</div>
          </div>
        )}
        <div className="oppsett-steg">
          {REKKEFOLGE.map((k) => (
            <span key={k} className={'steg' + (status[TEST_NAVN[k]]?.ok ? ' steg-ok' : '')} />
          ))}
          <span className="oppsett-teller">{antallOk} av 4</span>
        </div>
      </div>

      {melding && <div className={`beskjed beskjed-${melding.type}`}><span>{melding.type === 'god' ? '✓' : '⚠️'}</span><div>{melding.tekst}</div></div>}

      <div className="stablet">
        {REKKEFOLGE.map((k) => (
          <Nokkelfelt
            key={k} nokkel={k} meta={status.nokler[k]} tilstand={status[TEST_NAVN[k]]}
            verdi={verdier[k] || ''} settVerdi={(v) => sett(k, v)}
            test={() => test(k)} tester={tester === k}
            lagre={() => lagre(k)} lagrer={lagrer === k} />
        ))}
      </div>

      <div className="oppsett-bunn">
        {klar ? (
          <button className="kn kn-p kn-stor" onClick={ferdig}>Åpne dashbordet →</button>
        ) : (
          <div className="dempet" style={{ fontSize: 12.5 }}>
            Dashbordet åpner seg av seg selv så snart Supabase-nøkkelen er på plass.
          </div>
        )}
        <div className="dempet" style={{ fontSize: 11.5, marginTop: 14, lineHeight: 1.6 }}>
          Nøklene lagres i <code>.env</code> i prosjektmappa, som aldri havner på GitHub.
          Denne siden svarer bare på forespørsler fra denne maskinen.
        </div>
      </div>
    </div>
  );
}

window.Sider = window.Sider || {};
window.Sider.oppsett = Oppsett;
})();
