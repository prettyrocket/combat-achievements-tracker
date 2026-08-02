// Your levels and quests, by hand -- or as close to not by hand as each half
// can get.
//
// The fast path is WikiSync: the same paste that brings your Combat
// Achievements over also carries every skill level and every quest state, so
// most people should never open this. It exists for the rest: no RuneLite, an
// account WikiSync has never seen, or the genuinely useful case of asking "what
// opens up if I get Slayer to 92".
//
// The skills half has a second way in that needs nothing installed at all --
// type a name, and Wise Old Man's copy of the hiscores fills in all of it (see
// wiseoldman.ts). There is no equivalent for quests, because the hiscores do
// not track them, so that column stays a checklist.
//
// Both halves are derived from requirements.ts rather than listed here. Ten
// skills and twenty quests are exactly the ones some gate actually asks for, so
// adding a gate on Runecrafting puts a Runecrafting box in this form and nobody
// has to remember to come and add it.

import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import {
  GATED_SKILLS,
  gatedQuests,
  normalizeQuest,
  questLabel,
  type PlayerProfile,
} from '@/lib/requirements'
import type { ProfileSource } from '@/lib/profile-store'
import {
  fetchWomLevels,
  updatedLabel,
  WISE_OLD_MAN_URL,
  WomLookupError,
  type WomLookup,
} from '@/lib/wiseoldman'
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
  DialogTrigger,
} from '@/components/ui/dialog'

const QUESTS = gatedQuests()

export interface ProfileDialogProps {
  profile: PlayerProfile
  isEmpty: boolean
  source: ProfileSource
  /** Controlled, because the requirement filter opens this when it has nothing
   *  to filter on -- the one place the dialog is reached from outside itself. */
  open: boolean
  onOpenChange: (open: boolean) => void
  onSetLevel: (skill: string, level: number) => void
  /** Every level at once, from a lookup. Quests are not this call's business. */
  onImportLevels: (levels: Record<string, number>) => void
  onSetQuest: (quest: string, finished: boolean) => void
  onClear: () => void
}

/**
 * Fill the skills column from a name.
 *
 * Its own component because it owns four pieces of transient state that mean
 * nothing to the rest of the dialog, and because everything it touches is gone
 * the moment the dialog closes -- what it *found* has already been written to
 * the store by then.
 */
