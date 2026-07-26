import { TIERS, TIER_POINTS, type Tier } from './lib/types'

// Tailwind utility classes per tier — a small taste of the styling system.
const TIER_STYLES: Record<Tier, string> = {
  EASY: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  MEDIUM: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  HARD: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
  ELITE: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  MASTER: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  GRANDMASTER: 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30',
}

function titleCase(t: Tier): string {
  return t[0] + t.slice(1).toLowerCase()
}

export default function App() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
            Combat Achievements Tracker
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            OSRS · 646 tasks · data from the wiki Bucket API
          </p>
        </div>
        <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">
          static · no server
        </span>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Tiers</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {TIERS.map((tier) => (
            <span
              key={tier}
              className={`rounded-md px-2.5 py-1 text-sm font-medium ring-1 ${TIER_STYLES[tier]}`}
            >
              {titleCase(tier)} · {TIER_POINTS[tier]}pt
            </span>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
        <h2 className="text-base font-semibold text-neutral-200">Scaffold ready 🎉</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Vite + React + TypeScript + Tailwind v4 + TanStack Query/Table are wired up. The app
          is now fully client-side: task data comes straight from the wiki Bucket API and
          progress lives in localStorage. Next up: the data-fetch script, the task table,
          filters/search/sort with URL state, pivot-by-monster, progress toggles + per-tier
          meters, and WikiSync JSON import.
        </p>
      </section>
    </div>
  )
}
