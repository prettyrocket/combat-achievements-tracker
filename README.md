# Combat Achievements Tracker

An interactive web app for exploring and tracking the Old School RuneScape
[Combat Achievements](https://oldschool.runescape.wiki/w/Combat_Achievements/All_tasks)
(646 tasks). Filter, search, sort by the wiki's global completion %, **pivot** from any
task to every task on the same boss, and track your own completions with progress meters
per tier.

It is a **static single-page app — no backend, no database.** Everything runs in the
browser.

> Design docs live in the author's Obsidian vault (`Projects/Combat Achievements Tracker`):
> Requirements, Design, Current State, Future State, Known Issues.

## Stack

- **Frontend** — React + TypeScript (Vite), TanStack Query + Table, Tailwind CSS,
  shadcn/ui.
- **Data** — fetched from the OSRS Wiki; see below.
- **Progress** — `localStorage`, with JSON export/import so it's portable between devices.
- **Hosting** — any static host (`vite build` → `dist/`).

## Data sources

Both are anonymous, key-less, and CORS-open, so the browser can call them directly:

| What | Where |
|------|-------|
| The 646 tasks | Wiki **Bucket API**, `bucket('combat_achievement')` — one request, ~134 KB |
| Global completion % | `Module:Combat_Achievements/completion.json` (`action=raw`) — a flat `{taskId: pct}` map |

```
https://oldschool.runescape.wiki/api.php?action=bucket&format=json&origin=*
  &query=bucket('combat_achievement').select('id','name','monster','tier','type','task','league_region').limit(2000).run()
```

The task `id` (0–645) is the stable natural key and is what everything else joins on.

## Why there's no backend

The original plan was Spring Boot + Postgres. The only thing that actually needed a server
was proxying [WikiSync](https://oldschool.runescape.wiki/w/RuneScape:WikiSync) — the
RuneLite plugin that powers the wiki's player-lookup boxes — because its endpoint
(`sync.runescape.wiki/runelite/player/<rsn>/STANDARD`) is **Origin-gated**: requests
carrying `Origin: https://oldschool.runescape.wiki` get 200, any other origin gets **403**.
A browser app on its own domain simply cannot call it.

But the wiki asks third parties not to proxy it either:

> The WikiSync plugin and the associated API is intended for use by the wiki, and not by
> third-party developers. Please do not use the WikiSync API in your own projects.

So the one job the backend had was a job we shouldn't do. With that gone, the server was
carrying a 134 KB static file, and everything that makes this app worth building —
pivot-by-boss, sort-by-completion-%, filtering, progress meters — is client-side work over
646 rows. The backend was deleted; it's recoverable from git history if that changes.

The official hiscores are not an alternative: Combat Achievements are not among their 90
tracked activities, not even as a points total.

## Importing your progress

1. **Manual** — click tasks; state persists in `localStorage`.
2. **WikiSync JSON paste** — a top-level browser navigation sends no `Origin` header, so
   you can open your own sync URL in the address bar (or `curl` it) and paste the JSON in.
   The `combat_achievements` field is a flat array of task IDs that maps 1:1 onto the
   Bucket `id`. This keeps the app off their API entirely.

   Requires the WikiSync plugin from the RuneLite Plugin Hub. You must **open the Combat
   Achievements interface in-game at least once** while it's running, then log out — that's
   what populates the CA list.

## Prerequisites

- **Node 20+**

## Running

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
npm run lint
```

On Windows, `/dev` (see `.claude/skills/dev/`) wraps `scripts/dev.ps1` to open a Windows
Terminal window with git + Vite tabs.

## Repository layout

```
frontend/   React + TypeScript SPA (the whole app)
scripts/    dev.ps1 — local dev window control (Windows)
```

## License

MIT (see `LICENSE`).
