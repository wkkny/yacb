# YACB

**Yet Another Chat Bot** — a minimal Next.js chat UI for open-weight models served locally by [LM Studio](https://lmstudio.ai/).

![License: MIT](https://img.shields.io/badge/license-MIT-black)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

## Features

- Streaming chat against LM Studio’s OpenAI-compatible API
- Model picker in the message composer
- Minimal black-and-white UI
- Local-only — no cloud LLM provider required

## Prerequisites

1. [Node.js](https://nodejs.org/) 20+
2. [LM Studio](https://lmstudio.ai/) installed
3. At least one open-weight model downloaded in LM Studio

## Quick start

### 1. Start LM Studio

```bash
# optional CLI helpers (if `lms` is on your PATH)
lms server start
lms load <model-key> -y
```

Or in the LM Studio app: load a model, then enable the local server (default `http://127.0.0.1:1234`).

### 2. Run YACB

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

Copy `.env.example` to `.env.local` and adjust as needed:

| Variable | Default | Purpose |
| --- | --- | --- |
| `LM_STUDIO_BASE_URL` | `http://127.0.0.1:1234/v1` | LM Studio OpenAI-compatible base URL |
| `LM_STUDIO_MODEL` | _(optional)_ | Fallback model id if none is selected in the UI |

Never commit `.env.local` — it is gitignored.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Project structure

```
src/
  app/
    api/chat/route.ts    # Streams chat completions from LM Studio
    api/models/route.ts  # Lists loaded chat models
    page.tsx             # Chat page
  components/chat.tsx    # Client chat UI
  lib/lm-studio.ts       # Base URL / model helpers
```

## How it works

YACB’s Next.js route handlers proxy to LM Studio:

- `GET /api/models` → `GET {LM_STUDIO_BASE_URL}/models`
- `POST /api/chat` → `POST {LM_STUDIO_BASE_URL}/chat/completions` (SSE stream)

The browser never talks to LM Studio directly; the Next.js server does.

## License

[MIT](./LICENSE)
