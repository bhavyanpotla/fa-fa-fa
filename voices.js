// Voice registry endpoint: which voices exist, and for which languages.
//
// Every entry in voices.json was verified against the live API — HTTP 200 and
// real audio — rather than copied from documentation, because Sarvam speaker IDs
// are model-specific and an invalid one returns 400 at request time.
const registry = require('./voices.json');
const send = (s, b) => ({ statusCode: s, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return send(405, { error: 'Use GET.' });
  const lang = (event.queryStringParameters || {}).lang;
  const voices = lang
    ? registry.voices.filter((v) => v.languages.includes(lang))
    : registry.voices;
  if (lang && !voices.length) return send(400, { error: 'No voices for that language.' });
  return send(200, {
    default: lang ? registry.default[lang] : registry.default,
    verified_at: registry.verified_at,
    voices,
  });
};
