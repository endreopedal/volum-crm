/* Skallet: sidemeny, tema, hurtigsøk, ruting og oppsettsporten. */
(() => {
const { useState, useEffect, useRef, useCallback, api } = window.K;

const SIDER = [
  { id: 'oversikt', navn: 'Oversikt',   ikon: '📊', gruppe: 'Daglig',     tast: '1' },
  { id: 'daglig',   navn: 'I dag',      ikon: '📅', gruppe: 'Daglig',     tast: '2' },
  { id: 'agenter',  navn: 'AI-agenter', ikon: '🧠', gruppe: 'Systemet',   tast: '3' },
  { id: 'sosialt',  navn: 'Sosialt',    ikon: '📱', gruppe: 'Systemet',   tast: '4' },
  { id: 'mija',     navn: 'Mija',       ikon: '🛍️', gruppe: 'Bedriftene', tast: '5' },
  { id: 'ideer',    navn: 'Ideer',      ikon: '💡', gruppe: 'Bedriftene', tast: '6' },
  { id: 'founders', navn: 'Founders',   ikon: '🎙️', gruppe: 'Kunnskap',   tast: '7' }
];
const GRUPPER = ['Daglig', 'Systemet', 'Bedriftene', 'Kunnskap'];

const gjeldende = () => {
  const h = (location.hash || '').replace(/^#\/?/, '');
  return SIDER.some((s) => s.id === h) || h === 'oppsett' ? h : 'oversikt';
};

// ── Tema ──────────────────────────────────────────────────────────────
// Tre tilstander: følg systemet (standard), alltid lys, alltid mørk.
function useTema() {
  const [tema, settTema] = useState(() => localStorage.getItem('tema') || 'system');
  useEffect(() => {
    if (tema === 'system') document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', tema);
    localStorage.setItem('tema', tema);
  }, [tema]);
  const neste = () => settTema((t) => (t === 'system' ? 'lys' : t === 'lys' ? 'mork' : 'system'));
  return [tema, neste];
}

// ── Hurtigsøk (Cmd+K) ────────────────────────────────────────────────
function Hurtigsok({ lukk, gaTil }) {
  const [q, settQ] = useState('');
  const [treff, settTreff] = useState([]);
  const [valgt, settValgt] = useState(0);
  const inn = useRef(null);

  useEffect(() => { inn.current?.focus(); }, []);

  // Sidene finnes alltid; innholdet hentes når man har skrevet noe.
  useEffect(() => {
    const sider = SIDER
      .filter((s) => !q || s.navn.toLowerCase().includes(q.toLowerCase()))
      .map((s) => ({ ikon: s.ikon, tekst: s.navn, under: 'Side', gjor: () => gaTil(s.id) }));
    if (q.trim().length < 2) { settTreff(sider); settValgt(0); return; }

    let avbrutt = false;
    const t = setTimeout(async () => {
      try {
        const r = await api('/api/sok?q=' + encodeURIComponent(q));
        if (avbrutt) return;
        settTreff([...sider, ...r.treff.map((x) => ({
          ikon: x.ikon, tekst: x.tekst, under: x.under, gjor: () => gaTil(x.side)
        }))]);
        settValgt(0);
      } catch { if (!avbrutt) { settTreff(sider); settValgt(0); } }
    }, 180);
    return () => { avbrutt = true; clearTimeout(t); };
  }, [q, gaTil]);

  const tast = (e) => {
    if (e.key === 'Escape') return lukk();
    if (e.key === 'ArrowDown') { e.preventDefault(); settValgt((v) => Math.min(v + 1, treff.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); settValgt((v) => Math.max(v - 1, 0)); }
    if (e.key === 'Enter' && treff[valgt]) { treff[valgt].gjor(); lukk(); }
  };

  return (
    <div className="sok-dekke" onClick={(e) => e.target === e.currentTarget && lukk()}>
      <div className="sok">
        <input ref={inn} className="sok-inn" value={q} onChange={(e) => settQ(e.target.value)}
               onKeyDown={tast} placeholder="Søk etter side, kunde, lead, drop, idé eller episode …" />
        <div className="sok-liste">
          {treff.length ? treff.map((t, i) => (
            <button key={i} className={'sok-rad' + (i === valgt ? ' pa' : '')}
                    onMouseEnter={() => settValgt(i)}
                    onClick={() => { t.gjor(); lukk(); }}>
              <span className="sok-rad-ikon">{t.ikon}</span>
              <span className="klipp">{t.tekst}</span>
              <span className="sok-rad-under">{t.under}</span>
            </button>
          )) : <div className="tom" style={{ padding: '22px 16px' }}>Ingen treff på «{q}».</div>}
        </div>
        <div className="sok-bunn">
          <span><kbd>↑</kbd><kbd>↓</kbd> bla</span>
          <span><kbd>↵</kbd> åpne</span>
          <span><kbd>esc</kbd> lukk</span>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────
function App() {
  const [side, settSide] = useState(gjeldende);
  const [status, settStatus] = useState(null);
  const [sokApen, settSokApen] = useState(false);
  const [varsler, settVarsler] = useState(0);
  const [tema, nesteTema] = useTema();

  const gaTil = useCallback((id) => {
    if (id === 'leads') { window.open('/leads.html', '_blank'); return; }
    location.hash = '#/' + id;
    settSide(id);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const bytt = () => settSide(gjeldende());
    window.addEventListener('hashchange', bytt);
    return () => window.removeEventListener('hashchange', bytt);
  }, []);

  // Mangler nøklene, sender vi brukeren til oppsettet uansett hvor hen er.
  useEffect(() => {
    const til = () => settSide('oppsett');
    window.addEventListener('trengs-oppsett', til);
    return () => window.removeEventListener('trengs-oppsett', til);
  }, []);

  const hentStatus = useCallback(async () => {
    try {
      const s = await api('/api/status');
      settStatus(s);
      if (!s.supabase) settSide('oppsett');
      return s;
    } catch {
      settStatus({ feilet: true });   // serveren svarer ikke — la siden si fra selv
    }
  }, []);
  useEffect(() => { hentStatus(); }, [hentStatus]);

  // Antall ting som krever handling, vises som prikk i menyen.
  useEffect(() => {
    if (!status?.supabase) return;
    api('/api/oversikt')
      .then((d) => settVarsler((d.handlinger || []).filter((h) => h.vekt === 'kritisk').length))
      .catch(() => {});
  }, [status?.supabase, side]);

  // Tastatur: Cmd/Ctrl+K åpner søk, tallene hopper mellom sidene.
  useEffect(() => {
    const tast = (e) => {
      const iFelt = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); settSokApen((v) => !v); return;
      }
      if (iFelt || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = SIDER.find((x) => x.tast === e.key);
      if (s) { e.preventDefault(); gaTil(s.id); }
    };
    window.addEventListener('keydown', tast);
    return () => window.removeEventListener('keydown', tast);
  }, [gaTil]);

  // Vent til vi vet om nøklene finnes, ellers blinker dashbordet til før
  // oppsettet tar over.
  if (!status) return (
    <div className="oppsett-ramme" style={{ paddingTop: '18vh' }}>
      <div className="merke-prikk stor">◆</div>
      <div className="laster">Starter …</div>
    </div>
  );

  const Side = window.Sider?.[side];
  const temaIkon = tema === 'lys' ? '☀️' : tema === 'mork' ? '🌙' : '🌗';
  const temaNavn = tema === 'lys' ? 'Lyst tema' : tema === 'mork' ? 'Mørkt tema' : 'Følger systemet';

  // Oppsettet vises alene, uten meny — det er det eneste som gir mening da.
  if (side === 'oppsett') {
    const Oppsett = window.Sider?.oppsett;
    return Oppsett
      ? <Oppsett ferdig={() => { hentStatus(); gaTil('oversikt'); }} />
      : <div className="laster">Laster oppsettet …</div>;
  }

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

        <button className="kn sok-knapp" onClick={() => settSokApen(true)}>
          <span>🔍</span> Søk
          <kbd style={{ marginLeft: 'auto' }}>⌘K</kbd>
        </button>

        {GRUPPER.map((g) => (
          <React.Fragment key={g}>
            <div className="nav-tittel">{g}</div>
            {SIDER.filter((s) => s.gruppe === g).map((s) => (
              <button key={s.id} className={'nav-lenke' + (side === s.id ? ' pa' : '')}
                      onClick={() => gaTil(s.id)}>
                <span className="nav-ikon">{s.ikon}</span>{s.navn}
                {s.id === 'oversikt' && varsler > 0
                  ? <span className="nav-tall">{varsler}</span>
                  : <span className="nav-snarvei">{s.tast}</span>}
              </button>
            ))}
          </React.Fragment>
        ))}

        <div className="nav-tittel">Salg</div>
        <a className="nav-lenke" href="/leads.html" target="_blank" rel="noreferrer">
          <span className="nav-ikon">🎯</span>Leads-CRM
          <span className="nav-snarvei">↗</span>
        </a>

        <div className="side-status" style={{ marginTop: 'auto', paddingTop: 16 }}>
          <button className="nav-lenke" onClick={nesteTema} title="Bytt tema">
            <span className="nav-ikon">{temaIkon}</span>
            <span style={{ fontSize: 12.5 }}>{temaNavn}</span>
          </button>
          <button className="nav-lenke" onClick={() => settSide('oppsett')} title="Nøkler og oppsett">
            <span className="nav-ikon">🔑</span>
            <span style={{ fontSize: 12.5 }}>Nøkler</span>
            {status && !(status.claude && status.embeddings) && (
              <span className="nav-tall" style={{ background: 'var(--adv-glo)', color: 'var(--adv-blekk)' }}>!</span>
            )}
          </button>
        </div>
      </aside>

      <main className="hoved">
        {Side ? <Side gaTil={gaTil} status={status} /> : <div className="laster">Fant ikke siden.</div>}
      </main>

      {sokApen && <Hurtigsok lukk={() => settSokApen(false)} gaTil={gaTil} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('rot')).render(<App />);
})();
