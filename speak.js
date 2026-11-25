// Text -> speech via Sarvam Bulbul. Supports en, hi, te, ta, bn here (no Santali/Bodo voice exists).
// The client may pick a voice; unknown or rejected speakers fall back to the default
// rather than failing the request, because Sarvam speaker IDs are case-sensitive.
const VOICE = new Set(['en-IN','hi-IN','te-IN','ta-IN','bn-IN']);
let REGISTRY = { default: {}, voices: [] };
try { REGISTRY = require('./voices.json'); } catch { /* registry missing: fall back below */ }
const FALLBACK_SPEAKER = 'shubh';
const FALLBACK_MODEL = 'bulbul:v3';

// Resolve a requested voice for a language: unknown or wrong-language voices fall
// back to that language's default rather than failing the request.
function resolveVoice(requested, lang) {
  const known = (REGISTRY.voices || []).find((v) => v.id === requested && v.languages.includes(lang));
  if (known) return { id: known.id, model: known.model, substituted: false };
  const def = (REGISTRY.default || {})[lang];
  const defVoice = (REGISTRY.voices || []).find((v) => v.id === def && v.languages.includes(lang));
  if (defVoice) return { id: defVoice.id, model: defVoice.model, substituted: Boolean(requested) };
  return { id: FALLBACK_SPEAKER, model: FALLBACK_MODEL, substituted: Boolean(requested) };
}
const send = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
function chunk(text, limit) {
  const out = []; let cur = '';
  for (let s of text.split(/(?<=[.!?।॥])\s+/)) {
    while (s.length > limit) { if (cur) { out.push(cur); cur = ''; } out.push(s.slice(0, limit)); s = s.slice(limit); }
    if ((cur + ' ' + s).trim().length > limit) { out.push(cur); cur = s; } else cur = (cur + ' ' + s).trim();
  }
  if (cur) out.push(cur); return out;
}
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return send(405, { error: 'Use POST.' });
  const key = process.env.SARVAM_API_KEY;
  if (!key) return send(500, { error: 'Server is missing SARVAM_API_KEY.' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return send(400, { error: 'Request body must be JSON.' }); }
  const { text, lang } = b;
  const voice = resolveVoice(b.speaker, lang);
  if (typeof text !== 'string' || !text.trim()) return send(400, { error: 'Nothing to speak.' });
  if (!VOICE.has(lang)) return send(400, { error: 'No voice is available for this language yet.' });
  try {
    const audios = [];
    for (const piece of chunk(text.trim().slice(0, 6000), 2000)) {
      const call = async (speakerId, model) => {
        const r = await fetch('https://api.sarvam.ai/text-to-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-subscription-key': key },
          body: JSON.stringify({ text: piece, target_language_code: lang, model: voice.model, speaker: voice.id })
        });
        const d = await r.json().catch(() => ({}));
        return { r, d };
      };
      let { r, d } = await call(voice.id, voice.model);
      if (!r.ok && voice.id !== FALLBACK_SPEAKER) {
        ({ r, d } = await call(FALLBACK_SPEAKER, FALLBACK_MODEL));
      }
      if (!r.ok) return send(r.status, { error: d?.error?.message || 'Speech service error (' + r.status + ').' });
      audios.push(...(d.audios || []));
    }
    return send(200, { audios, speaker: voice.id, model: voice.model, substituted: voice.substituted });
  } catch { return send(502, { error: 'Could not reach Sarvam. Check your connection.' }); }
};
