// Picking values from a closed facet -- tiers, task types.
//
// The same popover-with-ticks shape as the monster picker, minus its search box:
// six options don't need finding, they need showing. These were a row of chips,
// which put twelve permanently-lit buttons across the bar to say what could be
// filtered, when what the eye actually wants from a filter bar is what *is*
// filtered. The count on the trigger says that in one glyph.
//
// Stays open across picks, for the same reason the monster picker does: choosing
// Master and Grandmaster is one decision, not two.

import { useState, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface FacetPickerProps<T extends string> {
  /** Trigger wording -- the facet's name, not an instruction. */
  label: string
  options: readonly T[]
  selected: readonly T[]
  onToggle: (value: T) => void
  /** How a row reads, so tiers can wear the same badge they wear in the table. */
  renderOption: (value: T) => ReactNode
  className?: string
}

export function FacetPicker<T extends string>({
  label,
  options,
  selected,
  onToggle,
  renderOption,
  className,
}: FacetPickerProps<T>) {
  const [open, setOpen] = useState(false)
  const chosen = new Set(selected)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          // The count is the whole point of collapsing the chips, so it reads
          // as part of the label rather than as decoration beside it.
          aria-label={
            selected.length === 0 ? label : `${label}, ${selected.length} selected`
          }
        >
          {label}
          {/* The slot is always here, empty or not. Growing the button on the
              first pick shoved every control to its right along the bar, which
              is a strange thing for choosing a filter to do. */}
          <span className="text-muted-foreground min-w-4 text-right tabular-nums">
            {selected.length > 0 ? selected.length : ''}
          </span>
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56">
        <div className="p-1" role="listbox" aria-multiselectable aria-label={label}>
          {options.map((value) => {
            const isChosen = chosen.has(value)
            return (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={isChosen}
                onClick={() => onToggle(value)}
                className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
              >
                <span
                  className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                    isChosen ? 'bg-foreground border-transparent' : 'border-muted-foreground/40'
                  }`}
                >
                  {isChosen && <Check className="text-background size-3" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1 truncate">{renderOption(value)}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
