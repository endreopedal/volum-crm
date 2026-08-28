/* AI-agenter — live simulasjon av hvordan alt henger sammen.
   Nodene og kantene er arkitekturen; tallene og pulsen er ekte data. */
(() => {
const { useState, useEffect, useRef, useApi, useAutoOppfrisk, api, n, nar, SkjelettSide, Laster,
        Feil, Kort, TallKort, Lapp, StatusLapp, Topp, Tabell, Tom, Modal } = window.K;

// Grupper får hver sin farge, men har alltid ikon + navn i tillegg,
// så fargen aldri er det eneste som skiller dem.
const GRUPPE = {
  kilde: { farge: 'var(--blekk-3)', navn: 'Utenfra' },
  data:  { farge: 'var(--serie-1)', navn: 'Lagret data' },
  agent: { farge: 'var(--serie-3)', navn: 'Volum-agent' },
  mija:  { farge: 'var(--serie-2)', navn: 'Mija-agent' },
  llm:   { farge: 'var(--serie-5)', navn: 'Språkmodell' },
  nav:   { farge: 'var(--serie-4)', navn: 'Navet' },
  ut:    { farge: 'var(--blekk-2)', navn: 'Ut i verden' }
};

// Hvilke noder som hører til hvilken historie — brukes av filterknappene.
const SPOR = {
  volum:    ['places','leads','ringepanel','kunder','sosiale','googlebing','blogg','forum','synlighet','metricool','gbp','bloggsite','forumut','rapport','supabase'],
  mija:     ['trend','tema','dropplan','dropbuild','droppub','mijaside','someplan','somepub','igtiktok','ordre','fulfill','metrics','eksper','jobs','supabase'],
  founders: ['rss','episoder','chunks','llm','dash','supabase']
};

const KOL = 212, RAD = 80, NB = 158, NH = 50, PADX = 104, PADY = 26;

// Radene er delt i fire bånd — én historie hver. Etiketten til venstre
// gjør det tydelig hvor den ene slutter og den neste begynner.
const BAND = [
  { navn: 'Volum.media', fra: 0,  til: 4,  farge: 'var(--serie-3)' },
  { navn: 'Mija',        fra: 6,  til: 8,  farge: 'var(--serie-2)' },
  { navn: 'Founders',    fra: 10, til: 10, farge: 'var(--serie-5)' },
  { navn: 'Grunnmur',    fra: 12, til: 12, farge: 'var(--serie-4)' }
];

function Simulasjon({ noder, kanter, spor, valgt, settValgt }) {
  const plass = {};
  noder.forEach((n0) => {
    plass[n0.id] = { x: PADX + n0.kolonne * KOL, y: PADY + n0.rad * RAD };
  });

  const bredde = PADX + PADY + Math.max(...noder.map((n0) => n0.kolonne)) * KOL + NB;
  const hoyde = PADY * 2 + Math.max(...noder.map((n0) => n0.rad)) * RAD + NH;
  const aktiv = (id) => spor === 'alle' || SPOR[spor]?.includes(id);

  // Velger man ett spor, zoomer vi inn på akkurat de radene i stedet for å
  // la brukeren rulle forbi et stort nedtonet område.
  const aktiveRader = noder.filter((n0) => aktiv(n0.id)).map((n0) => n0.rad);
  const rad0 = spor === 'alle' ? 0 : Math.min(...aktiveRader);
  const rad1 = spor === 'alle' ? Math.max(...noder.map((n0) => n0.rad)) : Math.max(...aktiveRader);
  const utsnittY = PADY + rad0 * RAD - 14;
  const utsnittH = (rad1 - rad0) * RAD + NH + 28;

  // Kurve mellom to bokser. Retningen avgjør hvor den går ut og inn.
  function bane(fra, til) {
    const a = plass[fra], b = plass[til];
    if (!a || !b) return null;
    const dx = b.x - a.x, dy = b.y - a.y;
    let x1, y1, x2, y2, c1, c2;
    if (dx > 0) {
      x1 = a.x + NB; y1 = a.y + NH / 2; x2 = b.x; y2 = b.y + NH / 2;
      const k = Math.max((x2 - x1) * .5, 26);
      c1 = `${x1 + k},${y1}`; c2 = `${x2 - k},${y2}`;
    } else if (dx < 0) {
      x1 = a.x; y1 = a.y + NH / 2; x2 = b.x + NB; y2 = b.y + NH / 2;
      const k = Math.max((x1 - x2) * .45, 40);
      c1 = `${x1 - k},${y1}`; c2 = `${x2 + k},${y2}`;
    } else {
      const ned = dy > 0;
      x1 = a.x + NB / 2; y1 = a.y + (ned ? NH : 0);
      x2 = b.x + NB / 2; y2 = b.y + (ned ? 0 : NH);
      const k = Math.max(Math.abs(dy) * .45, 24) * (ned ? 1 : -1);
      c1 = `${x1},${y1 + k}`; c2 = `${x2},${y2 - k}`;
    }
    return { d: `M${x1},${y1} C${c1} ${c2} ${x2},${y2}`, x1, y1, x2, y2 };
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden', margin: '0 -18px', padding: '0 18px' }}>
      <svg viewBox={`0 ${utsnittY} ${bredde} ${utsnittH}`}
           style={{ width: '100%', minWidth: bredde * .62, display: 'block', transition: 'height .2s' }}
           role="img" aria-label="Kart over hvordan agentene, dataene og tjenestene henger sammen">
        <defs>
          <marker id="pil" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 z" fill="var(--akse)" />
          </marker>
        </defs>

        {/* Båndene bakerst, så kantene, så nodene */}
        {BAND.map((b) => {
          const y0 = PADY + b.fra * RAD, y1 = PADY + b.til * RAD + NH;
          const pa = noder.some((n0) => n0.rad >= b.fra && n0.rad <= b.til && aktiv(n0.id));
          return (
            <g key={b.navn} opacity={pa ? 1 : .2}>
              <rect x={PADX - 78} y={y0} width="3" height={y1 - y0} rx="1.5" fill={b.farge} />
              <text x={PADX - 68} y={y0 + 14}
                    style={{ fontSize: 11, fontWeight: 700, fill: 'var(--blekk-2)' }}>{b.navn}</text>
              <text x={PADX - 68} y={y0 + 29}
                    style={{ fontSize: 9.5, fill: 'var(--blekk-3)' }}>
                {b.navn === 'Volum.media' ? 'kunder' : b.navn === 'Mija' ? 'butikk'
                  : b.navn === 'Founders' ? 'kunnskap' : 'lagring'}
              </text>
            </g>
          );
        })}

        {/* Kantene først, så nodene tegnes oppå */}
        {kanter.map((k, i) => {
          const b = bane(k.fra, k.til);
          if (!b) return null;
          const pa = aktiv(k.fra) && aktiv(k.til);
          const id = `kant-${i}`;
          return (
            <g key={i} opacity={pa ? 1 : .12}>
              <path id={id} d={b.d} fill="none" stroke="var(--akse)" strokeWidth="1.5" markerEnd="url(#pil)" />
              {pa && (
                /* Pakkene som renner langs linja — det er dette som gjør at man ser flyten */
                <circle r="3.2" fill={GRUPPE[noder.find((n0) => n0.id === k.fra)?.gruppe]?.farge || '#fff'}>
                  <animateMotion dur={`${2.4 + (i % 5) * .55}s`} repeatCount="indefinite"
                                 begin={`-${(i % 7) * .45}s`}>
                    <mpath href={`#${id}`} />
                  </animateMotion>
                </circle>
              )}
              {k.etikett && pa && b.x2 - b.x1 > 46 && (
                <text x={(b.x1 + b.x2) / 2} y={(b.y1 + b.y2) / 2 - 7} textAnchor="middle"
                      style={{ fontSize: 9.5, fill: 'var(--blekk-3)' }}>{k.etikett}</text>
              )}
            </g>
          );
        })}

        {noder.map((n0) => {
          const p = plass[n0.id];
          const g = GRUPPE[n0.gruppe] || GRUPPE.data;
          const pa = aktiv(n0.id);
          const erValgt = valgt?.id === n0.id;
          return (
            <g key={n0.id} opacity={pa ? 1 : .16} style={{ cursor: 'pointer' }}
               onClick={() => settValgt(n0)}>
              <rect x={p.x} y={p.y} width={NB} height={NH} rx="11"
                    fill={erValgt ? 'var(--glass-3)' : 'var(--glass-2)'}
                    stroke={erValgt ? g.farge : 'var(--kant)'} strokeWidth={erValgt ? 2 : 1} />
              <rect x={p.x} y={p.y} width="3.5" height={NH} rx="2" fill={g.farge} />
              <text x={p.x + 14} y={p.y + 21} style={{ fontSize: 13 }}>{n0.ikon}</text>
              <text x={p.x + 34} y={p.y + 21} style={{ fontSize: 11.5, fontWeight: 700, fill: 'var(--blekk)' }}>
                {n0.navn.length > 17 ? n0.navn.slice(0, 16) + '…' : n0.navn}
              </text>
              <text x={p.x + 14} y={p.y + 37} style={{ fontSize: 10, fill: 'var(--blekk-3)' }}>
                {n0.antall !== null ? `${n(n0.antall)} ${n0.enhet}` : (n0.tekst || '').slice(0, 24)}
              </text>
              {n0.varsel && <circle cx={p.x + NB - 11} cy={p.y + 11} r="4" fill="var(--kri)" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Agenter() {
  const { data, feil, laster, hentPaNytt } = useApi('/api/agenter/graf');
  const liste = useApi('/api/agenter/liste');
  const [spor, settSpor] = useState('alle');
  const [valgt, settValgt] = useState(null);

  // Holder kartet ferskt uten at man trenger å laste siden på nytt.
  useAutoOppfrisk(hentPaNytt, 25);

  if (laster) return <SkjelettSide tall={0} kort={2} />;
  if (feil) return <Feil melding={feil} paNytt={hentPaNytt} />;

  const { noder, kanter, puls, koStatus, oppdatert } = data;
  const doede = koStatus.find((k) => k.status === 'dead');
  const kjorer = koStatus.filter((k) => ['queued', 'running'].includes(k.status))
    .reduce((s, k) => s + Number(k.antall), 0);

  const spors = [['alle', 'Alt', '🌐'], ['volum', 'Volum.media', '🏢'],
                 ['mija', 'Mija', '🛍️'], ['founders', 'Founders', '🎙️']];

  return (
    <>
      <Topp tittel="AI-agentene"
            under="Hele maskineriet på ett kart. Prikkene som renner langs linjene viser hvilken vei dataene går — følg en linje, så ser du hvorfor noe skjer.">
        <span className="rad" style={{ fontSize: 12, color: 'var(--blekk-3)' }}>
          <span className="puls" /> {kjorer > 0 ? `${kjorer} i kø` : 'køen er tom'}
        </span>
        <button className="kn" onClick={() => hentPaNytt(true)}>↻ Oppdater</button>
      </Topp>

      {doede && Number(doede.antall) > 0 && (
        <div className="beskjed beskjed-kri">
          <span>🛑</span>
          <div><b>{doede.antall} jobber har gitt opp.</b> De røde prikkene på kartet viser hvor.</div>
        </div>
      )}

      <Kort
        tittel="Kartet"
        hoyre={`oppdatert ${nar(oppdatert)}`}
        hint="Klikk på en boks for å se hva den gjør. Bruk knappene til å følge én historie av gangen."
        style={{ marginBottom: 14 }}>
        <div className="pille-rad" style={{ marginBottom: 14 }}>
          {spors.map(([id, navn, ikon]) => (
            <button key={id} className={'pille' + (spor === id ? ' pa' : '')} onClick={() => settSpor(id)}>
              {ikon} {navn}
            </button>
          ))}
        </div>

        <Simulasjon noder={noder} kanter={kanter} spor={spor} valgt={valgt} settValgt={settValgt} />

        <div className="forklaring" style={{ marginTop: 14 }}>
          {Object.entries(GRUPPE).map(([k, g]) => (
            <span key={k}><i style={{ background: g.farge }} />{g.navn}</span>
          ))}
          <span><i style={{ background: 'var(--kri)', borderRadius: '50%' }} />Noe feiler</span>
        </div>
      </Kort>

      <div className="rutenett r2" style={{ marginBottom: 14 }}>
        <Kort tittel="Slik henger det sammen" hint="Den korte versjonen, i ord.">
          <div className="prosa" style={{ fontSize: 13.5 }}>
            <p><b>Volum.media</b> starter med at Google Places gir nye bedrifter. De havner i CRM-en,
              ringepanelet gjør dem om til kunder, og da tar fem agenter over: én lager sosiale innlegg,
              én skriver Google- og Bing-poster, én blogger, én poster i forum, og én måler hvor synlig
              kunden er i ChatGPT, Gemini og Claude. Resultatet går ut via Metricool og Google Business,
              og oppsummeres i en månedsrapport.</p>
            <p><b>Mija</b> går i ring uten at noen trykker på noe: trend-scan finner hva folk snakker om,
              tema-agenten foreslår et uttrykk, drop-planen bestemmer hva som skal lages, bildegenereringen
              lager filene, og publiseringen legger dropet ut. Samtidig planlegges det innlegg til
              Instagram og TikTok, som sender trafikk tilbake til butikken. Kjøp utløser levering,
              målingene mates inn i eksperimenter, og lærdommen går rett tilbake til neste sosial-plan.</p>
            <p><b>Founders</b> er kunnskapsbasen: RSS-en gir episoder, episodene deles i biter med vektorer,
              og når du spør om noe finner søket de riktige bitene før Claude svarer.</p>
            <p><b>Supabase</b> er navet alt går gjennom, og <b>jobbkøen</b> er motoren som faktisk starter
              arbeidet — når noe står stille, er det nesten alltid der det henger.</p>
          </div>
        </Kort>

        <Kort tittel="Siste hendelser" hint="Ekte kjøringer fra jobbkøen, nyeste først.">
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {puls.length ? puls.map((p, i) => (
              <div className="tid-rad" key={i}>
                <div className="tid-ikon">{p.status === 'dead' ? '🛑' : p.status === 'done' ? '✅' : '⏳'}</div>
                <div className="tid-tekst">
                  <code style={{ fontSize: 12 }}>{p.type}</code>
                  {p.feil && <div style={{ fontSize: 11.5, color: 'var(--kri-blekk)', marginTop: 2 }}
                                  className="klipp" title={p.feil}>{p.feil}</div>}
                </div>
                <div className="tid-nar">{nar(p.updated_at)}</div>
              </div>
            )) : <Tom ikon="😴" tekst="Ingen kjøringer registrert." />}
          </div>
        </Kort>
      </div>

      <Kort tittel="Agentene i Volum" hint="De ti agentene som jobber for kundene, med ukesplan.">
        {liste.laster ? <Laster /> : liste.feil ? <Feil melding={liste.feil} /> : (
          <Tabell
            kolonner={[
              { n: 'Agent', vis: (a) => <div className="rad">
                <span style={{ fontSize: 16 }}>{a.ikon}</span>
                <div><div style={{ fontWeight: 700 }}>{a.navn}</div>
                  <div className="dempet klipp" style={{ fontSize: 11.5, maxWidth: 420 }}>{a.avdeling}</div></div>
              </div> },
              { n: 'Status', vis: (a) => a.aktiv ? <Lapp type="god">aktiv</Lapp> : <Lapp type="adv">pause</Lapp> },
              { n: 'Denne uka', num: true, vis: (a) => a.uke
                ? `${a.uke.lagt_ut ?? 0} / ${a.uke.planlagt ?? 0}` : '–' },
              { n: 'Oppgaver', num: true, vis: (a) => a.oppgaver?.length || '–' }
            ]}
            rader={liste.data?.agenter || []} nokkel="id" />
        )}
      </Kort>

      {valgt && (
        <Modal tittel={`${valgt.ikon} ${valgt.navn}`} onLukk={() => settValgt(null)}>
          <p style={{ fontSize: 14, color: 'var(--blekk-2)', marginBottom: 16, lineHeight: 1.6 }}>
            {valgt.tekst || 'Ingen beskrivelse.'}
          </p>
          <div className="rutenett r2">
            <TallKort merk={GRUPPE[valgt.gruppe]?.navn || 'Node'}
              verdi={valgt.antall !== null ? n(valgt.antall) : '–'}
              under={valgt.enhet || 'ingen teller'} />
            <TallKort merk="Sist aktiv" verdi={valgt.sist ? nar(valgt.sist) : '–'}
              under={valgt.varsel || 'alt normalt'}
              farge={valgt.varsel ? 'var(--kri-blekk)' : undefined} />
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: 'var(--blekk-2)' }}>
            <b>Inn:</b> {kanter.filter((k) => k.til === valgt.id)
              .map((k) => noder.find((x) => x.id === k.fra)?.navn).filter(Boolean).join(', ') || 'ingenting'}
            <br />
            <b>Ut:</b> {kanter.filter((k) => k.fra === valgt.id)
              .map((k) => noder.find((x) => x.id === k.til)?.navn).filter(Boolean).join(', ') || 'ingenting'}
          </div>
        </Modal>
      )}
    </>
  );
}

window.Sider = window.Sider || {};
window.Sider.agenter = Agenter;
})();
