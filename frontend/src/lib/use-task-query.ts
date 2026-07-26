// Keeps the filter state in the query string.
//
// The URL is the single source of truth rather than a mirror of component state:
// that's what makes a filtered view shareable, and it means back/forward work
// without any extra bookkeeping.

import { useCallback, useEffect, useState } from 'react'
import { parseQuery, serializeQuery } from '@/lib/task-query'
import type { TaskQuery } from '@/lib/types'

function currentQuery(): TaskQuery {
  if (typeof window === 'undefined') return {}
  return parseQuery(new URLSearchParams(window.location.search))
}

export interface UseTaskQuery {
  query: TaskQuery
  setQuery: (next: TaskQuery) => void
  clear: () => void
}

export function useTaskQuery(): UseTaskQuery {
  const [query, setQueryState] = useState<TaskQuery>(currentQuery)

  // Back/forward move through filter states, so they have to be listened for --
  // popstate doesn't fire for our own pushState calls, only for navigation.
  useEffect(() => {
    const onPopState = () => setQueryState(currentQuery())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const setQuery = useCallback((next: TaskQuery) => {
    setQueryState(next)

    const params = serializeQuery(next).toString()
    // Keep the path and hash; only the search is ours to rewrite. A bare pathname
    // when there are no filters avoids leaving a lone "?" in the address bar.
    const url = params
      ? `${window.location.pathname}?${params}${window.location.hash}`
      : `${window.location.pathname}${window.location.hash}`

    // pushState, not replaceState: each filter change is somewhere the user can
    // meaningfully go back to.
    window.history.pushState(null, '', url)
  }, [])

  const clear = useCallback(() => setQuery({}), [setQuery])

  return { query, setQuery, clear }
}
