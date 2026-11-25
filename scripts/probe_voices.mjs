// Re-verify every voice in voices.json against the live API.
//
// Sarvam speaker IDs are model-specific: 'anushka' is a bulbul:v2 voice and
// returns 400 on v3, and v4-flash personas exist for one language each. So the
// registry is not written from documentation — it is written from responses.
//
//   SARVAM_API_KEY=... node scripts/probe_voices.mjs
//
// Writes voices.probe.json and exits 1 if any registered voice stopped working.
import { readFile, writeFile } from 'node:fs/promises';

const KEY = process.env.SARVAM_API_KEY;
if (!KEY) { console.error('Set SARVAM_API_KEY first.'); process.exit(2); }

const SAMPLE = {
  'hi-IN': 'नमस्ते बच्चों', 'ta-IN': 'வணக்கம்', 'te-IN': 'నమస్కారం',
  'en-IN': 'Hello children', 'bn-IN': 'নমস্কার',
};

const registry = JSON.parse(await readFile(new URL('../voices.json', import.meta.url), 'utf8'));
const results = [];
let failures = 0;

for (const voice of registry.voices) {
  for (const lang of voice.languages) {
    const started = Date.now();
    let status = 0, bytes = 0, error = null;
    try {
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-subscription-key': KEY },
        body: JSON.stringify({ text: SAMPLE[lang] || 'test', target_language_code: lang, model: voice.model, speaker: voice.id }),
      });
      const data = await response.json().catch(() => ({}));
      status = response.status;
      bytes = (data.audios?.[0] || '').length;
      if (!response.ok) error = data?.error?.message?.slice(0, 80) || null;
    } catch (err) {
      error = String(err).slice(0, 80);
    }
    const ok = status === 200 && bytes > 1000;
    if (!ok) failures += 1;
    results.push({ id: voice.id, model: voice.model, lang, status, bytes, ms: Date.now() - started, ok, error });
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${voice.id.padEnd(28)} ${voice.model.padEnd(14)} ${lang.padEnd(6)} ${String(status).padStart(3)} ${String(bytes).padStart(7)}b ${error || ''}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

await writeFile(new URL('../voices.probe.json', import.meta.url), JSON.stringify({ checked_at: new Date().toISOString(), failures, results }, null, 2));
console.log(`\n${results.length - failures}/${results.length} voice/language pairs returned audio.`);
process.exit(failures ? 1 : 0);
