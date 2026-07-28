// The WikiSync paste flow.
//
// The instructions are load-bearing, not decoration: the single most common way
// this fails is a player who installed the plugin but never opened the Combat
// Achievements interface in-game, so WikiSync has a profile for them with no CA
// list in it. Saying that up front costs less than diagnosing it afterwards.
//
// There is no Preview button any more. Parsing is pure, synchronous and cheap,
// so a paste previews itself -- a paste is already the user saying "this is the
// thing, read it", and making them say it twice bought nothing. What the button
// *did* quietly provide was a second click before a destructive replace, so
// that is kept where it is actually earned: an import that un-ticks tasks arms
// first and applies on the second click, and one that only adds goes in one.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, CircleHelp, Copy, ExternalLink } from 'lucide-react'
import {
  buildSyncUrl,
  diffAgainst,
  diffIsNoop,
  displayRsn,
  parseWikiSync,
  sameAccount,
  WikiSyncParseError,
} from '@/lib/wikisync'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { gatedQuests, normalizeQuest, type PlayerProfile } from '@/lib/requirements'
import type { WikiSyncDiff, WikiSyncErrorCode, WikiSyncParse } from '@/lib/wikisync'

/** The quests any monster gate asks about, for the "how much of this is useful" count. */
const GATE_QUESTS = gatedQuests().map(normalizeQuest)

/** A rejected paste, kept with its code so the footer can tell tone from text. */
interface ParseFailure {
  message: string
  code: WikiSyncErrorCode
}

