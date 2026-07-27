// Export / Import / Reset.
//
// Export is what makes localStorage an acceptable system of record rather than a
// trap, so it's a first-class control here, not something buried in a settings
// menu the player finds after losing their data.

import { useRef, useState } from 'react'
import { Download, Undo2, Upload, RotateCcw } from 'lucide-react'
import { buildBackup, importBackup } from '@/lib/backup'
import type { PlayerProfile } from '@/lib/requirements'
import type { ProfileSource } from '@/lib/profile-store'
import { ProfileDialog } from '@/components/profile-dialog'
import { WikiSyncDialog } from '@/components/wikisync-dialog'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type Notice = { tone: 'ok' | 'error'; message: string }

function exportFilename(): string {
  // Local date, not ISO: this filename is for a human sorting their own backups.
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  return `combat-achievements-${stamp}.json`
}

export interface ProgressToolbarProps {
  completed: ReadonlySet<number>
  completedCount: number
  /** Entries on the plan, for the export message and the import warning. */
  listCount: number
  /** The account the last WikiSync import came from, if any. */
  lastRsn: string | null
  onReset: () => void
  onWikiSyncApply: (
    wikiIds: number[],
    rsn: string,
    clearList: boolean,
    profile: PlayerProfile | null,
  ) => void
  onUndo: () => void
  /** False when nothing has changed yet this session. */
  canUndo: boolean
  /** The levels and quests behind the requirement filter, and its editor. */
  profile: PlayerProfile
  profileIsEmpty: boolean
  profileSource: ProfileSource
  profileOpen: boolean
  onProfileOpenChange: (open: boolean) => void
  onSetLevel: (skill: string, level: number) => void
  onSetQuest: (quest: string, finished: boolean) => void
  onClearProfile: () => void
}

export function ProgressToolbar({
  completed,
  completedCount,
  listCount,
  lastRsn,
  onReset,
  onWikiSyncApply,
  onUndo,
  canUndo,
  profile,
  profileIsEmpty,
  profileSource,
  profileOpen,
  onProfileOpenChange,
  onSetLevel,
  onSetQuest,
  onClearProfile,
}: ProgressToolbarProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  function handleExport() {
    const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportFilename()
    link.click()
    URL.revokeObjectURL(url)
    setNotice({
      tone: 'ok',
      message:
        `Exported ${completedCount} completed tasks` +
        (listCount > 0 ? ` and ${listCount} on your list.` : '.'),
    })
  }

  async function handleImportFile(file: File) {
    try {
      const result = importBackup(await file.text())
      setNotice({
        tone: 'ok',
        message:
          `Imported ${result.imported} completed tasks` +
          (result.listImported > 0 ? ` and ${result.listImported} on your list.` : '.') +
          (result.profileImported ? ' Your levels and quests came with it.' : '') +
          (result.dropped + result.listDropped > 0
            ? ` Ignored ${result.dropped + result.listDropped} unrecognised entries.`
            : ''),
      })
    } catch (err) {
      setNotice({ tone: 'error', message: err instanceof Error ? err.message : 'Import failed.' })
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {/* Beside WikiSync rather than in the filter bar: this is a fact about
            the account, like your progress, not a view of the table. WikiSync
            fills it in, so the two belong next to each other. */}
        <ProfileDialog
          profile={profile}
          isEmpty={profileIsEmpty}
          source={profileSource}
          open={profileOpen}
          onOpenChange={onProfileOpenChange}
          onSetLevel={onSetLevel}
          onSetQuest={onSetQuest}
          onClear={onClearProfile}
        />

        <WikiSyncDialog
          completed={completed}
          listCount={listCount}
          lastRsn={lastRsn}
          onApply={onWikiSyncApply}
        />

        {/* First in the row because it's the one you reach for in a hurry, and
            because it undoes every other button here as well as a stray tick. */}
        <Button
          variant="outline"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo the last change to your progress (Ctrl+Z)"
        >
          <Undo2 className="size-4" aria-hidden />
          Undo
        </Button>

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-4" aria-hidden />
          Export
        </Button>

        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          <Upload className="size-4" aria-hidden />
          Import
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleImportFile(file)
            // Clear, so picking the same file twice still fires a change event.
            event.target.value = ''
          }}
        />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={completedCount === 0}>
              <RotateCcw className="size-4" aria-hidden />
              Reset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all progress?</AlertDialogTitle>
              <AlertDialogDescription>
                This clears all {completedCount} completed tasks from this browser. Undo can
                bring it back until you reload the page, but there's no copy on a server —
                export first if you might want it back.
                {listCount > 0 &&
                  ` Your list of ${listCount} planned tasks is left alone; clear that from the panel.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onReset()
                  setNotice({ tone: 'ok', message: 'Progress reset.' })
                }}
              >
                Reset everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {notice && (
        <p
          role="status"
          className={`text-xs ${notice.tone === 'error' ? 'text-red-400' : 'text-muted-foreground'}`}
        >
          {notice.message}
        </p>
      )}
    </div>
  )
}