function LevelLookup({
  onImportLevels,
  onFilled,
}: {
  onImportLevels: (levels: Record<string, number>) => void
  /** Told after a successful fill, so the form can show the new numbers. */
  onFilled: () => void
}) {
  const [rsn, setRsn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<{ count: number; lookup: WomLookup } | null>(null)
  const inFlight = useRef<AbortController | null>(null)

  // A lookup outlives the dialog otherwise, and resolves against a component
  // that is no longer mounted the moment someone searches and closes.
  useEffect(() => () => inFlight.current?.abort(), [])

  async function run() {
    if (busy) return
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    setBusy(true)
    setError(null)
    setFound(null)
    try {
      const lookup = await fetchWomLevels(rsn, controller.signal)
      onImportLevels(lookup.levels)
      setFound({ count: Object.keys(lookup.levels).length, lookup })
      onFilled()
    } catch (err) {
      // Superseded or unmounted. Someone else owns the outcome now.
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(
        err instanceof WomLookupError ? err.message : 'That lookup failed. Try again in a moment.',
      )
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  const stale = found === null ? null : updatedLabel(found.lookup.updatedAt)

  return (
    <div className="mb-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={rsn}
          onChange={(event) => setRsn(event.target.value)}
          onKeyDown={(event) => {
            // Enter in a dialog would otherwise find Done and close it.
            if (event.key !== 'Enter') return
            event.preventDefault()
            void run()
          }}
          placeholder="Your RuneScape name"
          aria-label="RuneScape name to look up"
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
          className="h-8"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
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

      {/* alert for the failure, status for the success: one is news that
          interrupts, the other is confirmation of something you just asked for. */}
      <p
        role={error === null ? 'status' : 'alert'}
        className={`text-xs leading-snug ${error === null ? 'text-muted-foreground' : 'text-red-400'}`}
      >
        {error ??
          (found === null ? (
            <>
              Fills these in from the hiscores, via{' '}
              <a
                href={WISE_OLD_MAN_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2"
              >
                Wise Old Man
              </a>
              . No plugin needed.
            </>
          ) : (
            // The date is the point, not decoration: WOM holds whatever snapshot
            // was last taken of this account, and someone who trained since then
            // should see why the number is old rather than distrust the filter.
            <span className="text-emerald-400">
              Filled in {found.count} levels for {found.lookup.displayName}
              {stale === null ? '' : ` · ${stale}`}.
            </span>
          ))}
      </p>
    </div>
  )
}

/**
 * One skill's level.
 *
 * Kept in local state while it's being edited and pushed to the store on change,
 * because an empty box is a legitimate thing to be looking at mid-edit -- reading
 * the store back would put a 1 in it the moment you cleared it to type 92.
 */
function LevelInput({
  skill,
  level,
  onSetLevel,
}: {
  skill: string
  level: number | undefined
  onSetLevel: (skill: string, level: number) => void
}) {
  const [text, setText] = useState(level === undefined ? '' : String(level))

  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{skill}</span>
      <Input
        value={text}
        inputMode="numeric"
        onChange={(event) => {
          const next = event.target.value.replace(/[^0-9]/g, '').slice(0, 3)
          setText(next)
          // An empty box means "I haven't said", which is a 1 to every gate --
          // the same as not having the skill, which is the safe reading.
          onSetLevel(skill, next === '' ? 0 : Number(next))
        }}
        aria-label={`${skill} level`}
        className="h-8 w-16 text-center tabular-nums"
      />
    </label>
  )
}

export function ProfileDialog({
  profile,
  isEmpty,
  source,
  open,
  onOpenChange,
  onSetLevel,
  onImportLevels,
  onSetQuest,
  onClear,
}: ProfileDialogProps) {
  const finished = new Set(profile.quests.map(normalizeQuest))
  const doneCount = QUESTS.filter((quest) => finished.has(normalizeQuest(quest))).length

  // Bumped by a lookup to remount the level boxes. Each one keeps its text in
  // local state so that clearing it to type doesn't fight a re-render (see
  // LevelInput), which also means a level arriving from anywhere but that box
  // would leave the old number on screen. Remounting is the honest fix: the
  // fields genuinely are being replaced, not edited.
  const [fillNonce, setFillNonce] = useState(0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="size-4" aria-hidden />
          {/* Just the name. What's in the profile is the dialog's business, and
              the requirement filter already says whether it has enough to run
              on -- a button that changes shape as you type is noise. */}
          My levels
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>My levels and quests</DialogTitle>
          <DialogDescription>
            Used to work out which monsters you can face. Stays in this browser with
            everything else.{' '}
            {isEmpty
              ? 'A WikiSync import fills all of this in for you.'
              : source === 'wikisync'
                ? 'Imported from WikiSync — editing anything here overrides it until the next import.'
                : source === 'wiseoldman'
                  ? 'Levels came from Wise Old Man — quests it has no way of knowing, so those are yours to tick.'
                  : 'A WikiSync import fills all of this in for you.'}
          </DialogDescription>
        </DialogHeader>

        {/* Two columns on anything but a phone: ten short number fields in one
            column would be a very tall dialog for very little content. */}
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <section>
            <h3 className="mb-2 text-sm font-semibold">Skills</h3>
            <LevelLookup
              onImportLevels={onImportLevels}
              onFilled={() => setFillNonce((n) => n + 1)}
            />
            <div className="space-y-1.5">
              {GATED_SKILLS.map((skill) => (
                <LevelInput
                  key={`${skill}:${fillNonce}`}
                  skill={skill}
                  level={profile.levels[skill]}
                  onSetLevel={onSetLevel}
                />
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-snug">
              Only the skills some monster actually asks for. Slayer levels can't be
              boosted for the bosses that need them.
            </p>
          </section>

          <section>
            <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
              Quests
              <span className="text-muted-foreground text-xs font-normal tabular-nums">
                {doneCount} of {QUESTS.length}
              </span>
            </h3>
            {/* Scrolls rather than growing the dialog past the fold -- the skills
                column sets the height, and this one lives inside it. */}
            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {QUESTS.map((quest) => {
                const done = finished.has(normalizeQuest(quest))
                return (
                  <label
                    key={quest}
                    className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm transition-colors"
                  >
                    <Checkbox
                      checked={done}
                      onCheckedChange={(next) => onSetQuest(quest, next === true)}
                    />
                    <span className="min-w-0 flex-1">{questLabel(quest)}</span>
                  </label>
                )
              })}
            </div>
          </section>
        </div>

        <DialogFooter className="sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={isEmpty}
            className="text-muted-foreground h-8 px-2 text-xs"
          >
            <Trash2 className="size-3.5" aria-hidden />
            Clear
          </Button>
          {/* No Save: every field writes as you change it, the same as ticking a
              task. A Save button here would imply the rest of the app has one. */}
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
