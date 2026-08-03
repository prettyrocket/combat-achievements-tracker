// The bottom of every Load pane, so five flows end in the same shape.
//
// One sentence and one button. The sentence is the only place that says what
// applying will do, which is why every panel writes into it rather than growing
// a panel of its own above the fold -- there is a single place to look, and it
// is next to the thing that does it.

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { DialogClose } from '@/components/ui/dialog'

export interface ImportFooterProps {
  /** What applying would do, or what went wrong. Null shows nothing. */
  status: ReactNode
  /** Tailwind text colour for the status line. */
  tone?: string
  /** Failures announce; everything else merely updates. */
  alert?: boolean
  label: string
  disabled?: boolean
  variant?: 'default' | 'success' | 'destructive'
  onApply: () => void
}

export function ImportFooter({
  status,
  tone = '',
  alert = false,
  label,
  disabled = false,
  variant = 'default',
  onApply,
}: ImportFooterProps) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
      {/* alert for a failure, status otherwise: one is news that interrupts,
          the other is confirmation of something you just asked for. */}
      <p
        role={alert ? 'alert' : 'status'}
        className={`text-xs leading-snug text-balance sm:flex-1 sm:pr-2 ${tone}`}
      >
        {status}
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:shrink-0">
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button onClick={onApply} disabled={disabled} variant={variant}>
          {label}
        </Button>
      </div>
    </div>
  )
}

/**
 * The warning that the plan on screen was built for somebody else.
 *
 * Shared because both whole-account sources can hit it, and because the offer
 * it makes is destructive: a plan is the one thing in this app an import has no
 * business overwriting on its own.
 */
export function DifferentAccountNotice({
  listCount,
  lastRsn,
  clearList,
  onChange,
}: {
  listCount: number
  lastRsn: string | null
  clearList: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
      <Checkbox
        checked={clearList}
        onCheckedChange={(next) => onChange(next === true)}
        className="mt-0.5"
      />
      <span className="leading-tight">
        <span className="font-medium text-amber-300">
          This is a different account from your last import.
        </span>
        <span className="text-muted-foreground block text-xs">
          Your {listCount} planned task{listCount === 1 ? ' was' : 's were'} added while you
          were syncing <span className="text-foreground">{lastRsn}</span>. Tick to clear the
          list too; leave it to keep it.
        </span>
      </span>
    </label>
  )
}

/** The numbered instructions above every fetch-or-paste pane. */
export function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-sm">{children}</ol>
  )
}

/** A name box and its Look up button, for the two panes that fetch by RSN. */
export function RsnField({
  rsn,
  onChange,
  onSubmit,
  busy,
  icon,
  label = 'Look up',
}: {
  rsn: string
  onChange: (next: string) => void
  onSubmit: () => void
  busy: boolean
  icon: ReactNode
  label?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        value={rsn}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Enter would otherwise find the footer button and fire the import.
          if (event.key !== 'Enter') return
          event.preventDefault()
          onSubmit()
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
        onClick={onSubmit}
      >
        {icon}
        {busy ? 'Looking' : label}
      </Button>
    </div>
  )
}
