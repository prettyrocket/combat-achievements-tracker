// The backup file pane.
//
// The only source that carries a plan, because it's the only one that came out
// of this app rather than out of the game. That also makes it the only one with
// no account behind it -- there is nothing to look up and nothing to be stale,
// so the pane is a button and a sentence.
//
// It reports through the toolbar's notice line rather than the footer, because
// importBackup writes all three stores at once and describes what it did in
// more detail than a footer sentence can hold.

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImportFooter } from '@/components/load/pane-parts'

export interface FilePanelProps {
  /** Reads the file and writes every store. Throws with a readable message. */
  onImport: (file: File) => Promise<void>
  onFinished: (remember: boolean) => void
}

export function FilePanel({ onImport, onFinished }: FilePanelProps) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleApply() {
    if (!file || busy) return
    setBusy(true)
    setError(null)
    try {
      await onImport(file)
      onFinished(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <p className="text-muted-foreground text-sm">
          A file exported from this app, on this device or another one. The only import
          that brings your planned list with it.
        </p>

        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const picked = event.target.files?.[0] ?? null
            setFile(picked)
            setError(null)
            // Cleared so picking the same file twice in a row still fires.
            event.target.value = ''
          }}
        />

        <Button variant="outline" onClick={() => input.current?.click()}>
          <Upload className="size-4" aria-hidden />
          Choose a file
        </Button>

        {file && (
          <p className="text-sm">
            <span className="font-medium">{file.name}</span>
            <span className="text-muted-foreground"> · {Math.round(file.size / 1024)} KB</span>
          </p>
        )}

        <p className="text-muted-foreground text-xs leading-snug">
          Replaces what this browser holds. Export first if you haven't — there's no
          server copy to fall back on.
        </p>
      </div>

      <ImportFooter
        status={
          error ??
          (file === null ? null : (
            <>
              This will <span className="font-semibold text-red-400">replace</span> your
              progress, plan, levels and quests with the file's.
            </>
          ))
        }
        tone={error === null ? 'text-foreground' : 'text-red-400'}
        alert={error !== null}
        label={busy ? 'Importing' : 'Import'}
        disabled={file === null || busy}
        variant={file === null ? 'default' : 'destructive'}
        onApply={() => void handleApply()}
      />
    </div>
  )
}
