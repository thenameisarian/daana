# Daana — TOEFL, IELTS & more

**Daana** (دانا — "wise") is a standalone, domain-portable exam-prep platform by Arian Academy. **TOEFL iBT (2026) is live now**;
IELTS, GRE and Duolingo are planned. The current build replicates the **2026 TOEFL iBT** format (Reading · Listening · Writing · Speaking) and the on-screen exam layout.
**Single file, no build step, no backend** — everything (HTML, CSS, JS, content) lives in `index.html`.
Reading and Listening are auto-scored; Writing and Speaking are timed like the real exam.
All content is original (not ETS material).

## What's inside
- **Reading** — Complete the Words, Read in Daily Life (email / agenda / text chain), Academic Passage with insert-text
- **Listening** — Listen & Choose a Response, Conversations, Announcements & Academic Talks
- **Writing** — Build a Sentence (×10), Write an Email, Write for an Academic Discussion
- **Speaking** — Listen and Repeat (×7), Take an Interview (×4)
- Band scoring (1.0–6.0) with CEFR level, a question navigator, notes scratchpad, progress bar, keyboard nav, and a per-question review with explanations.

## Run locally
Open `index.html` in a browser, or serve the folder:
```
npx serve .
```

## Audio
Listening/Speaking prompts use the browser's text-to-speech by default. To use your own
recordings, drop MP3s into `audio/` with the filenames listed in `AUDIO.md` — the app
plays the file when present and falls back to TTS when it isn't. Use only audio you own.

## Deploy (subdomain now, own domain later)
Fully static, so it hosts anywhere and moves domains with zero code changes.

**Cloudflare Pages (recommended):**
1. This repo is the source.
2. Cloudflare dashboard → Pages → Connect to Git → pick this repo. Build command: *none*. Output dir: `/`.
3. Add a custom domain: `daana.mustafaarian.com` now.
4. Later, point a dedicated domain (e.g. `toeflprep.com`) at the same Pages project — nothing in the code changes.

## Structure
- `index.html` — the entire app (shell, obsidian/gold theme, content + logic)
- `audio/` — optional MP3s (see `AUDIO.md`)

## Roadmap
- Real Listening/Speaking audio files (currently browser text-to-speech)
- Speaking recording + playback/download
- Writing: AI/teacher scoring
- Full-length adaptive sets, accounts shared with Arian Academy
