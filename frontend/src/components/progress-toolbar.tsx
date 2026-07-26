// Export / Import / Reset.
//
// Export is what makes localStorage an acceptable system of record rather than a
// trap, so it's a first-class control here, not something buried in a settings
// menu the player finds after losing their data.

import { useRef, useState } from 'react'
import { Download, Upload, RotateCcw } from 'lucide-react'
import { buildExport, importProgress } from '@/lib/progress-store'
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
  onReset: () => void
  onMerge: (wikiIds: number[]) => void
}

export function ProgressToolbar({
  completed,
  completedCount,
  onReset,
  onMerge,
}: ProgressToolbarProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  function handleExport() {
    const blob = new Blob([JSON.stringify(buildExport(), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportFilename()
    link.click()
    URL.revokeObjectURL(url)
    setNotice({ tone: 'ok', message: `Exported ${completedCount} completed tasks.` })
  }

  async function handleImportFile(file: File) {
    try {
      const result = importProgress(await file.text())
      setNotice({
        tone: 'ok',
        message:
          `Imported ${result.imported} completed tasks.` +
          (result.dropped > 0 ? ` Ignored ${result.dropped} unrecognised entries.` : ''),
      })
    } catch (err) {
      setNotice({ tone: 'error', message: err instanceof Error ? err.message : 'Import failed.' })
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <WikiSyncDialog completed={completed} onApply={onMerge} />

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
                This clears all {completedCount} completed tasks from this browser. There's no
                undo, and no copy on a server — export first if you might want it back.
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
