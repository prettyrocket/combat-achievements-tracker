// Who this browser is tracking.
//
// Its own file because it is the one piece of the Load dialog that belongs to
// the dialog rather than to a pane: everything in pane-parts.tsx is furniture
// the five panes share, and this sits above all of them.
//
// Not an input to importing -- the identity of the profile being built, which
// is why it shows on every source including the two that never send it
// anywhere, and holds no button. It went through two worse versions first: one
// field per pane, which meant typing it twice, and then a shared field that
// appeared and vanished as you moved down the rail with a Look up button that
// came and went with it. Both were symptoms of treating it as a step rather
// than as a fact.
//
// So: no action here, ever. The panes that fetch own their own button, because
// fetching is what those panes do and it differs between them -- WikiSync
// builds a URL for you to open yourself and has nothing to press at all.

import { Input } from '@/components/ui/input'

export function NameRow({ rsn, onChange }: { rsn: string; onChange: (next: string) => void }) {
  return (
    <div className="space-y-1.5 border-b pb-3">
      <div className="flex items-center gap-2">
        <label className="text-muted-foreground shrink-0 text-sm" htmlFor="load-rsn">
          Your name
        </label>
        {/* Capped rather than full-bleed: a 12-character field stretched across
            the whole dialog looks like it wants an essay. */}
        <Input
          id="load-rsn"
          className="max-w-64"
          value={rsn}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Your RuneScape name"
          aria-label="RuneScape name"
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  )
}
