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
| Your skill levels | **Wise Old Man**, `api.wiseoldman.net/v2/players/<rsn>` — on request only, never on load |

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

The official hiscores are not an alternative either, on two counts. Combat Achievements
are not among their 91 tracked activities, not even as a points total — Collections Logged
made that list and CAs didn't. And `secure.runescape.com` answers with no
`Access-Control-Allow-Origin` header at all, so the browser can't read them directly
whatever they carried. Every tracker that uses the hiscores proxies them server-side.

## Importing your progress

1. **Manual** — click tasks; state persists in `localStorage`.
2. **WikiSync JSON paste** — a top-level browser navigation sends no `Origin` header, so
   you can open your own sync URL in the address bar (or `curl` it) and paste the JSON in.
   The `combat_achievements` field is a flat array of task IDs that maps 1:1 onto the
   Bucket `id`. This keeps the app off their API entirely.

   Requires the WikiSync plugin from the RuneLite Plugin Hub. Log in with it running and
   wait a few seconds — that's all. The plugin reads CA completion straight out of the
   player varps and uploads on a 10-second timer (`@Schedule` in `WikiSyncPlugin`), so
   there is no interface to open and nothing to log out for. The collection log *is*
   gated on opening its interface, because it's populated by a script that only fires
   there; that requirement is often repeated about Combat Achievements, and it's wrong.

   The same payload also carries `levels` and `quests`, which is where the requirement
   filter below gets its answers. Both are read from the paste; neither is required.
3. **Wise Old Man lookup** (levels only) — type a name, get every skill level, no plugin
   and no paste. WOM already scrapes and caches the hiscores, publishes the result for
   third parties deliberately, and answers `access-control-allow-origin: *`, which is what
   makes it reachable from a static site when the hiscores themselves aren't. It fills the
   skills half of the profile below and never touches your progress; quests stay a
   checklist, because the hiscores don't track those either. See `src/lib/wiseoldman.ts`.

## Filtering by what you can actually fight

The **Requirements** filter cycles *Any monster → Can face → Can't face yet*, and every
row whose monster is out of reach carries a lock. Hover or focus it and it says what the
gate asks for — "Requires 92 Slayer and the quest Priest in Peril". It needs to know your
levels and quests, which come from a WikiSync paste, a Wise Old Man lookup (levels only),
or **My levels**, where you can also type a hypothetical — "what opens up at 92 Slayer" is
the same question.

Three kinds of gate are modelled: **Slayer level**, **other skill levels that gate the
route** (70 Ranged for the grapple into Armadyl's Eyrie, 50 Firemaking for Wintertodt),
and **quest completion**. Consumable keys, kill counts, and Callisto's "medium Wilderness
diary *or* a boss task" are deliberately left out — treating those as requirements would
hide rows you can go and do tonight. 56 of the 89 monsters are gated; the rest are open to
everyone.

### Why that table is hand-written

`src/lib/requirements.ts` is the one data set in the app nobody generated, because the
wiki has no machine-readable answer to "what do I need to fight this". `bucket('quest')`
has a `requirements` field and it is free-form wikitext; nothing anywhere maps a monster
to the quest that unlocks the door in front of it.

So it's curated — and then checked, on both halves that *can* be checked:

```bash
npm run check-requirements   # exits 1 on a disagreement
```

`bucket('infobox_monster')` does carry `slayer_level`, so every Slayer number is verified
against it in both directions: one we claim that the wiki disagrees with, and one the wiki
gates on that we've missed (which is what a new release looks like). Every quest name is
verified to be a real quest spelled the way the game spells it — that one matters because
the strings are joined against a WikiSync paste, and a near miss like `Desert Treasure II`
instead of `Desert Treasure II - The Fallen Empire` would read as "not done" forever
rather than as an error.

## Prerequisites

- **Node 20+**

## Running

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
npm run lint
npm run test
```

Every task row links out to the wiki — to the task's own article and to its monster's
page. Both are built from names, so after `npm run refresh-data` run:

```bash
npm run check-links   # 735 links, 15 batched API calls; exits 1 on a dead one
```

A new CA release reaches the Bucket API before the wiki necessarily has an article for
every new task, and a link built from a name that has no page yet would ship silently.
Run `npm run check-requirements` at the same time, for the same reason: a release that
adds a boss adds a gate nobody has written down yet.

On Windows, `/dev` (see `.claude/skills/dev/`) wraps `scripts/dev.ps1` to open a Windows
Terminal window with git + Vite tabs.

## Repository layout

```
frontend/   React + TypeScript SPA (the whole app)
scripts/    dev.ps1 — local dev window control (Windows)
```

## License

MIT (see `LICENSE`).
