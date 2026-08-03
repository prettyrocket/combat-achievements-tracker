// The Wise Old Man pane.
//
// The only source here that needs nothing installed: WOM mirrors the official
// hiscores, which carry every skill level, so a name is the whole input. The
// hiscores send no CORS header of their own, which is why this goes through WOM
// rather than straight to Jagex (see lib/wiseoldman.ts).
//
// Levels only, and that shapes the pane. There are no achievements to diff and
// no plan to threaten, so the footer says how many levels it found rather than
// what it will take away, and the quest checklist stays somebody else's job --
// the hiscores have never heard of a quest.

import { useEffect, useRef, useState } from 'react'
import {
  fetchWomLevels,
  updatedLabel,
  WISE_OLD_MAN_URL,
  WomLookupError,
  type WomLookup,
} from '@/lib/wiseoldman'
import { ImportFooter } from '@/components/load/import-footer'

export interface WiseOldManPanelProps {
  /** Owned by the dialog and shared with the other account-shaped sources. */
  rsn: string
  /** Incremented by the dialog's Look up button. Zero means "not yet". */
  submitToken: number
  /** Lifted so the dialog's button can spin while this pane is fetching. */
  onBusyChange: (busy: boolean) => void
  /** Replaces every level, leaving quests alone -- this source has none. */
  onApply: (levels: Record<string, number>) => void
  onFinished: (remember: boolean) => void
}

export function WiseOldManPanel({
  rsn,
  submitToken,
  onBusyChange,
  onApply,
  onFinished,
}: WiseOldManPanelProps) {
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<WomLookup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef<AbortController | null>(null)

  useEffect(() => () => inFlight.current?.abort(), [])

  // Editing the name invalidates the last result. Runs on mount too, harmlessly.
  useEffect(() => {
    setFound(null)
    setError(null)
  }, [rsn])

  async function run() {
    if (busy || rsn.trim() === '') return
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    setBusy(true)
    onBusyChange(true)
    setError(null)
    setFound(null)
    try {
      // Found, not applied. Every other pane previews before it writes, and a
      // lookup that silently overwrote levels the moment it resolved was the
      // one thing in the old dialog that didn't ask first.
      setFound(await fetchWomLevels(rsn, controller.signal))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(
        err instanceof WomLookupError
          ? err.message
          : 'That lookup failed. Try again in a moment.',
      )
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false)
        onBusyChange(false)
      }
    }
  }

  // The dialog's Look up button lives above this pane, so it asks by bumping a
  // counter rather than calling in.
  useEffect(() => {
    if (submitToken === 0) return
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitToken])

  const stale = found === null ? null : updatedLabel(found.updatedAt)
  const count = found === null ? 0 : Object.keys(found.levels).length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <p className="text-muted-foreground text-sm">
          Every skill level, from the hiscores, via{' '}
          <a
            href={WISE_OLD_MAN_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground font-medium underline underline-offset-2"
          >
            Wise Old Man
          </a>
          . No plugin needed — enter your name above and press Look up.
        </p>

        {found && (
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-medium">{found.displayName}</span>
              {found.accountType !== null && found.accountType !== 'regular' && (
                <span className="text-muted-foreground"> · {found.accountType}</span>
              )}
              {stale !== null && <span className="text-muted-foreground"> · {stale}</span>}
            </p>
            {/* The date matters here more than anywhere: WOM holds whatever
                snapshot was last taken, and somebody who trained since then
                should see why the number is old rather than distrust the
                requirement filter. */}
            <p className="text-muted-foreground text-xs leading-snug">
              Carries <span className="text-foreground">{count} skill levels</span>. Your
              quests aren't on the hiscores, so those stay as you left them.
            </p>
          </div>
        )}

        <p className="text-muted-foreground text-xs leading-snug">
          Importing replaces every level with the account's. Quests and completed
          achievements are untouched.
        </p>
      </div>

      <ImportFooter
        status={
          error ??
          (found === null ? null : (
            <>
              This will set <span className="font-semibold text-emerald-400">{count} levels</span>{' '}
              from {found.displayName}.
            </>
          ))
        }
        tone={error === null ? 'text-foreground' : 'text-red-400'}
        alert={error !== null}
        label="Import"
        disabled={found === null}
        variant={found === null ? 'default' : 'success'}
        onApply={() => {
          if (!found) return
          onApply(found.levels)
          onFinished(true)
        }}
      />
    </div>
  )
}
