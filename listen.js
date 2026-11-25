// Speech -> text via Sarvam (saaras:v3, transcribe mode). Audio up to ~30 seconds.
const STT = new Set(['en-IN','hi-IN','te-IN','ta-IN','bn-IN']);
const send = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return send(405, { error: 'Use POST.' });
  const key = process.env.SARVAM_API_KEY;
  if (!key) return send(500, { error: 'Server is missing SARVAM_API_KEY.' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return send(400, { error: 'Request body must be JSON.' }); }
  const { audio, mime, language } = b;
  if (typeof audio !== 'string' || !audio) return send(400, { error: 'No audio received.' });
  if (audio.length > 5_000_000) return send(400, { error: 'Recording too long. Keep it under 30 seconds.' });
  if (!STT.has(language)) return send(400, { error: 'Voice input is not available for this language yet.' });
  try {
    const type = (mime || 'audio/webm').split(';')[0];
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from(audio, 'base64')], { type }), 'speech.' + (type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'mp4' : 'webm'));
    fd.append('model', 'saaras:v3'); fd.append('mode', 'transcribe'); fd.append('language_code', language);
    const r = await fetch('https://api.sarvam.ai/speech-to-text', { method: 'POST', headers: { 'api-subscription-key': key }, body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return send(r.status, { error: d?.error?.message || 'Speech recognition error (' + r.status + ').' });
    if (!d.transcript || !d.transcript.trim()) return send(422, { error: 'Couldn’t catch any speech. Speak closer to the mic and try again.' });
    return send(200, { transcript: d.transcript });
  } catch { return send(502, { error: 'Could not reach Sarvam. Check your connection.' }); }
};
