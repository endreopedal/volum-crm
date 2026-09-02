/* Felles byggeklosser for alle sidene. Legges på window.K. */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ── Data ──────────────────────────────────────────────────────────────
async function api(sti, valg) {
  const r = await fetch(sti, {
    ...valg,
    headers: valg?.body ? { 'Content-Type': 'application/json' } : undefined
  });
  const j = await r.json().catch(() => ({ feil: `Serveren svarte ${r.status}` }));
  if (!r.ok) {
    const e = new Error(j.feil || `Feil ${r.status}`);
    e.oppsett = Boolean(j.oppsett);   // nøklene mangler → send brukeren til oppsettet
    e.status = r.status;
    throw e;
  }
  return j;
}

/** Henter data ved montering. Returnerer { data, feil, laster, hentPaNytt }. */
function useApi(sti, avh = []) {
  const [data, setData] = useState(null);
  const [feil, setFeil] = useState(null);
  const [laster, setLaster] = useState(true);

  const hent = useCallback(async (stille) => {
    if (!stille) setLaster(true);
    try {
      setData(await api(sti));
      setFeil(null);
    } catch (e) {
      setFeil(e);
      if (e.oppsett) window.dispatchEvent(new CustomEvent('trengs-oppsett'));
    } finally {
      setLaster(false);
    }
  }, [sti]);

  useEffect(() => { hent(); }, avh.concat(hent));
  return { data, feil, laster, hentPaNytt: hent };
}

/** Kaller hentPaNytt stille med jevne mellomrom, men bare når fanen er synlig. */
function useAutoOppfrisk(hentPaNytt, sekunder = 60) {
  useEffect(() => {
    if (!sekunder) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') hentPaNytt(true);
    }, sekunder * 1000);
    return () => clearInterval(t);
  }, [hentPaNytt, sekunder]);
}

// ── Formatering ───────────────────────────────────────────────────────
const nf = new Intl.NumberFormat('nb-NO');
const n = (v) => (v === null || v === undefined || v === '' ? '–' : nf.format(Number(v)));

/** Store tall kortes ned: 11 151 → 11,2k. Brukes der plassen er trang. */
function kort(v) {
  const t = Number(v) || 0;
  if (Math.abs(t) >= 1e6) return (t / 1e6).toLocaleString('nb-NO', { maximumFractionDigits: 1 }) + ' mill';
  if (Math.abs(t) >= 10000) return (t / 1000).toLocaleString('nb-NO', { maximumFractionDigits: 1 }) + 'k';
  return nf.format(t);
}

const kr = (cents, valuta = 'USD') =>
  (Number(cents || 0) / 100).toLocaleString('nb-NO', { style: 'currency', currency: valuta, maximumFractionDigits: 2 });

function nar(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  if (isNaN(d)) return '–';
  const sek = (Date.now() - d.getTime()) / 1000;
  if (sek < 0) {
    const f = Math.abs(sek);
    if (f < 3600) return `om ${Math.round(f / 60)} min`;
    if (f < 86400) return `om ${Math.round(f / 3600)} t`;
    return `om ${Math.round(f / 86400)} d`;
  }
  if (sek < 60) return 'nå nettopp';
  if (sek < 3600) return `${Math.round(sek / 60)} min siden`;
  if (sek < 86400) return `${Math.round(sek / 3600)} t siden`;
  if (sek < 2592000) return `${Math.round(sek / 86400)} d siden`;
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: '2-digit' });
}
const dato = (iso) =>
  iso ? new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: '2-digit' }) : '–';
const kortDato = (iso) =>
  iso ? new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '–';

const SERIER = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-4)', 'var(--serie-5)'];
const serie = (i) => SERIER[i % SERIER.length];

/** Minimal markdown → HTML for LLM-svar. Escaper alt først. */
function markdown(tekst) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const linjer = esc(tekst || '').split('\n');
  let ut = '', iListe = false;
  const inline = (s) => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
  for (let l of linjer) {
    const t = l.trim();
    const liste = /^[-*•]\s+/.test(t) || /^\d+[.)]\s+/.test(t);
    if (liste && !iListe) { ut += '<ul>'; iListe = true; }
    if (!liste && iListe) { ut += '</ul>'; iListe = false; }
    if (liste) ut += `<li>${inline(t.replace(/^([-*•]|\d+[.)])\s+/, ''))}</li>`;
    else if (/^#{1,4}\s/.test(t)) ut += `<h3>${inline(t.replace(/^#{1,4}\s/, ''))}</h3>`;
    else if (t) ut += `<p>${inline(t)}</p>`;
  }
  if (iListe) ut += '</ul>';
  return ut;
}

