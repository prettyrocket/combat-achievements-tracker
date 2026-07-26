// The WikiSync paste flow.
//
// The instructions are load-bearing, not decoration: the single most common way
// this fails is a player who installed the plugin but never opened the Combat
// Achievements interface in-game, so WikiSync has a profile for them with no CA
// list in it. Saying that up front costs less than diagnosing it afterwards.

import { useEffect, useState } from 'react'
import { Check, ClipboardPaste, Copy, ExternalLink } from 'lucide-react'
import { buildSyncUrl, diffAgainst, parseWikiSync, WikiSyncParseError } from '@/lib/wikisync'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import type { WikiSyncDiff } from '@/lib/wikisync'

export interface WikiSyncDialogProps {
  completed: ReadonlySet<number>
  onApply: (ids: number[]) => void
}

export function WikiSyncDialog({ completed, onApply }: WikiSyncDialogProps) {
  const [open, setOpen] = useState(false)
  const [rsn, setRsn] = useState('')
  const [copied, setCopied] = useState(false)
  const [text, setText] = useState('')
  const [diff, setDiff] = useState<WikiSyncDiff | null>(null)
  const [error, setError] = useState<string | null>(null)

  const syncUrl = buildSyncUrl(rsn)

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
    setError(null)
    setCopied(false)
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

  function handlePreview() {
    setError(null)
    try {
      setDiff(diffAgainst(parseWikiSync(text), completed))
    } catch (err) {
      setDiff(null)
      setError(err instanceof WikiSyncParseError ? err.message : 'Could not read that paste.')
    }
  }

  function handleApply() {
    if (!diff) return
    onApply([...diff.newlyCompleted, ...diff.alreadyCompleted])
    setOpen(false)
    resetState()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetState()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardPaste className="size-4" aria-hidden />
          WikiSync
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from WikiSync</DialogTitle>
          <DialogDescription>
            This app never contacts the WikiSync API — you fetch your own data and paste it
            here.
          </DialogDescription>
        </DialogHeader>

        <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            Install <span className="text-foreground font-medium">WikiSync</span> from the
            RuneLite Plugin Hub.
          </li>
          <li>
            Log in and{' '}
            <span className="text-foreground font-medium">
              open the Combat Achievements interface in-game at least once
            </span>{' '}
            — that's what populates the list — then log out.
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

          <p className="text-muted-foreground text-xs">
            <span className="text-foreground">STANDARD</span> is the world type, not the account
            type — ironman, HCIM and UIM on normal worlds all use it. Spaces are encoded for you.
          </p>
        </div>

        <Textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setDiff(null)
            setError(null)
          }}
          placeholder='{"combat_achievements":[0,16,27, …]}'
          className="h-32 font-mono text-xs"
          aria-label="WikiSync JSON"
        />

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        {diff && (
          <div className="bg-muted/40 rounded-md border p-3 text-sm">
            <p>
              <span className="text-foreground font-medium">
                {diff.newlyCompleted.length} task
                {diff.newlyCompleted.length === 1 ? '' : 's'}
              </span>{' '}
              will be marked complete.
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {diff.alreadyCompleted.length} already complete
              {diff.dropped > 0 && ` · ${diff.dropped} unrecognised entries ignored`}
            </p>
            {diff.newlyCompleted.length === 0 && (
              <p className="text-muted-foreground mt-1 text-xs">
                Nothing to add — your progress already matches this paste.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          {diff ? (
            <Button onClick={handleApply} disabled={diff.newlyCompleted.length === 0}>
              Mark {diff.newlyCompleted.length} complete
            </Button>
          ) : (
            <Button onClick={handlePreview} disabled={text.trim() === ''}>
              Preview
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
