/* Live — den nedstrippede versjonen av kartet.
   AI-agentene som store stasjoner på tre linjer, med ekte tall fra basen.
   Ingenting her regnes ut i nettleseren: alt kommer fra /api/agenter/graf. */
(() => {
const { useState, useEffect, useRef, useApi, useAutoOppfrisk, n, nar,
        SkjelettSide, Feil, Kort, Lapp, Topp, Tom } = window.K;

// Tre historier, hver med en håndfull stasjoner. Ider peker inn i NODER
// på serveren — finnes ikke en node, hoppes stasjonen over i stedet for
// at vi finner på en.
const LINJER = [
  {
    id: 'volum', navn: 'Volum.media', ikon: '🏢', farge: 'var(--serie-3)',
    hva: 'Finner bedrifter, gjør dem til kunder, og markedsfører dem hver uke.',
    stopp: [
      { id: 'places',     hvorfor: 'Leter opp bedrifter som mangler synlighet.' },
      { id: 'ringepanel', hvorfor: 'Ringer dem. De som sier ja blir kunder.' },
      { id: 'kunder',     hvorfor: 'Hver kunde utløser fem agenter.' },
      { id: 'sosiale',    hvorfor: 'Lager innleggene kunden skal ut med.' },
      { id: 'metricool',  hvorfor: 'Legger dem ut på Facebook og Instagram.' }
    ]
  },
  {
    id: 'mija', navn: 'Mija', ikon: '🛍️', farge: 'var(--serie-2)',
    hva: 'Butikken som fyller seg selv: finner et tema, lager varene, selger dem.',
    stopp: [
      { id: 'trend',     hvorfor: 'Ser hva folk snakker om akkurat nå.' },
      { id: 'dropplan',  hvorfor: 'Bestemmer hva neste utgivelse skal være.' },
      { id: 'dropbuild', hvorfor: 'Genererer bildene og filene.' },
      { id: 'mijaside',  hvorfor: 'Legger dem ut i butikken.' },
      { id: 'ordre',     hvorfor: 'Noen kjøper. Levering går automatisk.' }
    ]
  },
  {
    id: 'founders', navn: 'Founders', ikon: '🎙️', farge: 'var(--serie-5)',
    hva: 'Hele podcasten gjort søkbar, så du kan spørre den om hva som helst.',
    stopp: [
      { id: 'episoder', hvorfor: 'Hver episode hentes og lagres.' },
      { id: 'chunks',   hvorfor: 'Delt opp i biter maskinen kan søke i.' },
      { id: 'llm',      hvorfor: 'Claude leser bitene og svarer.' },
      { id: 'dash',     hvorfor: 'Du får svaret her på Founders-siden.' }
    ]
  }
];

function Stasjon({ node, stopp, blinker, farge, sist }) {
  return (
    <div className={'live-stasjon' + (blinker ? ' blink' : '')}
         style={{ '--linje': farge }}>
      <div className="live-ikon">{node.ikon}</div>
      <div className="live-navn">{node.navn}</div>
      <div className="live-tall">
        {node.antall !== null && node.antall !== undefined
          ? <><b>{n(node.antall)}</b> {node.enhet}</>
          : <span className="dempet">ingen teller</span>}
      </div>
      <div className="live-hvorfor">{stopp.hvorfor}</div>
      {node.varsel
        ? <div className="live-varsel">🛑 {node.varsel}</div>
        : sist
          ? <div className="live-sist">sist {nar(sist)}</div>
          : null}
    </div>
  );
}

function Linje({ linje, noder, blinkende }) {
  const stopp = linje.stopp
    .map((s) => ({ s, node: noder.find((x) => x.id === s.id) }))
    .filter((x) => x.node);

  if (!stopp.length) {
    return (
      <Kort tittel={`${linje.ikon} ${linje.navn}`}>
        <Tom ikon="🕳️" tittel="Ingen data"
             tekst="Ingen av stasjonene på denne linja finnes i kartet lenger." />
      </Kort>
    );
  }

  return (
    <div className="live-linje" style={{ '--linje': linje.farge }}>
      <div className="live-topp">
        <div className="live-merke">
          <span className="live-merke-ikon">{linje.ikon}</span>
          <div>
            <b>{linje.navn}</b>
            <div className="live-hva">{linje.hva}</div>
          </div>
        </div>
      </div>
      <div className="live-spor">
        {stopp.map(({ s, node }, i) => (
          <React.Fragment key={s.id}>
            {i > 0 && (
              <div className="live-pil" aria-hidden="true">
                <span className="live-prikk" style={{ animationDelay: `${(i % 3) * .5}s` }} />
              </div>
            )}
            <Stasjon node={node} stopp={s} farge={linje.farge}
                     sist={node.sist} blinker={blinkende.has(node.id)} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function Live({ gaTil }) {
  const { data, feil, laster, hentPaNytt } = useApi('/api/agenter/graf');
  const [blinkende, settBlinkende] = useState(() => new Set());
  const settPuls = useRef(null);

  useAutoOppfrisk(hentPaNytt, 15);

  // Når en jobb har kjørt siden forrige henting, blinker stasjonen som
  // eier den jobbtypen. Blinket er ekte hendelser — ikke en løkke.
  useEffect(() => {
    if (!data?.puls) return;
    const nokler = new Set(data.puls.map((p) => `${p.type}@${p.updated_at}`));
    const forrige = settPuls.current;
    settPuls.current = nokler;
    if (!forrige) return; // første henting: ikke blink på alt som finnes fra før

    const nye = data.puls.filter((p) => !forrige.has(`${p.type}@${p.updated_at}`));
    if (!nye.length) return;
    const ider = new Set();
    for (const p of nye) {
      const node = data.noder.find((x) => x.jobb === p.type);
      if (node) ider.add(node.id);
    }
    if (!ider.size) return;
    settBlinkende(ider);
    const t = setTimeout(() => settBlinkende(new Set()), 2600);
    return () => clearTimeout(t);
  }, [data]);

  if (laster) return <SkjelettSide tall={0} kort={3} />;
  if (feil) return <Feil melding={feil} paNytt={hentPaNytt} />;

  const { noder, puls, koStatus, oppdatert } = data;
  const doede = Number(koStatus.find((k) => k.status === 'dead')?.antall || 0);
  const kjorer = koStatus.filter((k) => ['queued', 'running'].includes(k.status))
    .reduce((s, k) => s + Number(k.antall), 0);

  return (
    <>
      <Topp tittel="Live"
            under="Tre linjer, én historie hver. Følg dem fra venstre mot høyre, så ser du hva agentene faktisk gjør — og hvorfor.">
        <span className="rad" style={{ fontSize: 12, color: 'var(--blekk-3)' }}>
          <span className="puls" /> {kjorer > 0 ? `${kjorer} i kø` : 'køen er tom'}
        </span>
        <button className="kn" onClick={() => hentPaNytt(true)}>↻ Oppdater</button>
      </Topp>

      {doede > 0 && (
        <div className="beskjed beskjed-kri">
          <span>🛑</span>
          <div><b>{doede} jobber har gitt opp.</b> Stasjonene under er merket med rødt der det står.</div>
        </div>
      )}

      {LINJER.map((l) => (
        <Linje key={l.id} linje={l} noder={noder} blinkende={blinkende} />
      ))}

      <div className="rutenett r2">
        <Kort tittel="Det som skjer nå"
              hoyre={`oppdatert ${nar(oppdatert)}`}
              hint="Ekte kjøringer fra jobbkøen. Når en ny dukker opp, blinker stasjonen som eier den.">
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {puls.length ? puls.slice(0, 20).map((p, i) => (
              <div className="tid-rad" key={i}>
                <div className="tid-ikon">
                  {p.status === 'dead' ? '🛑' : p.status === 'done' ? '✅' : '⏳'}
                </div>
                <div className="tid-tekst">
                  <code style={{ fontSize: 12 }}>{p.type}</code>
                  {p.feil && (
                    <div className="klipp" title={p.feil}
                         style={{ fontSize: 11.5, color: 'var(--kri-blekk)', marginTop: 2 }}>
                      {p.feil}
                    </div>
                  )}
                </div>
                <div className="tid-nar">{nar(p.updated_at)}</div>
              </div>
            )) : <Tom ikon="😴" tekst="Ingen kjøringer registrert." />}
          </div>
        </Kort>

        <Kort tittel="Hvordan lese siden"
              hoyre={<Lapp type="inf">forklaring</Lapp>}>
          <div className="prosa" style={{ fontSize: 13.5 }}>
            <p>Hver <b>boks</b> er et sted noe skjer — en agent som jobber, eller et sted data
              blir liggende. Tallet i boksen er ekte: antall rader i basen, eller antall
              ganger jobben har kjørt.</p>
            <p>De <b>rennende prikkene</b> mellom boksene viser bare hvilken vei ting går.
              De sier ingenting om fart eller mengde — de er der for at retningen skal
              være lett å se.</p>
            <p>Når en jobb faktisk kjører, <b>blinker</b> boksen som eier den, og linja
              til høyre viser hva som skjedde.</p>
            <p>Vil du ha hele bildet med alle {noder.length} boksene og hver eneste forbindelse,
              ligger det på <button className="lenke" onClick={() => gaTil('agenter')}>AI-agenter</button>.</p>
          </div>
        </Kort>
      </div>
    </>
  );
}

window.Sider = window.Sider || {};
window.Sider.live = Live;
})();
