// Picking monsters, one or several.
//
// The table can only ever add the *first* monster: the moment one is chosen,
// every other monster's rows are filtered away, so there is nothing left to
// shift-click. That's what this is for. It stays open across picks, because
// choosing three bosses to compare is one decision, not three.
//
// A plain list rather than a combobox with a datalist: 89 monsters is enough to
// want a count beside each name and a tick showing what's already chosen, and
// the browser's autocomplete can show neither.

import { useMemo, useRef, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface MonsterPickerProps {
  /** Every monster in the data, with how many tasks it has. */
  monsters: readonly { name: string; count: number }[]
  selected: readonly string[]
  onToggle: (monster: string) => void
  /** Trigger wording, so the bar and the breadcrumb can each say the right thing. */
  label?: string
  /** Off in the breadcrumb, where the chosen monsters are listed right beside it. */
  showCount?: boolean
  className?: string
}

export function MonsterPicker({
  monsters,
  selected,
  onToggle,
  label = 'Add monster',
  showCount = true,
  className,
}: MonsterPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const chosen = useMemo(
    () => new Set(selected.map((monster) => monster.toLowerCase())),
    [selected],
  )

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return monsters
    return monsters.filter((monster) => monster.name.toLowerCase().includes(needle))
  }, [monsters, search])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Plus className="size-3.5" aria-hidden />
          {label}
          {/* Reserved whether or not there's a number in it, so picking a
              monster doesn't nudge everything downstream of this button. */}
          {showCount && (
            <span className="text-muted-foreground min-w-4 text-right tabular-nums">
              {selected.length > 0 ? selected.length : ''}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72">
        <div className="relative border-b p-2">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              // Enter takes the top match, so a name you can type in full never
              // needs the mouse.
              if (event.key === 'Enter' && matches.length > 0) {
                event.preventDefault()
                onToggle(matches[0].name)
                setSearch('')
                listRef.current?.scrollTo({ top: 0 })
              }
            }}
            placeholder="Search monsters…"
            aria-label="Search monsters"
            className="h-8 pl-7 text-sm"
          />
        </div>

        <div ref={listRef} className="max-h-72 overflow-y-auto p-1" role="listbox" aria-multiselectable>
          {matches.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">No monster by that name.</p>
          ) : (
            matches.map((monster) => {
              const isChosen = chosen.has(monster.name.toLowerCase())
              return (
                <button
                  key={monster.name}
                  type="button"
                  role="option"
                  aria-selected={isChosen}
                  onClick={() => onToggle(monster.name)}
                  className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                      isChosen ? 'bg-foreground border-transparent' : 'border-muted-foreground/40'
                    }`}
                  >
                    {isChosen && <Check className="text-background size-3" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{monster.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {monster.count}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
