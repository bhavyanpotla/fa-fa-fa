// Server-side proxy: keeps SARVAM_API_KEY out of the browser.
const LANGS = ['en-IN','hi-IN','te-IN','ta-IN','bn-IN','sat-IN','brx-IN'];
const MAYURA = new Set(['en-IN','hi-IN','te-IN','ta-IN','bn-IN']);
const MODES = ['formal','modern-colloquial','classic-colloquial'];
const MAX_TOTAL = 8000;

const send = (status, body) => ({ statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Split on sentence ends, then pack into chunks under the model limit.
function chunk(text, limit) {
  const sentences = text.split(/(?<=[.!?।॥])\s+/);
  const out = []; let cur = '';
  for (let s of sentences) {
    while (s.length > limit) { if (cur) { out.push(cur); cur = ''; } out.push(s.slice(0, limit)); s = s.slice(limit); }
    if ((cur + ' ' + s).trim().length > limit) { out.push(cur); cur = s; } else cur = (cur + ' ' + s).trim();
  }
  if (cur) out.push(cur);
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return send(405, { error: 'Use POST.' });
  const key = process.env.SARVAM_API_KEY;
  if (!key) return send(500, { error: 'Server is missing SARVAM_API_KEY. Add it in Netlify environment variables.' });

  let b; try { b = JSON.parse(event.body || '{}'); } catch { return send(400, { error: 'Request body must be JSON.' }); }
  const { text, source, target } = b; const mode = MODES.includes(b.mode) ? b.mode : 'formal';
  if (typeof text !== 'string' || !text.trim()) return send(400, { error: 'Enter some text to translate.' });
  if (text.length > MAX_TOTAL) return send(400, { error: `Text is too long. Limit is ${MAX_TOTAL} characters.` });
  if (!LANGS.includes(source) || !LANGS.includes(target)) return send(400, { error: 'Unsupported language.' });
  if (source === target) return send(400, { error: 'Choose two different languages.' });

  // mayura supports colloquial modes but only for 11 languages; everything else uses sarvam-translate.
  const model = mode !== 'formal' && MAYURA.has(source) && MAYURA.has(target) ? 'mayura:v1' : 'sarvam-translate:v1';
  const limit = model === 'mayura:v1' ? 900 : 1800;

  try {
    const parts = [];
    for (const piece of chunk(text.trim(), limit)) {
      const r = await fetch('https://api.sarvam.ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-subscription-key': key },
        body: JSON.stringify({ input: piece, source_language_code: source, target_language_code: target, model, mode: model === 'mayura:v1' ? mode : 'formal', numerals_format: 'international' })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const map = { 403: 'Sarvam rejected the API key. Check SARVAM_API_KEY.', 429: 'Rate limit or credits exhausted. Wait a moment and retry.', 422: 'Sarvam could not process this text or language pair.' };
        return send(r.status, { error: map[r.status] || data?.error?.message || 'Translation service error.' });
      }
      parts.push(data.translated_text);
    }
    return send(200, { translation: parts.join(' '), model, chunks: parts.length });
  } catch (e) {
    return send(502, { error: 'Could not reach Sarvam. Check your connection and retry.' });
  }
};
