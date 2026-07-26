---
name: dev
description: Control the Combat Achievements Tracker local dev server (Vite frontend — the app is a static SPA with no backend or database). Invoke as /dev [start|stop|status|restart|open] — default start. `start` opens a Windows Terminal window with a branch-named git tab and a color-coded frontend tab; the other subcommands check/stop/bounce what's running. Use when the user wants to start, check, stop, or restart local dev for this repo. Wraps scripts/dev.ps1.
---

# Dev server control

One entry point (`/dev`) to start, inspect, stop, and restart local dev for this repo.
`start` brings it up in one Windows Terminal window — a tab for the dev server plus a git
tab at the repo root — mirroring the "one window, tabs per piece" workflow.

**There is no backend and no database.** The app is a static SPA: task data comes from the
OSRS Wiki Bucket API (CORS-open, no key) and progress lives in `localStorage`. So "the
stack" is one Vite process on :5173. The mechanics live in **`scripts/dev.ps1`**; this
skill decides *when* to run each command and reports the result.

## Invoking this skill

Read the argument and dispatch:

| Invocation | Action |
|------------|--------|
| `/dev` *(no args)* | **start** — the default (see procedure below) |
| `/dev status` | run `dev.ps1 status`, report |
| `/dev stop` | run `dev.ps1 stop` |
| `/dev restart` | run `dev.ps1 restart` |
| `/dev open` | alias for `start` |

Map the argument straight to `dev.ps1 <command>`. Only `start`/`open` open a window;
`status`/`stop`/`restart` act on whatever is already running. Natural-language requests
("shut it down", "restart the frontend") map to the same commands. There are no targets —
if the user says `/dev stop frontend` or `/dev restart all` out of habit, drop the extra
word and run the plain command.

## The pieces

| Piece | Runs | Port | Tab (color) |
|-------|------|------|-------------|
| Git | interactive shell at repo root | — | **`<current branch>`** (purple) |
| Frontend | `npm run dev` (Vite) | 5173 | `frontend` (cyan) |

Tabs are color-coded (`--tabColor`) and use `--suppressApplicationTitle` so their titles
stick (Vite/npm would otherwise overwrite them). The git tab is titled with the current
branch/worktree so you always know where you are. Colors are defined in `dev.ps1`
(`$Colors`).

## Commands

Always invoke with an explicit execution policy so it runs regardless of the machine default:

```powershell
pwsh -ExecutionPolicy Bypass -File scripts\dev.ps1 <command>
```

| Command | Effect |
|---------|--------|
| `start` | Open the `ca-dev` window with the git + frontend tabs. |
| `open` | Same as `start`. |
| `status` | Print frontend state (up/down + PID). No side effects. |
| `stop` | Kill whatever is listening on :5173. |
| `restart` | Kill it, then open a fresh tab running `npm run dev`. |

No command needs elevation — nothing here is a Windows service.

## Procedure for `/dev`

1. **Confirm environment.** This is Windows-only and needs Windows Terminal (`wt`). If `wt`
   isn't found, say so and stop.
2. **Check first, don't blindly launch.** Run `dev.ps1 status`.
   - If the frontend is already UP, report that and ask whether to `restart` instead of
     opening a duplicate tab.
3. **Start.** Otherwise run `dev.ps1 start`.
4. **Report.** After launching, wait briefly, run `dev.ps1 status`, and report the URL:
   `http://localhost:5173`. Vite's live log is in its tab.

## Monitoring / killing / restarting

- "Is it running?" / "what's up?" → `dev.ps1 status`.
- "Stop it" / "shut it down" → `dev.ps1 stop`.
- "Restart the frontend" → `dev.ps1 restart`.
- Killing it frees :5173; Ctrl+C inside the tab does the same.

## Guardrails / notes

- The `ca-dev` window is reused by name: `restart` adds a tab to it. Re-running `start`
  while the server is up can create duplicate tabs — that's why step 2 checks `status` first.
- If a command fails because it can't find a process on :5173, that usually just means the
  server isn't running — report "already down", don't retry.
