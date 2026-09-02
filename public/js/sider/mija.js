/* Mija — butikken: salg, betaling, besøk, drops og levering. */
(() => {
const { useApi, useAutoOppfrisk, n, kr, nar, dato, kortDato, SkjelettSide, Feil, Kort, TallKort,
        Lapp, StatusLapp, Topp, Tabell, Tom, Stolper, Rangering, Fordeling, serie } = window.K;

function Mija() {
  const { data, feil, laster, hentPaNytt } = useApi('/api/mija');
  useAutoOppfrisk(hentPaNytt, 120);
  if (laster) return <SkjelettSide tall={4} kort={2} />;
  if (feil) return <Feil melding={feil} paNytt={hentPaNytt} />;

  const { tall: t, omsetningPerDag, ordre, drops, pakker, trafikk, nedlastinger, land, jobber, samtykke, eksperimenter } = data;

  const brutto = Number(t.brutto_cents || 0);
  const refunderte = Number(t.ordre_refundert || 0);
  const betalte = Number(t.ordre_betalt || 0);
  const snitt = betalte ? brutto / betalte : 0;
  const byggkost = drops.reduce((s, d) => s + Number(d.build_cost_usd || 0), 0);
  const margin = brutto / 100 - byggkost;
  const ingenBesok = Number(t.besok_hendelser || 0) === 0;
  const doedeJobber = jobber.filter((j) => j.status === 'dead');

  return (
    <>
      <Topp tittel="Mija" under="Butikken som bygger seg selv: trend → tema → bilder → drop → sosialt → salg.">
        <Lapp type={String(t.autopilot).includes('true') ? 'god' : 'adv'}>
          {String(t.autopilot).includes('true') ? '● autopilot på' : '○ autopilot av'}
        </Lapp>
        <Lapp type="inf">neste drop #{String(t.neste_edition || '').replace(/"/g, '')}</Lapp>
        <button className="kn" onClick={() => hentPaNytt(true)}>↻</button>
      </Topp>

      {doedeJobber.length > 0 && (
        <div className="beskjed beskjed-kri">
          <span>🛑</span>
          <div><b>Døde jobber:</b> {doedeJobber.map((j) => `${j.type} (${j.antall})`).join(', ')}.</div>
        </div>
      )}

      <div className="rutenett r4" style={{ marginBottom: 14 }}>
        <TallKort merk="Omsetning" verdi={kr(brutto)}
          under={`${n(betalte)} betalte ordre`} farge="var(--serie-3)" />
        <TallKort merk="Snittordre" verdi={kr(snitt)}
          under={`${n(t.kunder)} unike kunder`} />
        <TallKort merk="Etter byggekostnad" verdi={margin.toLocaleString('nb-NO', { style: 'currency', currency: 'USD' })}
          under={`$${byggkost.toFixed(2)} brukt på bildegenerering`}
          farge={margin >= 0 ? undefined : 'var(--kri-blekk)'} />
        <TallKort merk="Refusjoner" verdi={n(refunderte)}
          under={refunderte ? <Lapp type="adv">{Math.round(refunderte / Math.max(betalte + refunderte, 1) * 100)} % av ordrene</Lapp> : 'ingen'}
          farge={refunderte ? 'var(--adv-blekk)' : undefined} />
      </div>

      <div className="rutenett r4" style={{ marginBottom: 14 }}>
        <TallKort merk="Drops" verdi={n(t.drops)} under={`${n(t.drops_publisert)} publisert`} />
        <TallKort merk="Bilder i arkivet" verdi={n(t.assets)} under={`${n(t.pakker_aktive)} aktive pakker`} />
        <TallKort merk="Besøk" verdi={n(t.besok_okter)}
          under={ingenBesok ? <Lapp type="adv">ingen sporing ennå</Lapp> : `${n(t.besok_hendelser)} hendelser`} />
        <TallKort merk="Nedlastinger" verdi={n(t.nedlastinger)}
          under={Number(t.nedlastinger_feil) ? <Lapp type="kri">{n(t.nedlastinger_feil)} feilet</Lapp> : 'alle gikk gjennom'} />
      </div>

      {ingenBesok && (
        <div className="beskjed beskjed-adv">
          <span>📉</span>
          <div><b>Ingen besøkstall.</b> <code>events</code>-tabellen er tom — nettsiden sender ikke
            sidevisninger til Supabase ennå. Salgstallene over er ekte; trafikken kan vi ikke se før
            sporingen er koblet på.</div>
        </div>
      )}

      <div className="rutenett r32" style={{ marginBottom: 14 }}>
        <Kort tittel="Omsetning per dag" hint="Siste 30 døgn. Bare betalte ordre telles.">
          <Stolper
            rader={omsetningPerDag.map((r) => ({ etikett: kortDato(r.dag), verdi: Number(r.cents) / 100 }))}
            farge="var(--serie-3)"
            format={(v) => '$' + Number(v).toFixed(2)} />
        </Kort>
        <Kort tittel="Hvor kundene er" hint="Etter landkode på ordren.">
          <Rangering rader={land.map((l) => ({ etikett: l.land, verdi: l.antall }))} farge="var(--serie-1)" />
        </Kort>
      </div>

      <div className="rutenett r2" style={{ marginBottom: 14 }}>
        <Kort tittel="Pakkene" hint="Sortert etter hvor mye hver pakke faktisk har solgt.">
          <Tabell
            kolonner={[
              { n: 'Pakke', vis: (r) => <div><div style={{ fontWeight: 600 }}>{r.title}</div>
                <div className="dempet" style={{ fontSize: 11.5 }}>{r.asset_count} bilder</div></div> },
              { n: 'Pris', num: true, vis: (r) => kr(r.price_cents, r.currency) },
              { n: 'Solgt', num: true, felt: 'solgt' },
              { n: 'Inntekt', num: true, vis: (r) => <b>{kr(r.inntekt_cents, r.currency)}</b> }
            ]}
            rader={pakker}
            tom={<Tom ikon="📦" tittel="Ingen pakker ennå."
                      tekst="Pakker lages når et drop bygges." />} />
        </Kort>

        <Kort tittel="Siste ordre" hoyre={`${ordre.length} nyeste`}>
          <Tabell
            kolonner={[
              { n: 'Status', vis: (r) => <StatusLapp status={r.status} /> },
              { n: 'Pakke', vis: (r) => <span className="klipp dempet" title={r.pakker}>{r.pakker || '–'}</span> },
              { n: 'Beløp', num: true, vis: (r) => `${r.belop} ${r.currency}` },
              { n: 'Når', num: true, vis: (r) => <span className="dempet">{nar(r.created_at)}</span> }
            ]}
            rader={ordre} tomTekst="Ingen ordre ennå." />
        </Kort>
      </div>

      <div className="rutenett r2" style={{ marginBottom: 14 }}>
        <Kort tittel="Drops" hoyre={`${drops.length} totalt`}>
          <Tabell
            kolonner={[
              { n: '#', num: true, felt: 'edition' },
              { n: 'Drop', vis: (r) => <div className="rad">
                <span style={{ width: 9, height: 9, borderRadius: 3, background: r.accent_color || 'var(--kant)', flexShrink: 0 }} />
                <span className="klipp">{r.title}</span></div> },
              { n: 'Status', vis: (r) => <StatusLapp status={r.status} /> },
              { n: 'Bilder', num: true, felt: 'assets' },
              { n: 'Kostnad', num: true, vis: (r) => r.build_cost_usd ? '$' + Number(r.build_cost_usd).toFixed(2) : '–' },
              { n: 'Publisert', num: true, vis: (r) => <span className="dempet">{r.published_at ? dato(r.published_at) : '–'}</span> }
            ]}
            rader={drops} tomTekst="Ingen drops ennå." />
        </Kort>

        <div className="stablet">
          <Kort tittel="Besøk på siden" hint="Hendelser nettsiden rapporterer inn.">
            {trafikk.length
              ? <Rangering rader={trafikk.map((t) => ({ etikett: t.name, verdi: t.antall }))} farge="var(--serie-1)" />
              : <Tom ikon="📊" tekst="Ingen besøkshendelser registrert ennå." />}
          </Kort>
          <Kort tittel="Levering og personvern">
            <div className="rutenett r2">
              <TallKort merk="Samtykker" verdi={n(t.samtykker)}
                under={samtykke.map((s) => `${s.action}: ${s.antall}`).join(' · ') || 'ingen loggført'} />
              <TallKort merk="Innsynskrav" verdi={n(t.dsr)} under="GDPR-forespørsler" />
            </div>
            {nedlastinger.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="kort-hint">Nedlastinger per dag</div>
                <Stolper rader={nedlastinger.slice().reverse().map((r) => ({ etikett: kortDato(r.dag), verdi: r.antall }))}
                         farge="var(--serie-4)" hoyde={110} />
              </div>
            )}
          </Kort>
        </div>
      </div>

      <div className="rutenett r2">
        <Kort tittel="Maskineriet" hint="Alle jobbene butikken kjører på, og hvordan de står.">
          <Tabell
            kolonner={[
              { n: 'Jobb', vis: (r) => <code style={{ fontSize: 12 }}>{r.type}</code> },
              { n: 'Status', vis: (r) => <StatusLapp status={r.status} /> },
              { n: 'Antall', num: true, felt: 'antall' },
              { n: 'Sist', num: true, vis: (r) => <span className="dempet">{nar(r.sist)}</span> }
            ]}
            rader={jobber} />
        </Kort>
        <Kort tittel="Eksperimenter" hint="A/B-tester butikken kjører på seg selv.">
          <Tabell
            kolonner={[
              { n: 'Test', vis: (r) => <span className="klipp" title={r.name}>{r.name || r.key}</span> },
              { n: 'Dimensjon', vis: (r) => <span className="dempet">{r.dimension || '–'}</span> },
              { n: 'Status', vis: (r) => <StatusLapp status={r.status} /> },
              { n: 'Vinner', vis: (r) => r.winner ? <Lapp type="god">{r.winner}</Lapp> : <span className="dempet">–</span> }
            ]}
            rader={eksperimenter} tomTekst="Ingen eksperimenter kjørt ennå." />
        </Kort>
      </div>
    </>
  );
}

window.Sider = window.Sider || {};
window.Sider.mija = Mija;
})();
