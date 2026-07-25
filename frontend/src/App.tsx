import { useQuery } from '@tanstack/react-query'
import { backendHealth } from './api/client'
import { TIERS, TIER_POINTS, type Tier } from './api/types'

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

function HealthBadge() {
  const { data, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: backendHealth,
    refetchInterval: 10_000,
  })
  const up = data === 'UP'
  const label = isLoading ? 'checking…' : up ? 'backend: UP' : 'backend: down'
  const cls = isLoading
    ? 'bg-neutral-700 text-neutral-300'
    : up
      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
      : 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>{label}</span>
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
        <HealthBadge />
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
          Vite + React + TypeScript + Tailwind v4 + TanStack Query/Table are wired up, with a
          dev proxy to the Spring Boot API. Next up (tracked as GitHub issues): the task table
          (#8), filters/search/sort with URL state (#9), pivot-by-monster (#10), progress
          toggles + per-tier meters (#11), and the import modal (#12) — once the backend data
          endpoints (#1–5) are live.
        </p>
      </section>
    </div>
  )
}
