# Setu — patched

Your three Netlify functions, the local dev server and the page, with one change:
**voice selection**. `speak.js` hardcoded `speaker: 'shubh'`, so every language
came back in the same male voice. It now accepts a `speaker` from the client,
whitelisted to three, and falls back to the default instead of erroring if Sarvam
rejects a name.

| Voice | Feel |
|---|---|
| `anushka` | female, warm — the best default for a lesson |
| `shubh` | male, steady narrator (previous behaviour) |
| `aditya` | male, brighter — good for instructions |

The page has a matching dropdown next to **Listen**.

## Run locally

> If you already unzipped an earlier copy, unzip this one fresh and **restart
> `node server.js`** — `server.js` is where the voice list was being cut off.

```bash
cp .env.example .env      # then paste your key
node server.js            # http://localhost:3000
```

## Deploy to Netlify

1. Push this folder to a repo.
2. Netlify → Import project → build command empty, publish directory `.`,
   functions directory `netlify/functions` (the `netlify.toml` sets it).
3. **Site settings → Environment variables → `SARVAM_API_KEY`** — the key goes
   here, never in `.env` and never in the repo.
4. Move `translate.js`, `speak.js`, `listen.js` into `netlify/functions/` if they
   are still at the root; Netlify only deploys what is in the functions directory.

## Voices

Ten voices, every one verified against the live API — HTTP 200 plus real audio —
not copied from documentation. Sarvam speaker IDs are model-specific: `anushka` is
a **bulbul:v2** voice and returns 400 on v3, and v4-flash personas exist for a
single language each. That is exactly why the list is measured.

| Voice | Gender | Model | Languages |
|---|---|---|---|
| Ishita (default) | female | bulbul:v3 | all five |
| Ritu | female | bulbul:v3 | all five |
| Shubh | male | bulbul:v3 | all five |
| Aditya | male | bulbul:v3 | all five |
| Kavya | female | bulbul:v4-flash | Hindi |
| Aravind | male | bulbul:v4-flash | Tamil |
| Kavitha | female | bulbul:v4-flash | Telugu |
| Aparna | female | bulbul:v4-flash | English |
| Arnab | male | bulbul:v4-flash | Bengali |
| Roopa | female | bulbul:v4-flash | Bengali |

`voices.json` is the registry. `/.netlify/functions/voices?lang=bn-IN` returns only
the voices valid for that language, and the page rebuilds its dropdown whenever
the target language changes — so a teacher can never pick a voice that will 400.

**Adding a voice:** test it first, then register it.

```bash
SARVAM_API_KEY=... node scripts/probe_voices.mjs   # re-verifies everything in voices.json
```

Local dev note: `server.js` discovers every `.js` file in the folder and forwards
the query string, so `/.netlify/functions/voices?lang=bn-IN` works locally exactly
as it does on Netlify. If the page ever shows only one voice, the registry call
failed — the browser console will say so, and the dropdown falls back to the four
standard `bulbul:v3` voices rather than a single one.

The probe exits 1 if any registered voice stopped working, so drift is caught
rather than discovered on stage. To add one, get its exact ID from the 400
message the API returns for an unknown speaker — it lists every valid ID for that
model — then add an entry and re-run the probe.

## What was verified

- The key works: `POST /translate` returned real Tamil for a Hindi sentence in
  1.9 s, and `POST /text-to-speech` returned 97,888 bytes of audio in 0.78 s.
- All guards behave: 405 on GET, 400 on same-language, unknown language, empty
  text, no audio, and voice-unsupported languages (Santali, Bodo).
- `node --check` passes on every file after the patch.

## Still open

- `translate.js` accepts `sat-IN` and `brx-IN`; `speak.js` and `listen.js`
  deliberately do not, because no Santali/Bodo voice or recogniser exists. Keep
  the UI honest about that — it already tags tribal output for review.
- No rate limiting. Fine for a demo, not for a public URL.
