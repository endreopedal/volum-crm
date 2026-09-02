// Sjekker at hvert JSON-skjema vi sender til Anthropic bare inneholder
// nøkkelord de faktisk godtar. Kjør med: npm run sjekk
//
// Bakgrunnen: structured outputs støtter bare en delmengde av JSON Schema.
// Sender du minItems, minimum, maxLength eller pattern, får du 400 og
// knappen i grensesnittet dør. rensSkjema() i lib/llm.js fjerner dem, og
// denne testen holder den ærlig — uten å bruke et eneste API-kall.
const fs = require('fs');
const path = require('path');
const { rensSkjema } = require('./lib/llm');

// Nøkkelordene Anthropic dokumenterer som støttet i output_config.format.schema.
const STOTTET = new Set([
  'type', 'properties', 'required', 'additionalProperties', 'items',
  'enum', 'const', 'anyOf', 'allOf', '$ref', '$defs', 'definitions',
  'description', 'title', 'format'
]);

// Under disse nøklene er nøklene feltnavn, ikke nøkkelord.
const NAVNEROM = ['properties', 'patternProperties', '$defs', 'definitions'];

function finnUstottede(node, sti = '$', iNavnerom = false, funn = []) {
  if (Array.isArray(node)) {
    node.forEach((x, i) => finnUstottede(x, `${sti}[${i}]`, false, funn));
    return funn;
  }
  if (!node || typeof node !== 'object') return funn;
  for (const [nokkel, verdi] of Object.entries(node)) {
    if (!iNavnerom && !STOTTET.has(nokkel)) funn.push(`${sti}.${nokkel}`);
    finnUstottede(verdi, `${sti}.${nokkel}`, !iNavnerom && NAVNEROM.includes(nokkel), funn);
  }
  return funn;
}

// Skjemaene ligger som SKJEMA_*-konstanter i rutene. Vi plukker dem ut av
// kildekoden i stedet for å eksportere dem — da kan ingen legge til et nytt
// skjema og glemme å melde det inn her.
function finnSkjemaer() {
  const katalog = path.join(__dirname, 'routes');
  const treff = [];
  for (const fil of fs.readdirSync(katalog).filter((f) => f.endsWith('.js'))) {
    const kilde = fs.readFileSync(path.join(katalog, fil), 'utf8');
    const mønster = /const (SKJEMA_\w+) = (\{[\s\S]*?\n\});/g;
    let m;
    while ((m = mønster.exec(kilde))) {
      // eslint-disable-next-line no-eval
      treff.push({ fil, navn: m[1], skjema: eval(`(${m[2]})`) });
    }
  }
  return treff;
}

const skjemaer = finnSkjemaer();
if (!skjemaer.length) {
  console.log('Fant ingen SKJEMA_*-konstanter i routes/. Ingenting å sjekke.');
  process.exit(0);
}

let feil = 0;
for (const { fil, navn, skjema } of skjemaer) {
  const rått = finnUstottede(skjema);
  const rent = finnUstottede(rensSkjema(skjema));
  if (rent.length) {
    feil++;
    console.error(`✗ routes/${fil} → ${navn}`);
    console.error(`  Slipper gjennom rensSkjema(): ${rent.join(', ')}`);
    console.error('  Anthropic svarer 400 på disse. Legg dem til i IKKE_STOTTET i lib/llm.js.');
  } else {
    const ryddet = rått.length ? ` (${rått.length} fjernet: ${rått.map((s) => s.split('.').pop()).join(', ')})` : '';
    console.log(`✓ routes/${fil} → ${navn}${ryddet}`);
  }
}

console.log(feil
  ? `\n${feil} av ${skjemaer.length} skjema ville gitt 400.`
  : `\nAlle ${skjemaer.length} skjema er trygge å sende.`);
process.exit(feil ? 1 : 0);
