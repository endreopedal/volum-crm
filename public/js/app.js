/* Skallet: sidemeny, ruting og innlasting av sidene. */
(() => {
const { useState, useEffect, api } = window.K;

const SIDER = [
  { id: 'oversikt', navn: 'Oversikt',   ikon: '📊', gruppe: 'Daglig' },
  { id: 'daglig',   navn: 'I dag',      ikon: '📅', gruppe: 'Daglig' },
  { id: 'agenter',  navn: 'AI-agenter', ikon: '🧠', gruppe: 'Systemet' },
  { id: 'sosialt',  navn: 'Sosialt',    ikon: '📱', gruppe: 'Systemet' },
  { id: 'mija',     navn: 'Mija',       ikon: '🛍️', gruppe: 'Bedriftene' },
  { id: 'ideer',    navn: 'Ideer',      ikon: '💡', gruppe: 'Bedriftene' },
  { id: 'founders', navn: 'Founders',   ikon: '🎙️', gruppe: 'Kunnskap' }
];

const GRUPPER = ['Daglig', 'Systemet', 'Bedriftene', 'Kunnskap'];

const gjeldende = () => {
  const h = (location.hash || '').replace('#/', '').replace('#', '');
  return SIDER.some((s) => s.id === h) ? h : 'oversikt';
};

function App() {
  const [side, settSide] = useState(gjeldende);
  const [status, settStatus] = useState(null);

  useEffect(() => {
    const bytt = () => settSide(gjeldende());
    window.addEventListener('hashchange', bytt);
    return () => window.removeEventListener('hashchange', bytt);
  }, []);

  useEffect(() => { api('/api/status').then(settStatus).catch(() => {}); }, []);

  const gaTil = (id) => { location.hash = '#/' + id; settSide(id); };

  const Side = window.Sider?.[side];
  const manglerNokler = status && (!status.claude || !status.embeddings);

  return (
    <div className="skall">
      <aside className="side">
        <div className="merke">
          <div className="merke-prikk">◆</div>
          <div>
            <div className="merke-navn">Volum Kontroll</div>
            <div className="merke-under">localhost:{status?.port || 3000}</div>
          </div>
        </div>

        {GRUPPER.map((g) => (
          <React.Fragment key={g}>
            <div className="nav-tittel">{g}</div>
            {SIDER.filter((s) => s.gruppe === g).map((s) => (
              <button key={s.id} className={'nav-lenke' + (side === s.id ? ' pa' : '')}
                      onClick={() => gaTil(s.id)}>
                <span className="nav-ikon">{s.ikon}</span>{s.navn}
              </button>
            ))}
          </React.Fragment>
        ))}

        <div className="nav-tittel">Salg</div>
        <a className="nav-lenke" href="/leads.html">
          <span className="nav-ikon">🎯</span>Leads-CRM
          <span className="nav-tall">↗</span>
        </a>

        <div className="side-status"
             style={{ marginTop: 'auto', paddingTop: 18, fontSize: 11, color: 'var(--blekk-3)', lineHeight: 1.6 }}>
          {status && (
            <>
              <div>{status.claude ? '✅' : '⚪️'} Claude</div>
              <div>{status.embeddings ? '✅' : '⚪️'} Søk i podcast</div>
              <div>{status.google_places ? '✅' : '⚪️'} Google Places</div>
            </>
          )}
        </div>
      </aside>

      <main className="hoved">
        {manglerNokler && side === 'oversikt' && (
          <div className="beskjed beskjed-adv">
            <span>🔑</span>
            <div>
              <b>Noen funksjoner er avslått.</b> Legg inn{' '}
              {[!status.claude && 'ANTHROPIC_API_KEY', !status.embeddings && 'OPENAI_API_KEY']
                .filter(Boolean).join(' og ')} i <code>.env</code> og start på nytt.
              Alt annet på dashbordet fungerer uansett.
            </div>
          </div>
        )}
        {Side ? <Side gaTil={gaTil} /> : <div className="laster">Fant ikke siden.</div>}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('rot')).render(<App />);
})();
