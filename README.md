# Combat Achievements Tracker

An interactive web app for exploring and tracking the Old School RuneScape
[Combat Achievements](https://oldschool.runescape.wiki/w/Combat_Achievements/All_tasks)
(646 tasks). Filter, search, sort by the wiki's global completion %, **narrow to one boss
or several** and see every task on them together, and track your own completions with
progress meters per tier.

It is a **static single-page app — no backend, no database.** Everything runs in the
browser.

> Design docs live in the author's Obsidian vault (`Projects/Combat Achievements Tracker`):
> Requirements, Design, Current State, Future State, Known Issues.

## Stack

- **Frontend** — React + TypeScript (Vite), TanStack Query + Table, Tailwind CSS,
  shadcn/ui.
- **Data** — fetched from the OSRS Wiki; see below.
- **Progress** — `localStorage`, with JSON export/import so it's portable between devices.
- **Hosting** — [GitHub Pages](https://prettyrocket.github.io/combat-achievements-tracker/),
  deployed by `.github/workflows/deploy.yml` on every push to `main`. Tests and `tsc -b`
  gate it, so a type error fails the deploy rather than shipping.
- **Formatting** — Prettier defaults (`npm run format`).

## Data sources

All anonymous, key-less, and CORS-open, so the browser can call them directly:

| What | Where |
|------|-------|
| The 646 tasks | Wiki **Bucket API**, `bucket('combat_achievement')` — one request, ~134 KB |
| Global completion % | `Module:Combat_Achievements/completion.json` (`action=raw`) — a flat `{taskId: pct}` map |
| Your skill levels | **Wise Old Man**, `api.wiseoldman.net/v2/players/<rsn>` |
| Your achievements, levels and quests | **RuneProfile**, `api.runeprofile.com/v1/accounts/<rsn>` |

The first two load with the app; the last two are fetched only when you ask, and never on
page load.

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

Ticking tasks by hand always works, and persists in `localStorage`. Everything else lives
behind one **Load** button: a dialog with your RuneScape name at the top and a rail of five
sources beside their instructions (`src/components/load-dialog.tsx`). The rail says what
each one carries, because that is the real difference between them — only three bring
achievements, and only one brings your planned list.

| Source | Carries | Needs |
|--------|---------|-------|
| **WikiSync** | Achievements, levels, quests | The plugin, and a paste |
| **RuneProfile** | Achievements, levels, quests | The plugin |
| **Wise Old Man** | Levels only | Nothing |
| **A backup file** | Everything, including your plan | A file this app exported |
| **By hand** | Levels and quests | Nothing |

It opens on whichever source you last imported from, and the name is remembered — typing it
counts, so someone who only ever enters levels by hand still gets the different-account
warning that protects their plan.

**WikiSync** is first on reach alone: ~335k Plugin Hub installs against RuneProfile's ~92k.
A top-level browser navigation sends no `Origin` header, so you open your own sync URL in
the address bar and paste the JSON back — which keeps the app off their API entirely. The
`combat_achievements` field is a flat array of task IDs mapping 1:1 onto the Bucket `id`.

> Log in with the plugin running and wait a few seconds; that's the whole procedure. The
> plugin reads CA completion out of the player varps and uploads on a 10-second timer
> (`@Schedule` in `WikiSyncPlugin`), so there is no interface to open and nothing to log
> out for. The collection log *is* gated on opening its interface, because it's populated
> by a script that only fires there — that requirement gets repeated about Combat
> Achievements, and it's wrong.

**RuneProfile** is the only API anywhere that serves per-task Combat Achievement completion
to a third party over CORS, so it needs no paste at all: type a name, press Look up. Its
plugin reads the same bit-packed CA varps. The `index` it returns was checked against the
wiki Bucket `id` across all 646 tasks — zero mismatches — so there is no mapping table.
Two traps are handled in `src/lib/runeprofile.ts`: never send a non-simple header (their
outer CORS middleware rejects the preflight), and a profile that hasn't synced since
2026-05-14 answers `200` with all 646 marked incomplete, which the tier summary catches.

**Wise Old Man** needs nothing installed. It mirrors the hiscores, which carry every skill
level, and answers `access-control-allow-origin: *` — the reason it's reachable from a
static site when the hiscores themselves aren't. Levels only; quests stay a checklist,
because the hiscores don't track those either.

## Filtering by what you can actually fight

The **Requirements** filter cycles *Any monster → Can face → Can't face yet*, and every
row whose monster is out of reach carries a lock. Hover or focus it and it says what the
gate asks for — "Requires 92 Slayer and the quest Priest in Peril". It needs to know your
levels and quests, which any of the sources above can supply. The **By hand** pane is the
one that can answer a question none of the others can: type a level you haven't earned yet
and the filter tells you what it would open up. When the filter has nothing to run on, it
opens Load straight onto that pane.

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
the strings are joined against imported quest names, and a near miss like `Desert Treasure
II` instead of `Desert Treasure II - The Fallen Empire` would read as "not done" forever
rather than as an error.

Re-checked 2026-08-02 across all 47 Bucket schemas: still nothing machine-readable. Slayer
levels are (`infobox_monster.slayer_level`), but quest gates fail three separate ways —
`infobox_npc.quest` means "appears in" rather than "unlocked by", bosses like Duke Sucellus
have no `infobox_npc` row at all, and page categories cover only 14 of the 31 gated bosses.

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
npm run format   # prettier --write .
```

`npm run build` is what the deploy runs, and it catches things `npx tsc --noEmit` doesn't —
it resolves a different config. Run it before pushing.

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
