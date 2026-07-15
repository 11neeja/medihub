---
name: verify
description: Build, launch, and drive the MediHub frontend to verify changes end-to-end
---

# Verifying MediHub frontend changes

Monorepo: `frontend/` = Next.js 14 (deployed on Vercel), `backend/` = Express on Render
(free-tier instance sleeps → 1–2 min cold starts; the frontend must never block first
paint on the API).

## Build & launch

```bash
cd frontend && npm run build      # NEXT_PUBLIC_API_URL unset → baked-in fallback http://localhost:5000/api
npx next start -p 3000            # keep as a persistent background task
```

Gotchas (cost real time once):
- After a rebuild, ALWAYS kill the old `next start` first — TaskStop can leave the child
  node process alive, which then serves stale in-memory HTML whose chunk hashes 400
  against the new `.next/`. Result: page "renders" (SSR HTML) but never hydrates and
  makes zero API calls. Free the port with PowerShell:
  `Get-NetTCPConnection -LocalPort 3000 -State Listen | % OwningProcess | % { Stop-Process -Id $_ -Force }`
- Right after killing a listener, a probe may time out (exit 28) instead of refusing —
  teardown noise, re-check before concluding.

## Simulate the cold Render backend

`scratchpad/stub-backend.js` pattern: node http server on :5000, `/api/health` answers
after 60s, `/api/users/me` after 15s (200 for `Bearer VALID_TOKEN`, else 401), everything
else 60s→404, log each request with timestamps — the log is the proof the page painted
while requests were pending.

## Drive with system Chrome

`npm i puppeteer-core` (scratchpad, no Chromium download), executablePath
`C:/Program Files/Google/Chrome/Application/chrome.exe`, headless 'new'.

- Seed a session: load `/login`, set `localStorage.token` + `token_expires_at`, then
  navigate — localStorage is per-origin.
- Text assertions on `innerText` must be case-insensitive: the design system uppercases
  labels via CSS and innerText returns rendered case.
- The landing content stays in the DOM under the SessionSplash overlay — assert on
  `document.querySelector('[role=status]')` (splash) presence/absence, not on landing text.
- Body children no longer carry a z-index (the old `body > * { z-index: 2 }` trapped
  in-page modals below the navbar — fixed 2026-07-16). In-page overlays with z > 50
  (`.modal-overlay` is 100, `.toast` is 120) now cover the sticky navbar (z-50) without
  portaling; the grain texture sits at `body::before { z-index: -1 }` and must stay negative.
- To drive the events "View details" modal without a backend: seed
  `localStorage.medihub_events_cache_v2` (JSON array of events) + `_ts` = Date.now() —
  the page renders straight from cache.

## Flows worth driving

1. Anonymous `/` with backend hanging → hero visible <300ms, no splash, health wake-ping fired.
2. Seeded valid token → splash (covers navbar), "waking up" hint at 5s, redirect `/home` when /users/me resolves.
3. Seeded invalid token → splash until 401, then landing + token cleared.
4. Backend fully down + token → splash dismisses fast, token KEPT, landing shows.
5. Anonymous deep-link `/home` → redirect `/login` in <1s.
