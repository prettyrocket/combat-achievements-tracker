import type { Task, Meta, ProgressSummary, MonsterSummary, TaskQuery } from './types'

const BASE = '/api'

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function toParams(q: TaskQuery = {}): string {
  const p = new URLSearchParams()
  q.tier?.forEach((t) => p.append('tier', t))
  q.type?.forEach((t) => p.append('type', t))
  if (q.monster) p.set('monster', q.monster)
  if (q.q) p.set('q', q.q)
  if (q.completed !== undefined) p.set('completed', String(q.completed))
  if (q.sort) p.set('sort', q.sort)
  const s = p.toString()
  return s ? `?${s}` : ''
}

// Typed client for the backend REST API. Endpoints are implemented across
// backend issues #1–5; the shapes are fixed now so the UI can be built against them.
export const api = {
  meta: () => http<Meta>('/meta'),
  tasks: (q?: TaskQuery) => http<Task[]>(`/tasks${toParams(q)}`),
  task: (wikiId: number) => http<Task>(`/tasks/${wikiId}`),
  monsters: () => http<MonsterSummary[]>('/monsters'),
  monsterTasks: (monster: string) =>
    http<Task[]>(`/monsters/${encodeURIComponent(monster)}/tasks`),
  setProgress: (wikiId: number, completed: boolean) =>
    http<Task>(`/tasks/${wikiId}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ completed }),
    }),
  importProgress: (completedWikiIds: number[]) =>
    http<ProgressSummary>('/progress/import', {
      method: 'POST',
      body: JSON.stringify({ completedWikiIds }),
    }),
  resetProgress: () => http<void>('/progress', { method: 'DELETE' }),
  summary: () => http<ProgressSummary>('/progress/summary'),
  sync: () => http<unknown>('/sync', { method: 'POST' }),
}

// Health lives outside /api (Spring Actuator). The scaffold uses it as a liveness ping.
export async function backendHealth(): Promise<'UP' | 'DOWN'> {
  try {
    const res = await fetch('/actuator/health')
    if (!res.ok) return 'DOWN'
    const j = (await res.json()) as { status?: string }
    return j.status === 'UP' ? 'UP' : 'DOWN'
  } catch {
    return 'DOWN'
  }
}