/** Måler beholderbredden, så SVG-koordinater matcher skjermpiksler 1:1. */
function useBredde(startVerdi = 620) {
  const ref = useRef(null);
  const [bredde, settBredde] = useState(startVerdi);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mal = () => settBredde(Math.max(Math.round(el.clientWidth), 240));
    mal();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(mal);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, bredde];
}

// ── Små komponenter ───────────────────────────────────────────────────
const Laster = ({ tekst = 'Henter …' }) => (
  <div className="laster"><span className="snurr" />{tekst}</div>
);

/** Skjelett i formen til det som kommer — roligere enn en spinner. */
const Skjelett = ({ h = 14, b = '100%', r, stil }) => (
  <div className="skjelett" style={{ height: h, width: b, borderRadius: r, ...stil }} />
);

const SkjelettSide = ({ tall = 4, kort: antKort = 2 }) => (
  <>
    <div style={{ marginBottom: 22 }}>
      <Skjelett h={30} b={240} stil={{ marginBottom: 9 }} />
      <Skjelett h={15} b={430} />
    </div>
    <div className="rutenett r4" style={{ marginBottom: 13 }}>
      {Array.from({ length: tall }, (_, i) => (
        <div className="tall-kort" key={i}>
          <Skjelett h={10} b={72} stil={{ marginBottom: 9 }} />
          <Skjelett h={27} b={104} stil={{ marginBottom: 8 }} />
          <Skjelett h={12} b={130} />
        </div>
      ))}
    </div>
    <div className="rutenett r2">
      {Array.from({ length: antKort }, (_, i) => (
        <div className="kort" key={i}>
          <Skjelett h={14} b={150} stil={{ marginBottom: 16 }} />
          {[92, 78, 86, 62].map((b, j) => (
            <Skjelett key={j} h={13} b={b + '%'} stil={{ marginBottom: 11 }} />
          ))}
        </div>
      ))}
    </div>
  </>
);

const Feil = ({ melding, paNytt }) => (
  <div className="beskjed beskjed-kri">
    <span>⚠️</span>
    <div style={{ flex: 1 }}>
      <b>Noe gikk galt.</b> {typeof melding === 'string' ? melding : melding?.message}
      {paNytt && <div style={{ marginTop: 9 }}>
        <button className="kn kn-s" onClick={() => paNytt()}>Prøv igjen</button>
      </div>}
    </div>
  </div>
);

/** Tom tilstand som forklarer hvorfor det er tomt, ikke bare at det er det. */
const Tom = ({ ikon = '📭', tittel, tekst, handling }) => (
  <div className="tom">
    <span className="tom-ikon">{ikon}</span>
    {tittel && <b>{tittel}</b>}
    {tekst}
    {handling && <div style={{ marginTop: 13 }}>{handling}</div>}
  </div>
);

const Kort = ({ tittel, hint, hoyre, children, ...rest }) => (
  <div className="kort" {...rest}>
    {(tittel || hoyre) && (
      <div className="kort-topp">
        {tittel && <h2>{tittel}</h2>}
        {hoyre && <div className="hoyre">{hoyre}</div>}
      </div>
    )}
    {hint && <div className="kort-hint">{hint}</div>}
    {children}
  </div>
);

/** Endring mot forrige periode. Retningen fargelegges, aldri tallet alene. */
function Trend({ na, for: forrige, snuFarge, enhet = '%' }) {
  if (forrige === null || forrige === undefined) return null;
  const a = Number(na) || 0, b = Number(forrige) || 0;
  if (b === 0 && a === 0) return <span className="trend trend-flat">uendret</span>;
  const diff = b === 0 ? 100 : Math.round(((a - b) / Math.abs(b)) * 100);
  if (diff === 0) return <span className="trend trend-flat">uendret</span>;
  const opp = diff > 0;
  const bra = snuFarge ? !opp : opp;
  return (
    <span className={'trend ' + (bra ? 'trend-opp' : 'trend-ned')}>
      {opp ? '↑' : '↓'} {Math.abs(diff)}{enhet}
    </span>
  );
}