export interface WikiSyncDialogProps {
  completed: ReadonlySet<number>
  /** Entries on the planned list, which an import never touches by itself. */
  listCount: number
  /** The account the last import came from, if there was one. */
  lastRsn: string | null
  /**
   * `profile` is the levels and quests the same paste carried, or null if it
   * carried none -- it rides along with the achievements because it came out of
   * the same document and describes the same account.
   */
  onApply: (
    ids: number[],
    rsn: string,
    clearList: boolean,
    profile: PlayerProfile | null,
  ) => void
  /** Controlled: the only way in is the Load menu, which is not this component. */
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The plugin's own page on the hub, so step one is one click. */
const PLUGIN_HUB_URL = 'https://runelite.net/plugin-hub/show/wikisync'

/**
 * Behind the question mark. Not a step, but the answer to the obvious question
 * about why the steps look like this at all -- so it's available without being
 * in the way of someone who just wants to paste.
 */
const WHY_PASTE =
  'This app never contacts the WikiSync API — you fetch your own data and paste it here.'

/** What the paste takes away, and what it brings. */
const TAKES = 'font-semibold text-red-400'
const GIVES = 'font-semibold text-emerald-400'

/**
 * A count as it should read in a sentence: spelled out at one, where the
 * numeral looks stilted beside a singular noun, and a numeral from two up.
 */
function word(value: number) {
  return value === 1 ? 'one' : String(value)
}

/** How many of the boss-gating quests this profile says are finished. */
function countGateQuests(profile: PlayerProfile): number {
  const finished = new Set(profile.quests.map(normalizeQuest))
  return GATE_QUESTS.filter((quest) => finished.has(quest)).length
}

export function WikiSyncDialog({
  completed,
  listCount,
  lastRsn,
  onApply,
  open,
  onOpenChange,
}: WikiSyncDialogProps) {
  const [rsn, setRsn] = useState('')
  const [copied, setCopied] = useState(false)
  const [text, setText] = useState('')
  const [diff, setDiff] = useState<WikiSyncDiff | null>(null)
  // Kept beside the diff rather than folded into it: the diff is about progress,
  // and the levels this paste also carried are a separate thing it brings.
  const [parse, setParse] = useState<WikiSyncParse | null>(null)
  const [error, setError] = useState<ParseFailure | null>(null)
  const [clearList, setClearList] = useState(false)
  // Set once a destructive apply has been armed by a first click.
  const [confirming, setConfirming] = useState(false)
  // onPaste fires before the onChange for the same edit, so this flag lets the
  // change handler tell "the user pasted" from "the user is typing" while still
  // reading the field's resulting value rather than the clipboard fragment.
  const pasted = useRef(false)

  const syncUrl = buildSyncUrl(rsn)

  // An account with no Combat Achievements on it isn't a failed import, it's a
  // new player. Nothing to apply either way, so the footer congratulates them
  // instead of correcting them, and the button just sees them out.
  const welcome = error?.code === 'NO_CA_LIST' || error?.code === 'EMPTY_LIST'

  // Only worth mentioning when there is actually a plan to lose track of, and
  // when the name in the box is a different player from the one it was built for.
  const differentAccount =
    lastRsn !== null && rsn.trim() !== '' && !sameAccount(rsn, lastRsn) && listCount > 0

  // Revert the "Copied" confirmation on its own, and cancel the timer if the
  // dialog closes first so it can't fire against an unmounted component.
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  function resetState() {
    setText('')
    setDiff(null)
    setParse(null)
    setError(null)
    setCopied(false)
    setConfirming(false)
    pasted.current = false
    // Never inherited: throwing away a plan is a decision made once, about one
    // import, not a preference the dialog remembers on your behalf.
    setClearList(false)
  }

  async function handleCopy() {
    if (syncUrl === null) return
    try {
      await navigator.clipboard.writeText(syncUrl)
      setCopied(true)
    } catch {
      // Clipboard access needs a secure context and can be refused outright.
      // Not worth an error state -- the URL is on screen and selectable.
      setCopied(false)
    }
  }

  /**
   * Read the box and say what applying it would do. Takes the text rather than
   * reading state so it can run from the change handler, where `text` is still
   * the previous value.
   */
  function runPreview(value: string) {
    // A destructive apply is armed against one specific diff; a new one has to
    // be read and armed again.
    setConfirming(false)
    if (value.trim() === '') {
      setDiff(null)
      setParse(null)
      setError(null)
      return
    }
    setError(null)
    try {
      const read = parseWikiSync(value)
      setParse(read)
      setDiff(diffAgainst(read, completed))
    } catch (err) {
      setDiff(null)
      setParse(null)
      setError(
        err instanceof WikiSyncParseError
          ? { message: err.message, code: err.code }
          : { message: 'Could not read that paste.', code: 'NOT_JSON' },
      )
    }
  }

  function handleApply() {
    // Nothing to import, so the button is only an acknowledgement.
    if (welcome) {
      onOpenChange(false)
      resetState()
      return
    }
    if (!diff) return
    // Un-ticking finished tasks is the one outcome here worth a deliberate
    // second look, so it takes a second click. Everything else applies at once.
    if (diff.removed.length > 0 && !confirming) {
      setConfirming(true)
      return
    }
    onApply(
      [...diff.newlyCompleted, ...diff.alreadyCompleted],
      rsn,
      differentAccount && clearList,
      parse?.profile ?? null,
    )
    onOpenChange(false)
    resetState()
  }

  /**
   * The one line in the footer that says what the button next to it will do.
   * Every state writes here -- error, welcome, and each shape of diff -- so
   * there is a single place to look rather than panels appearing above the fold.
   *
   * Returns its own colour with its text, because the two aren't separable:
   * what the sentence is determines whether the line reads as news, damage or
   * reassurance.
   */
  function statusMessage(): { tone: string; text: ReactNode } {
    if (welcome) {
      const name = displayRsn(rsn)
      return {
        tone: 'text-emerald-400',
        text: `No achievements to load. Welcome to OSRS${name === '' ? '' : `, ${name}`}! 🎉`,
      }
    }
    if (error) return { tone: 'text-red-400', text: error.message }

    // Nothing read yet says nothing. The steps above are the instruction; a
    // sentence here would only be filling the space until it has news.
    if (!diff) return { tone: '', text: null }

    const removed = diff.removed.length
    const added = diff.newlyCompleted.length

    // Sentences carry the colour, not the line: the verbs are what's at stake,
    // so they're picked out against plain text rather than tinting the whole
    // message and making the two directions look like one verdict.
    //
    // Removals lead. The destructive number is the one worth reading, and
    // burying it behind the additions is how someone clears progress they
    // meant to keep. Unrecognised ids are deliberately not mentioned -- they
    // mean a CA release the app hasn't pulled yet, not a user mistake.
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

  /**
   * What the one button says it is about to do. One word each: the sentence
   * beside it already carries the counts, and repeating them there made the
   * button a second, worse copy of the status line.
   */
  function applyLabel() {
    if (welcome) return 'LFG'
    if (!diff) return 'Import'
    if (diff.removed.length > 0) return confirming ? 'Confirm' : 'Replace'
    if (diffIsNoop(diff)) return differentAccount && clearList ? 'Clear' : 'Import'
    return 'Import'
  }

  const status = statusMessage()

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
          <DialogTitle className="flex items-center gap-1.5">
            Import from WikiSync
            <Popover>
              <PopoverTrigger
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
                aria-label="Why you have to paste this yourself"
              >
                <CircleHelp className="size-4" aria-hidden />
              </PopoverTrigger>
              <PopoverContent className="p-3 text-sm font-normal">{WHY_PASTE}</PopoverContent>
            </Popover>
          </DialogTitle>
          {/* Kept for the dialog's accessible description -- Radix warns without
              one, and a screen reader shouldn't have to open a popover to be
              told where the data goes. */}
          <DialogDescription className="sr-only">{WHY_PASTE}</DialogDescription>
        </DialogHeader>

        <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            Install{' '}
            <a
              href={PLUGIN_HUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground font-medium underline underline-offset-2"
            >
              WikiSync
            </a>{' '}
            from the RuneLite Plugin Hub.
          </li>
          <li>
            Log in and{' '}
            <span className="text-foreground font-medium">
              open the Combat Achievements interface in-game at least once
            </span>
            .
          </li>
          <li>
            Enter your name below, open the URL in your address bar, and copy everything.
          </li>
        </ol>

        <div className="space-y-2">
          <Input
            value={rsn}
            onChange={(event) => setRsn(event.target.value)}
            placeholder="Your RuneScape name"
            aria-label="RuneScape name"
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
          />

          <div className="flex items-center gap-2">
            <code
              className="bg-muted text-muted-foreground min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs"
              title={syncUrl ?? undefined}
            >
              {syncUrl ?? 'sync.runescape.wiki/runelite/player/…/STANDARD'}
            </code>
            <Button
              variant="outline"
              size="sm"
              disabled={syncUrl === null}
              onClick={handleCopy}
              aria-label="Copy sync URL"
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" asChild disabled={syncUrl === null}>
              {/* A normal link, so it's a top-level navigation -- that's what sends no
                  Origin header and makes this work at all. */}
              <a
                href={syncUrl ?? '#'}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Open sync URL in a new tab"
                aria-disabled={syncUrl === null}
                onClick={(event) => {
                  if (syncUrl === null) event.preventDefault()
                }}
              >
                <ExternalLink className="size-4" aria-hidden />
                Open
              </a>
            </Button>
          </div>

        </div>

        <Textarea
          value={text}
          onPaste={() => {
            pasted.current = true
          }}
          onChange={(event) => {
            const value = event.target.value
            setText(value)
            if (pasted.current) {
              pasted.current = false
              runPreview(value)
              return
            }
            // Mid-edit. Drop the old reading rather than judging a half-typed
            // payload -- nobody needs "that doesn't look like JSON" while
            // they're still writing it. Blur picks it up when they're done.
            setDiff(null)
            setError(null)
            setConfirming(false)
          }}
          onBlur={() => runPreview(text)}
          placeholder='{"combat_achievements":[0,16,27, …]}'
          className="h-32 font-mono text-xs"
          aria-label="WikiSync JSON"
        />

        {/* The other half of the payload, mentioned because it is not what the
            dialog advertises and arriving silently would be a surprise. Also a
            diagnostic: the quest count is joined by name against the gate table,
            so "0 of 20" here is how you find out that WikiSync started spelling
            quests differently, rather than by wondering why nothing is locked. */}
        {parse?.profile && (
          <p className="text-muted-foreground text-xs leading-snug">
            This paste also carries{' '}
            <span className="text-foreground">
              {Object.keys(parse.profile.levels).length} skill levels
            </span>{' '}
            and{' '}
            <span className="text-foreground">
              {countGateQuests(parse.profile)} of {GATE_QUESTS.length} quests
            </span>{' '}
            that gate a boss. Importing uses them to work out which monsters you can face.
          </p>
        )}

        {/* No merge/replace choice any more. The account is the authority on
            which CAs are done, so an import makes this browser match it -- and
            your planned list, which the account knows nothing about, is left
            alone unless you say otherwise below. Said in the footer, next to
            the button that does it. */}

        {differentAccount && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <Checkbox
              checked={clearList}
              onCheckedChange={(next) => {
                setClearList(next === true)
                // Changes what the armed button would do, so make it be read again.
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
          {/* alert rather than status for errors -- a paste that failed is news,
              and the user's attention is in the textarea, not down here. Both
              roles are live regions, so the announcement follows the state. */}
          <p
            role={error && !welcome ? 'alert' : 'status'}
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
              // Nothing read yet, or a paste that changes no progress -- though
              // even that has work to do if it's also being used to clear a plan
              // built for another account.
              disabled={
                !welcome && (diff === null || (diffIsNoop(diff) && !(differentAccount && clearList)))
              }
              // Green only when it's pure good news. Anything that takes
              // something away wears the destructive tint instead.
              variant={
                welcome
                  ? 'success'
                  : !diff
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
