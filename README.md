"# SavetheDate-A" 

## Getting started

Requires Node.js 22.12+.

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY; never commit it
npm run dev                  # http://localhost:3000
```

Other scripts: `npm test` (Vitest), `npm run typecheck` (tsc), `npm run build`.

Tests live in `tests/`: `*.test.ts` runs in Node, `*.test.tsx` runs in jsdom with Testing Library.
See `workstreams/CONTRACT.md` for the shared types, API and file ownership.
