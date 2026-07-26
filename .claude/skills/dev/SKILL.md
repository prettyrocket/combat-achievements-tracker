---
name: dev
description: Control the Combat Achievements Tracker local dev stack (PostgreSQL + Spring Boot backend + Vite frontend). Invoke as /dev [start|stop|status|restart|open] [target] — default start. `start` opens a Windows Terminal window with a color-coded tab per piece plus a branch-named git tab; the other subcommands check/stop/bounce what's running. Use when the user wants to start, check, stop, or restart the local dev servers for this repo. Wraps scripts/dev.ps1.
---

# Dev stack control

One entry point (`/dev`) to start, inspect, stop, and restart the full local stack for this
repo. `start` brings it up in one Windows Terminal window — a tab per long-running process
plus a git tab at the repo root — mirroring the "one window, tabs per piece" workflow.

The mechanics live in **`scripts/dev.ps1`** (control) and **`scripts/psql.ps1`** (the db
tab's launcher). This skill decides *when* to run each command and reports the result.

## Invoking this skill

This skill drives the whole stack, not just startup. Read the argument and dispatch:

| Invocation | Action |
|------------|--------|
| `/dev` *(no args)* | **start** — the default (see procedure below) |
| `/dev status` | run `dev.ps1 status`, report |
| `/dev stop [backend\|frontend\|db\|all]` | run `dev.ps1 stop [target]` (default `all`) |
| `/dev restart [backend\|frontend\|db\|all]` | run `dev.ps1 restart [target]` |
| `/dev open` | open the window without touching Postgres |

Map the argument straight to `dev.ps1 <command> [target]`. Only `start`/`open` open a
window; `status`/`stop`/`restart` act on whatever is already running. `stop all` and
`stop db` raise a UAC prompt (stopping the Postgres service) — warn the user first.
Natural-language requests ("shut it all down", "restart the backend") map to the same
commands.

## The pieces

| Piece | Runs | Port | Tab (color) |
|-------|------|------|-------------|
| PostgreSQL 17 | Windows service `postgresql-x64-17` (Manual start) | 5432 | — (service, no tab) |
| Git | interactive shell at repo root | — | **`<current branch>`** (purple) |
| Backend | `./gradlew.bat bootRun` (Spring Boot) | 8080 | `backend` (green) |
| Frontend | `npm run dev` (Vite) | 5173 | `frontend` (cyan) |
| DB console | `psql` → `combat_achievements` (via `psql.ps1`) | — | `db` (blue) |
| PG log tail | `Get-Content -Wait` on newest PG log (via `pglog.ps1`) | — | `pg-logs` (amber) |

Tabs are color-coded (`--tabColor`) and use `--suppressApplicationTitle` so their titles
stick (Vite/npm/psql would otherwise overwrite them). The git tab is titled with the
current branch/worktree so you always know where you are. Colors are defined in `dev.ps1`
(`$Colors`).

## Commands

Always invoke with an explicit execution policy so it runs regardless of the machine default:

```powershell
pwsh -ExecutionPolicy Bypass -File scripts\dev.ps1 <command> [target]
```

| Command | Effect |
|---------|--------|
| `start` | Ensure Postgres is running (UAC prompt if it's stopped), then open the `ca-dev` window with all tabs. |
| `open` | Open the window **without** touching Postgres. |
| `status` | Print Postgres/backend/frontend state (up/down + PIDs). No side effects. |
| `stop [backend\|frontend\|db\|all]` | Kill the piece(s). `all` (default) stops backend + frontend + Postgres. `db`/`all` need a UAC prompt. |
| `restart [backend\|frontend\|db\|all]` | Bounce the piece: kill it, then open a fresh tab running it (or Restart-Service for `db`). |

## Procedure for `/dev`

1. **Confirm environment.** This is Windows-only and needs Windows Terminal (`wt`). If `wt`
   isn't found, say so and stop.
2. **Check first, don't blindly launch.** Run `dev.ps1 status`.
   - If backend and frontend are already UP, report that and ask whether to `restart` instead
     of opening duplicate tabs.
3. **Start.** Otherwise run `dev.ps1 start`. Postgres starting will raise a **UAC prompt** —
   tell the user to approve it.
4. **Report.** After launching, wait briefly, run `dev.ps1 status`, and report the URLs:
   backend `http://localhost:8080` (health `/actuator/health`), frontend `http://localhost:5173`.
   The processes' live logs are in their tabs.

## Monitoring / killing / restarting

- "Is X running?" / "what's up?" → `dev.ps1 status`.
- "Stop the frontend" → `dev.ps1 stop frontend`. "Shut it all down" → `dev.ps1 stop all`.
- "Restart the backend" → `dev.ps1 restart backend`.
- Killing a piece frees its port; Ctrl+C inside a tab does the same for just that process.

## Guardrails / notes

- **Postgres is a Windows service, not a tab.** `start` starts it via an elevated
  `Start-Service` (one UAC prompt); it has no console to show.
- Postgres start type is **Manual** (nothing auto-starts on boot — deliberate). This skill
  starts it on demand; it does not change the start type.
- The `ca-dev` window is reused by name: `restart` adds a tab to it. Re-running `start` while
  servers are up can create duplicate tabs — that's why step 2 checks `status` first.
- Dev DB credentials (`postgres`/`postgres`, localhost) are dev-only and live in
  `scripts/psql.ps1` — never use these outside local dev.
- Backend runs on JDK 21 via `backend/gradle.properties` (`org.gradle.java.home`); this skill
  does not touch the machine `JAVA_HOME`.
