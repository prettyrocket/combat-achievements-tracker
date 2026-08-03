// The RuneProfile lookup.
//
// Structurally the WikiSync dialog minus the ritual: no URL to open, no
// clipboard, no textarea. A name goes in, two fetches go out, and the same diff
// machinery decides what the button says. What it buys over the paste is only
// the paste itself -- the data underneath is the same three facts -- so this is
// offered as a second door and never as the recommended one.
//
// The failure that gets the most room here is the one that isn't a failure on
// the wire: a profile that predates RuneProfile's per-task storage answers 200
// with every task incomplete. lib/runeprofile.ts turns that into STALE_PROFILE,
// and the footer gives it a fix rather than a shrug, because the alternative is
// telling a maxed account it has done nothing.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2, Search } from 'lucide-react'
import {
  fetchRuneProfile,
  RUNEPROFILE_PLUGIN_URL,
  RUNEPROFILE_URL,
  RuneProfileError,
  syncedLabel,
  type RuneProfileImport,
} from '@/lib/runeprofile'
import { diffAgainst, diffIsNoop, sameAccount } from '@/lib/wikisync'
import type { WikiSyncDiff } from '@/lib/wikisync'
import { gatedQuests, normalizeQuest, type PlayerProfile } from '@/lib/requirements'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const GATE_QUESTS = gatedQuests().map(normalizeQuest)

/** What the paste dialog uses, so the two read as one app. */
const TAKES = 'font-semibold text-red-400'
const GIVES = 'font-semibold text-emerald-400'

function word(value: number) {
  return value === 1 ? 'one' : String(value)
}

function countGateQuests(profile: PlayerProfile): number {
  const finished = new Set(profile.quests.map(normalizeQuest))
  return GATE_QUESTS.filter((quest) => finished.has(quest)).length
}