/** Bittelite forløp bak et nøkkeltall. Bærer aldri mening alene. */
function Gnist({ verdier, farge = 'var(--serie-1)' }) {
  if (!verdier?.length || verdier.length < 2) return null;
  const B = 120, H = 34;
  const tall = verdier.map((v) => Number(v) || 0);
  const maks = Math.max(...tall), min = Math.min(...tall);
  const spenn = maks - min || 1;
  const p = tall.map((v, i) => `${(i / (tall.length - 1)) * B},${H - 3 - ((v - min) / spenn) * (H - 8)}`);
  return (
    <svg className="tall-gnist" viewBox={`0 0 ${B} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,${H} ${p.join(' ')} ${B},${H}`} fill={farge} opacity=".13" />
      <polyline points={p.join(' ')} fill="none" stroke={farge} strokeWidth="1.6"
                vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

const TallKort = ({ merk, verdi, under, farge, onClick, trend, gnist, gnistFarge }) => (
  <div className={'tall-kort' + (onClick ? ' klikk' : '')} onClick={onClick}
       role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
       onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}>
    {gnist && <Gnist verdier={gnist} farge={gnistFarge || farge || 'var(--serie-1)'} />}
    <div className="tall-merk">{merk}</div>
    <div className="tall-verdi" style={farge ? { color: farge } : undefined}>{verdi}</div>
    <div className="tall-under">{trend}{under}</div>
  </div>
);

const Lapp = ({ type = '', children }) => (
  <span className={'lapp' + (type ? ' lapp-' + type : '')}>{children}</span>
);

/** Statusord → merkelapp-farge. Ett sted, så fargene betyr det samme overalt. */
function statusType(s) {
  const t = (s || '').toLowerCase();
  if (['published', 'paid', 'done', 'live', 'ferdig', 'aktiv', 'succeeded'].includes(t)) return 'god';
  if (['dead', 'failed', 'refunded', 'error', 'feilet'].includes(t)) return 'kri';
  if (['awaiting_approval', 'queued', 'pending', 'venter', 'ready', 'candidate'].includes(t)) return 'adv';
  if (['running', 'scheduled', 'planlagt', 'bygges', 'vurderes'].includes(t)) return 'inf';
  return '';
}
const StatusLapp = ({ status }) => <Lapp type={statusType(status)}>{status || '–'}</Lapp>;

const Prosa = ({ tekst }) => (
  <div className="prosa" dangerouslySetInnerHTML={{ __html: markdown(tekst) }} />
);

const Topp = ({ tittel, under, children }) => (
  <div className="topp">
    <div>
      <h1>{tittel}</h1>
      {under && <p>{under}</p>}
    </div>
    {children && <div className="topp-hoyre">{children}</div>}
  </div>
);

const Modal = ({ tittel, onLukk, bunn, children }) => {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onLukk();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onLukk]);
  return (
    <div className="dekke" onClick={(e) => e.target === e.currentTarget && onLukk()}>
      <div className="ark" role="dialog" aria-modal="true">
        <div className="ark-topp">
          <h3>{tittel}</h3>
          <button className="kn kn-s" style={{ marginLeft: 'auto' }} onClick={onLukk}>Lukk</button>
        </div>
        <div className="ark-kropp">{children}</div>
        {bunn && <div className="ark-bunn">{bunn}</div>}
      </div>
    </div>
  );
};

// ── Grafer ────────────────────────────────────────────────────────────
// Tynne merker, én akse, dempet rutenett. Verdien vises direkte når det er
// plass — i lys modus har flere av seriefargene lav kontrast mot hvitt, og da
// er en synlig etikett det som gjør stolpen lesbar uansett syn.

function Stolper({ rader, hoyde = 170, farge = 'var(--serie-1)', format = n, enhet = '' }) {
  const [over, settOver] = useState(null);
  const [ref, ytre] = useBredde();
  if (!rader?.length) return <Tom ikon="📊" tekst="Ingen data i perioden ennå." />;

  const V = 46, T = 16, H = hoyde, MIN_B = 18;
  const B = Math.max((ytre - V) / rader.length, MIN_B);
  const bredde = Math.max(V + B * rader.length, ytre);
  const stolpeB = Math.min(B - 9, 46);
  const visVerdier = B >= 44;   // nok plass til å skrive tallet over stolpen

  const maks = Math.max(...rader.map((r) => Number(r.verdi) || 0), 1);
  const y = (v) => T + (H - T) * (1 - (Number(v) || 0) / maks);
  const ticks = [0, maks / 2, maks];
  const hvert = Math.ceil(rader.length / Math.max(Math.floor((bredde - V) / 64), 1));

  return (
    <div ref={ref} style={{ position: 'relative', overflowX: bredde > ytre ? 'auto' : 'visible' }}>
      <svg className="graf" viewBox={`0 0 ${bredde} ${H + 26}`} width={bredde} height={H + 26}
           role="img" aria-label={`Stolpediagram, ${rader.length} punkter`}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="graf-rutenett" x1={V} y1={y(t)} x2={bredde} y2={y(t)} />
            <text className="graf-akse" x={V - 8} y={y(t) + 3.5} textAnchor="end">{format(Math.round(t))}</text>
          </g>
        ))}
        <line className="graf-baselinje" x1={V} y1={H} x2={bredde} y2={H} />
        {rader.map((r, i) => {
          const v = Number(r.verdi) || 0;
          const h = Math.max(H - y(v), v > 0 ? 3 : 0);
          const midt = V + i * B + B / 2;
          return (
            <g key={i} onMouseEnter={() => settOver(i)} onMouseLeave={() => settOver(null)}>
              <rect x={V + i * B} y={T} width={B} height={H - T} fill="transparent" />
              <rect className="stolpe" x={midt - stolpeB / 2} y={H - h} width={stolpeB} height={h}
                    rx="4" fill={farge} opacity={over === null || over === i ? 1 : .4} />
              {visVerdier && v > 0 && (
                <text className="graf-akse" x={midt} y={H - h - 5} textAnchor="middle"
                      style={{ fill: 'var(--blekk-2)', fontWeight: 700 }}>{format(v)}</text>
              )}
              {i % hvert === 0 && (
                <text className="graf-akse" x={midt} y={H + 16} textAnchor="middle">{r.etikett}</text>
              )}
            </g>
          );
        })}
      </svg>
      {over !== null && !visVerdier && (
        <div className="hint-boks" style={{ top: 0, right: 0 }}>
          <div className="dempet">{rader[over].etikett}</div>
          <b style={{ fontSize: 15 }}>{format(rader[over].verdi)}{enhet}</b>
        </div>
      )}
    </div>
  );
}

