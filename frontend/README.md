# Praxis — Frontend

React 19 + Vite + Tailwind CSS v3 + Framer Motion + React Router 7.

**Setup, environment variables and the full project guide live in the
[root README](../README.md); the architecture map is
[ARCHITECTURE.md](../docs/ARCHITECTURE.md).** This file only covers what is specific to
`frontend/`.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173, /api/* proxied to the backend
npm run build    # production bundle
npm run lint     # eslint
npm test         # engine unit tests (node:test, no browser needed)
```

The dev server needs the backend on port 8000 (see the root README). To point at
a throwaway backend instead:
`VITE_API_TARGET=http://127.0.0.1:8001 npm run dev`.

## What lives where

```
src/
├── engine/      pure Boolean algebra — parser, laws, solver, sandbox, scoring
│                (no React, no DOM, no network; unit-tested in engine/__tests__)
├── state/       the single source of truth: progressStore + the puzzle session
├── services/    the only place that calls the API (apiClient + one module per
│                endpoint group)
├── config/      tunable numbers (gameRules.js) and storage keys
├── content/     tutorial copy; laws and levels come from <repo>/content/*.json
│                through the `@content` Vite alias
├── hooks/       UI-only hooks (device tier, popup placement, tutorial replay)
├── components/  presentational: animations/ puzzle/ tutorial/ laws/ layout/ ui/
├── pages/       one file per route screen
└── styles/      Tailwind entry + tokens / utilities / orientation / animations
```

Two things that bite if you do not know them:

1. **Style import order is load-bearing.** `main.jsx` imports `styles/index.css`
   first (the Tailwind layers), then tokens, utilities, orientation and
   animations, so a `praxis-*` utility still wins a same-specificity conflict
   against a Tailwind utility. An `@import` inside `styles/index.css` placed after
   the `@tailwind` directives is silently dropped by the build: it deletes every
   utility and keyframe without failing.
2. **Components do not touch the engine directly.** They emit events, `state/`
   calls the engine. `engine/` must never import from `components/`, `pages/`,
   `state/`, `services/` or `hooks/`.

## Routes

| Path | Screen |
|---|---|
| `/` | Landing |
| `/login`, `/register` | Auth |
| `/levels` | Level select (protected + tutorial-gated) |
| `/level/:levelId/stages` | Stage select |
| `/level/:levelId/stage/:stageIdx` | The puzzle workspace — used by every level |
| `/sandbox` | Sandbox input (type your own expression) |
| `/sandbox/play` | The same puzzle workspace, in sandbox mode |
