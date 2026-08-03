// One door in.
//
// There used to be three: a Load menu with two items, a file picker behind a
// third, and a My levels button that had quietly grown a Wise Old Man lookup
// inside it -- a *fetch* living in an editor, because that happened to be where
// levels were. Five ways to write your profile, spread over two buttons and a
// menu, with no single place that said what any of them could actually give you.
//
// So: one dialog, a rail of sources, and each source's own instructions beside
// it. The rail carries a "carries" line under every name because that is the
// real question -- four of the five look interchangeable until you notice only
// three bring achievements and only one brings your plan.
//
// The panes are deliberately not uniform. Four fetch or read and end in an
// Import button; By hand writes as you type and ends in Done. Forcing those into
// one shape would mean either a preview step for typing a number, or a silent
// write for an import, and both are worse than the seam.

import { useEffect, useState } from 'react'
import { NameRow } from '@/components/load/name-row'
import {
  DEFAULT_LOAD_SOURCE,
  LOAD_SOURCES,
  readLastSource,
  writeLastSource,
  type LoadSourceId,
} from '@/lib/load-source'
import type { PlayerProfile } from '@/lib/requirements'
import type { ProfileSource } from '@/lib/profile-store'
import { WikiSyncPanel } from '@/components/load/wikisync-panel'
import { RuneProfilePanel } from '@/components/load/runeprofile-panel'
import { WiseOldManPanel } from '@/components/load/wiseoldman-panel'
import { FilePanel } from '@/components/load/file-panel'
import { ManualPanel } from '@/components/load/manual-panel'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface LoadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Which source to show when it opens. Null means "whatever was used last" --
   * the requirement filter passes 'manual' to land somebody straight on the
   * form when it has nothing to filter on.
   */
  initialSource?: LoadSourceId | null

  completed: ReadonlySet<number>
  listCount: number
  lastRsn: string | null
  onImportApply: (
    ids: number[],
    rsn: string,
    clearList: boolean,
    profile: PlayerProfile | null,
    source: ProfileSource,
  ) => void
  onImportLevels: (levels: Record<string, number>) => void
  onImportFile: (file: File) => Promise<void>
  /** The name, on close. Typing it counts -- it's who this browser tracks. */
  onRsnCommit: (rsn: string) => void

  profile: PlayerProfile
  profileIsEmpty: boolean
  profileSource: ProfileSource
  onSetLevel: (skill: string, level: number) => void
  onSetQuest: (quest: string, finished: boolean) => void
  onClearProfile: () => void
}

export function LoadDialog({
  open,
  onOpenChange,
  initialSource = null,
  completed,
  listCount,
  lastRsn,
  onImportApply,
  onImportLevels,
  onImportFile,
  onRsnCommit,
  profile,
  profileIsEmpty,
  profileSource,
  onSetLevel,
  onSetQuest,
  onClearProfile,
}: LoadDialogProps) {
  const [active, setActive] = useState<LoadSourceId>(DEFAULT_LOAD_SOURCE)
  const [rsn, setRsn] = useState('')

  // Chosen on open rather than held between openings: the remembered source is
  // a fact about the last import, and reading it fresh each time means another
  // tab's import is honoured too. The name is seeded from the account this
  // browser already tracks, so a returning player opens this and presses go.
  useEffect(() => {
    if (!open) return
    setActive(initialSource ?? readLastSource())
    setRsn(lastRsn ?? '')
  }, [open, initialSource, lastRsn])

  /**
   * Closing commits the name.
   *
   * On close rather than on every keystroke, and that timing is load-bearing:
   * the different-account warning compares what's typed against the stored
   * name, so writing as you type would make the two equal forever and the
   * warning could never fire. Committing at the end means a name changed
   * mid-session still gets caught, and is then remembered.
   */
  function close() {
    const name = rsn.trim()
    if (name !== '') onRsnCommit(name)
    onOpenChange(false)
  }

  /**
   * A pane is done with itself.
   *
   * `remember` is false when nothing landed -- clicking through the rail to read
   * what RuneProfile needs, or acknowledging that an account has no achievements
   * yet, are not preferences about where this dialog should open next time.
   */
  function finish(remember: boolean) {
    if (remember) writeLastSource(active)
    close()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Escape, the X, and clicking outside all land here. Each is still a
        // close, so each still commits the name.
        if (next) onOpenChange(true)
        else close()
      }}
    >
      {/* Taller and wider than the panes strictly need, because the rail sets a
          floor and a body that resized as you moved down it would be worse than
          a little empty space in the short ones. */}
      <DialogContent className="flex h-[34rem] max-h-[90dvh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Load your progress</DialogTitle>
        </DialogHeader>

        {/* Above the rail and on every source, including the two that never
            send it anywhere. It is who this browser is tracking, not a step in
            any particular import, so it neither moves nor disappears as you go
            down the rail. */}
        <NameRow rsn={rsn} onChange={setRsn} />

        <div className="flex min-h-0 flex-1 gap-5">
          {/* A listbox rather than tabs: five entries with a second line each is
              a column, not a row, and it leaves room to say what they carry. */}
          <nav
            aria-label="Import source"
            className="w-44 shrink-0 space-y-0.5 border-r pr-3"
          >
            {LOAD_SOURCES.map((source) => {
              const selected = source.id === active
              return (
                <button
                  key={source.id}
                  type="button"
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => setActive(source.id)}
                  className={`w-full rounded-md px-2.5 py-2 text-left transition-colors ${
                    selected ? 'bg-muted' : 'hover:bg-muted/60'
                  }`}
                >
                  <span
                    className={`flex items-baseline gap-1.5 text-sm ${
                      selected ? 'font-semibold' : ''
                    }`}
                  >
                    {source.label}
                    {source.popular && (
                      <span
                        className="text-[0.65rem] font-normal text-amber-400"
                        title="The plugin most players already have"
                      >
                        most used
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-tight">
                    {source.carries}
                  </span>
                </button>
              )
            })}
          </nav>

          {/* min-w-0 is load-bearing. A flex item defaults to min-width:auto,
              so this column refuses to shrink below its widest unbreakable
              child -- and the WikiSync pane has one: the sync URL, a single
              token with no break opportunity. Without this the column grows
              past the dialog and takes the textarea and footer out with it,
              while the `truncate` on the URL never gets to do anything because
              nothing ever asked it to be narrower. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {active === 'wikisync' && (
              <WikiSyncPanel
                rsn={rsn}
                completed={completed}
                listCount={listCount}
                lastRsn={lastRsn}
                onApply={(ids, name, clear, imported) =>
                  onImportApply(ids, name, clear, imported, 'wikisync')
                }
                onFinished={finish}
              />
            )}
            {active === 'runeprofile' && (
              <RuneProfilePanel
                rsn={rsn}
                completed={completed}
                listCount={listCount}
                lastRsn={lastRsn}
                onApply={(ids, name, clear, imported) =>
                  onImportApply(ids, name, clear, imported, 'runeprofile')
                }
                onFinished={finish}
              />
            )}
            {active === 'wiseoldman' && (
              <WiseOldManPanel rsn={rsn} onApply={onImportLevels} onFinished={finish} />
            )}
            {active === 'file' && (
              <FilePanel onImport={onImportFile} onFinished={finish} />
            )}
            {active === 'manual' && (
              <ManualPanel
                profile={profile}
                isEmpty={profileIsEmpty}
                source={profileSource}
                onSetLevel={onSetLevel}
                onSetQuest={onSetQuest}
                onClear={onClearProfile}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