/** Vannrett rangering — bedre enn stolper når etikettene er lange. */
function Rangering({ rader, farge = 'var(--serie-1)', format = n, maksRader = 10 }) {
  if (!rader?.length) return <Tom ikon="📊" tekst="Ingen data ennå." />;
  const vis = rader.slice(0, maksRader);
  const maks = Math.max(...vis.map((r) => Number(r.verdi) || 0), 1);
  return (
    <div>
      {vis.map((r, i) => (
        <div className="trakt-rad" key={i}>
          <div className="trakt-navn klipp" title={r.etikett}>{r.etikett}</div>
          <div className="trakt-spor">
            <div className="trakt-fyll" style={{
              width: Math.max((Number(r.verdi) || 0) / maks * 100, r.verdi > 0 ? 2 : 0) + '%',
              background: r.farge || farge
            }} />
          </div>
          <div className="trakt-tall">{format(r.verdi)}</div>
        </div>
      ))}
    </div>
  );
}

/** Andelsfordeling som én stripe + forklaring med tall. */
function Fordeling({ rader, format = n }) {
  const sum = rader.reduce((s, r) => s + (Number(r.verdi) || 0), 0);
  if (!sum) return <Tom ikon="📊" tekst="Ingen data ennå." />;
  return (
    <div>
      <div style={{ display: 'flex', height: 28, borderRadius: 7, overflow: 'hidden', gap: 2 }}>
        {rader.map((r, i) => {
          const p = (Number(r.verdi) || 0) / sum * 100;
          if (p <= 0) return null;
          return <div key={i} title={`${r.etikett}: ${format(r.verdi)}`}
                      style={{ width: p + '%', background: r.farge || serie(i) }} />;
        })}
      </div>
      <div className="forklaring">
        {rader.filter((r) => Number(r.verdi) > 0).map((r, i) => (
          <span key={i}>
            <i style={{ background: r.farge || serie(i) }} />
            {r.etikett} <b>{format(r.verdi)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Kompakt tabell. kolonner = [{n, felt, num, bredde, vis}] */
function Tabell({ kolonner, rader, tom, tomTekst = 'Ingenting her ennå.', nokkel }) {
  if (!rader?.length) return tom || <Tom tekst={tomTekst} />;
  return (
    <div className="tab-boks">
      <table>
        <thead>
          <tr>{kolonner.map((k, i) => (
            <th key={i} className={k.num ? 'num' : ''} style={k.bredde ? { width: k.bredde } : undefined}>{k.n}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rader.map((r, i) => (
            <tr key={nokkel ? r[nokkel] : i}>
              {kolonner.map((k, j) => (
                <td key={j} className={k.num ? 'num' : ''}>{k.vis ? k.vis(r) : (r[k.felt] ?? '–')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

window.K = {
  React, useState, useEffect, useRef, useCallback, useMemo,
  api, useApi, useAutoOppfrisk, useBredde,
  n, kort, kr, nar, dato, kortDato, serie, SERIER, markdown, statusType,
  Laster, Skjelett, SkjelettSide, Feil, Tom, Kort, TallKort, Trend, Gnist,
  Lapp, StatusLapp, Prosa, Topp, Modal, Stolper, Rangering, Fordeling, Tabell
};
