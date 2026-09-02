// LLM-kall: Claude (Anthropic SDK) for tekst, OpenAI for embeddings.
//
// Embeddings MÅ være OpenAI text-embedding-3-small — de 11 000 chunkene i
// podcast_chunks er allerede lagret med 1536 dimensjoner fra den modellen.
// Bytter du modell her, matcher ikke vektorene og søket blir søppel.
const Anthropic = require('@anthropic-ai/sdk');

const MODELL = 'claude-opus-5';
const EMBED_MODELL = 'text-embedding-3-small';

let klient = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY mangler i .env — legg den inn for å bruke LLM-sidene.');
  }
  if (!klient) klient = new Anthropic();
  return klient;
}

const harClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);
const harEmbedding = () => Boolean(process.env.OPENAI_API_KEY);

/**
 * Ett Claude-kall. Streamer alltid, så lange svar ikke treffer HTTP-timeout.
 * @returns {Promise<string>} ren tekst
 */
async function spor(system, melding, { maxTokens = 4000, effort = 'medium' } = {}) {
  const stream = anthropic().messages.stream({
    model: MODELL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort },
    system,
    messages: [{ role: 'user', content: melding }]
  });
  const svar = await stream.finalMessage();
  return svar.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/**
 * Anthropic sitt structured-output-skjema godtar bare minItems 0 eller 1.
 * Et hvilket som helst annet tall gir «400 minItems values other than 0 or 1
 * are not supported». Vi klipper det ned her, så et skjema med minItems: 3
 * aldri kan velte et kall — antallet må stå i prompten i stedet.
 * Returnerer en kopi; skjemaet som ble sendt inn røres ikke.
 */
function rensSkjema(node) {
  if (Array.isArray(node)) return node.map(rensSkjema);
  if (!node || typeof node !== 'object') return node;
  const ut = {};
  for (const [nokkel, verdi] of Object.entries(node)) {
    if (nokkel === 'minItems' && typeof verdi === 'number' && verdi > 1) {
      ut.minItems = 1;
      continue;
    }
    ut[nokkel] = rensSkjema(verdi);
  }
  return ut;
}

/** Som spor(), men tvinger fram gyldig JSON via structured outputs. */
async function sporJson(system, melding, schema, { maxTokens = 4000, effort = 'medium' } = {}) {
  const stream = anthropic().messages.stream({
    model: MODELL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort, format: { type: 'json_schema', schema: rensSkjema(schema) } },
    system,
    messages: [{ role: 'user', content: melding }]
  });
  const svar = await stream.finalMessage();
  const tekst = svar.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(tekst);
}

/** Lager embedding for et søk, samme modell som chunkene ble lagret med. */
async function embed(tekst) {
  if (!harEmbedding()) {
    throw new Error('OPENAI_API_KEY mangler i .env — trengs for å søke i podcast-chunkene.');
  }
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: EMBED_MODELL, input: tekst })
  });
  if (!r.ok) throw new Error(`OpenAI embeddings ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.data[0].embedding;
}

module.exports = { spor, sporJson, embed, rensSkjema, harClaude, harEmbedding, MODELL, EMBED_MODELL };
