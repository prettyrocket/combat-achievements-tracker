// The WikiSync paste flow.
//
// The instructions are load-bearing, not decoration: the single most common way
// this fails is a player who installed the plugin but never opened the Combat
// Achievements interface in-game, so WikiSync has a profile for them with no CA
// list in it. Saying that up front costs less than diagnosing it afterwards.

import { useState } from 'react'
import { ClipboardPaste, ExternalLink } from 'lucide-react'
import { diffAgainst, parseWikiSync, WikiSyncParseError } from '@/lib/wikisync'
import { Button } from '@/components/ui/button'
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
  const [text, setText] = useState('')
  const [diff, setDiff] = useState<WikiSyncDiff | null>(null)
  const [error, setError] = useState<string | null>(null)

  function resetState() {
    setText('')
    setDiff(null)
    setError(null)
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
            Open{' '}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">
              sync.runescape.wiki/runelite/player/&lt;RSN&gt;/STANDARD
            </code>{' '}
            in your address bar and copy everything.
            <a
              href="https://sync.runescape.wiki/runelite/player/Zezima/STANDARD"
              target="_blank"
              rel="noreferrer noopener"
              className="ml-1 inline-flex items-center gap-1 underline decoration-dotted underline-offset-4"
            >
              example
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </li>
        </ol>
        <p className="text-muted-foreground text-xs">
          Spaces in a name become <code className="bg-muted rounded px-1">%20</code>.{' '}
          <span className="text-foreground">STANDARD</span> is the world type, not the account
          type — ironman, HCIM and UIM on normal worlds all use it.
        </p>

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