export interface RuneProfileDialogProps {
  completed: ReadonlySet<number>
  listCount: number
  lastRsn: string | null
  onApply: (
    ids: number[],
    rsn: string,
    clearList: boolean,
    profile: PlayerProfile | null,
  ) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RuneProfileDialog({
  completed,
  listCount,
  lastRsn,
  onApply,
  open,
  onOpenChange,
}: RuneProfileDialogProps) {
  const [rsn, setRsn] = useState('')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<RuneProfileImport | null>(null)
  const [diff, setDiff] = useState<WikiSyncDiff | null>(null)
  const [error, setError] = useState<{ message: string; code: string } | null>(null)
  const [clearList, setClearList] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const inFlight = useRef<AbortController | null>(null)

  useEffect(() => () => inFlight.current?.abort(), [])

  const differentAccount =
    lastRsn !== null && rsn.trim() !== '' && !sameAccount(rsn, lastRsn) && listCount > 0

  function resetState() {
    setFound(null)
    setDiff(null)
    setError(null)
    setBusy(false)
    setConfirming(false)
    setClearList(false)
    inFlight.current?.abort()
  }

  async function run() {
    if (busy || rsn.trim() === '') return
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    setBusy(true)
    setError(null)
    setFound(null)
    setDiff(null)
    setConfirming(false)
    try {
      const imported = await fetchRuneProfile(rsn, controller.signal)
      setFound(imported)
      // The diff has never cared where the ids came from, so this is the same
      // call the paste makes -- RuneProfileImport is shaped to fit it.
      setDiff(diffAgainst(imported, completed))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(
        err instanceof RuneProfileError
          ? { message: err.message, code: err.code }
          : { message: 'That lookup failed. Try again in a moment.', code: 'BAD_RESPONSE' },
      )
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  function handleApply() {
    if (!diff || !found) return
    if (diff.removed.length > 0 && !confirming) {
      setConfirming(true)
      return
    }
    onApply(
      [...diff.newlyCompleted, ...diff.alreadyCompleted],
      found.displayName,
      differentAccount && clearList,
      found.profile,
    )
    onOpenChange(false)
    resetState()
  }

  function statusMessage(): { tone: string; text: ReactNode } {
    // Stale gets amber and a fix, not red and a dead end -- the account is fine,
    // it just hasn't spoken to RuneProfile since they started storing this.
    if (error) {
      return {
        tone: error.code === 'STALE_PROFILE' ? 'text-amber-400' : 'text-red-400',
        text: error.message,
      }
    }
    if (!diff || !found) return { tone: '', text: null }

    const removed = diff.removed.length
    const added = diff.newlyCompleted.length
    const plain = 'text-foreground'

    if (removed > 0 && added > 0) {
      return {
        tone: plain,
        text: (
          <>
            This will <span className={TAKES}>remove {word(removed)}</span> completed task
            {removed === 1 ? '' : 's'} and <span className={GIVES}>add {word(added)}</span>.
          </>
        ),
      }
    }
    if (removed > 0) {
      return {
        tone: plain,
        text: (
          <>
            This will <span className={TAKES}>remove {word(removed)}</span> completed task
            {removed === 1 ? '' : 's'}.
          </>
        ),
      }
    }
    if (added > 0) {
      return {
        tone: plain,
        text: (
          <>
            This will <span className={GIVES}>mark {word(added)}</span> task
            {added === 1 ? '' : 's'} complete.
          </>
        ),
      }
    }
    if (differentAccount && clearList) {
      return {
        tone: plain,
        text: (
          <>
            This will <span className={TAKES}>clear your {word(listCount)}</span> planned task
            {listCount === 1 ? '' : 's'}.
          </>
        ),
      }
    }
    return {
      tone: 'text-emerald-400',
      text: (
        <>
          <span aria-hidden>✅</span> Already up to date.
        </>
      ),
    }
  }

  function applyLabel() {
    if (!diff) return 'Import'
    if (diff.removed.length > 0) return confirming ? 'Confirm' : 'Replace'
    if (diffIsNoop(diff)) return differentAccount && clearList ? 'Clear' : 'Import'
    return 'Import'
  }

  const status = statusMessage()
  const synced = found === null ? null : syncedLabel(found.updatedAt)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) resetState()
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from RuneProfile</DialogTitle>
          <DialogDescription>
            Brings your Combat Achievements, levels and quests over in one go — no paste.
            Needs the{' '}
            <a
              href={RUNEPROFILE_PLUGIN_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground font-medium underline underline-offset-2"
            >
              RuneProfile plugin
            </a>
            , and only works if your profile is on{' '}
            <a
              href={RUNEPROFILE_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground font-medium underline underline-offset-2"
            >
              runeprofile.com
            </a>
            . If it isn't, use the WikiSync paste instead.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            value={rsn}
            onChange={(event) => {
              setRsn(event.target.value)
              // A new name invalidates whatever the last one found, including
              // an armed destructive apply.
              setFound(null)
              setDiff(null)
              setError(null)
              setConfirming(false)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              void run()
            }}
            placeholder="Your RuneScape name"
            aria-label="RuneScape name"
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            variant="outline"
            className="shrink-0"
            disabled={busy || rsn.trim() === ''}
            onClick={() => void run()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Search className="size-4" aria-hidden />
            )}
            {busy ? 'Looking' : 'Look up'}
          </Button>
        </div>

        {/* What arrived, and how old it is. The date is not decoration: only the
            player can refresh a RuneProfile, so someone importing a month-old
            snapshot needs to know that before they trust the numbers. */}
        {found && (
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-medium">{found.displayName}</span>
              {found.accountType !== null && found.accountType !== 'regular' && (
                <span className="text-muted-foreground"> · {found.accountType}</span>
              )}
              {synced !== null && <span className="text-muted-foreground"> · {synced}</span>}
            </p>
            <p className="text-muted-foreground text-xs leading-snug">
              Carries{' '}
              <span className="text-foreground">
                {found.ids.length} completed task{found.ids.length === 1 ? '' : 's'}
              </span>
              {found.profile && (
                <>
                  ,{' '}
                  <span className="text-foreground">
                    {Object.keys(found.profile.levels).length} skill levels
                  </span>{' '}
                  and{' '}
                  <span className="text-foreground">
                    {countGateQuests(found.profile)} of {GATE_QUESTS.length} quests
                  </span>{' '}
                  that gate a boss
                </>
              )}
              .
            </p>
          </div>
        )}

        {differentAccount && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <Checkbox
              checked={clearList}
              onCheckedChange={(next) => {
                setClearList(next === true)
                setConfirming(false)
              }}
              className="mt-0.5"
            />
            <span className="leading-tight">
              <span className="font-medium text-amber-300">
                This is a different account from your last import.
              </span>
              <span className="text-muted-foreground block text-xs">
                Your {listCount} planned task{listCount === 1 ? ' was' : 's were'} added while
                you were syncing <span className="text-foreground">{lastRsn}</span>. Tick to
                clear the list too; leave it to keep it.
              </span>
            </span>
          </label>
        )}

        <DialogFooter className="sm:items-center sm:justify-between">
          <p
            role={error && error.code !== 'STALE_PROFILE' ? 'alert' : 'status'}
            className={`text-xs leading-snug text-balance sm:flex-1 sm:pr-2 ${status.tone}`}
          >
            {status.text}
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:shrink-0">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleApply}
              disabled={
                diff === null || (diffIsNoop(diff) && !(differentAccount && clearList))
              }
              variant={
                !diff
                  ? 'default'
                  : diff.removed.length > 0 || clearList
                    ? 'destructive'
                    : diff.newlyCompleted.length > 0
                      ? 'success'
                      : 'default'
              }
            >
              {applyLabel()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
