// Your levels and quests, by hand.
//
// The fast path is WikiSync -- the same paste that brings your Combat
// Achievements over also carries every skill level and every quest state, so
// most people should never open this. It exists for the rest: no RuneLite, an
// account WikiSync has never seen, or the genuinely useful case of asking "what
// opens up if I get Slayer to 92".
//
// Both halves are derived from requirements.ts rather than listed here. Ten
// skills and twenty quests are exactly the ones some gate actually asks for, so
// adding a gate on Runecrafting puts a Runecrafting box in this form and nobody
// has to remember to come and add it.

import { useState } from 'react'
import { SlidersHorizontal, Trash2 } from 'lucide-react'
import {
  GATED_SKILLS,
  gatedQuests,
  normalizeQuest,
  questLabel,
  type PlayerProfile,
} from '@/lib/requirements'
import type { ProfileSource } from '@/lib/profile-store'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
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

const QUESTS = gatedQuests()

export interface ProfileDialogProps {
  profile: PlayerProfile
  isEmpty: boolean
  source: ProfileSource
  /** Controlled, because the requirement filter opens this when it has nothing
   *  to filter on -- the one place the dialog is reached from outside itself. */
  open: boolean
  onOpenChange: (open: boolean) => void
  onSetLevel: (skill: string, level: number) => void
  onSetQuest: (quest: string, finished: boolean) => void
  onClear: () => void
}

/**
 * One skill's level.
 *
 * Kept in local state while it's being edited and pushed to the store on change,
 * because an empty box is a legitimate thing to be looking at mid-edit -- reading
 * the store back would put a 1 in it the moment you cleared it to type 92.
 */
function LevelInput({
  skill,
  level,
  onSetLevel,
}: {
  skill: string
  level: number | undefined
  onSetLevel: (skill: string, level: number) => void
}) {
  const [text, setText] = useState(level === undefined ? '' : String(level))

  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{skill}</span>
      <Input
        value={text}
        inputMode="numeric"
        onChange={(event) => {
          const next = event.target.value.replace(/[^0-9]/g, '').slice(0, 3)
          setText(next)
          // An empty box means "I haven't said", which is a 1 to every gate --
          // the same as not having the skill, which is the safe reading.
          onSetLevel(skill, next === '' ? 0 : Number(next))
        }}
        aria-label={`${skill} level`}
        className="h-8 w-16 text-center tabular-nums"
      />
    </label>
  )
}

export function ProfileDialog({
  profile,
  isEmpty,
  source,
  open,
  onOpenChange,
  onSetLevel,
  onSetQuest,
  onClear,
}: ProfileDialogProps) {
  const finished = new Set(profile.quests.map(normalizeQuest))
  const doneCount = QUESTS.filter((quest) => finished.has(normalizeQuest(quest))).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="size-4" aria-hidden />
          {/* Just the name. What's in the profile is the dialog's business, and
              the requirement filter already says whether it has enough to run
              on -- a button that changes shape as you type is noise. */}
          My levels
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>My levels and quests</DialogTitle>
          <DialogDescription>
            Used to work out which monsters you can face. Stays in this browser with
            everything else.{' '}
            {source === 'wikisync' && !isEmpty
              ? 'Imported from WikiSync — editing anything here overrides it until the next import.'
              : 'A WikiSync import fills all of this in for you.'}
          </DialogDescription>
        </DialogHeader>

        {/* Two columns on anything but a phone: ten short number fields in one
            column would be a very tall dialog for very little content. */}
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <section>
            <h3 className="mb-2 text-sm font-semibold">Skills</h3>
            <div className="space-y-1.5">
              {GATED_SKILLS.map((skill) => (
                <LevelInput
                  key={skill}
                  skill={skill}
                  level={profile.levels[skill]}
                  onSetLevel={onSetLevel}
                />
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-snug">
              Only the skills some monster actually asks for. Slayer levels can't be
              boosted for the bosses that need them.
            </p>
          </section>

          <section>
            <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
              Quests
              <span className="text-muted-foreground text-xs font-normal tabular-nums">
                {doneCount} of {QUESTS.length}
              </span>
            </h3>
            {/* Scrolls rather than growing the dialog past the fold -- the skills
                column sets the height, and this one lives inside it. */}
            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {QUESTS.map((quest) => {
                const done = finished.has(normalizeQuest(quest))
                return (
                  <label
                    key={quest}
                    className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm transition-colors"
                  >
                    <Checkbox
                      checked={done}
                      onCheckedChange={(next) => onSetQuest(quest, next === true)}
                    />
                    <span className="min-w-0 flex-1">{questLabel(quest)}</span>
                  </label>
                )
              })}
            </div>
          </section>
        </div>

        <DialogFooter className="sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={isEmpty}
            className="text-muted-foreground h-8 px-2 text-xs"
          >
            <Trash2 className="size-3.5" aria-hidden />
            Clear
          </Button>
          {/* No Save: every field writes as you change it, the same as ticking a
              task. A Save button here would imply the rest of the app has one. */}
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
