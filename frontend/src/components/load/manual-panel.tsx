// The by-hand pane: levels and quests, typed.
//
// The odd one out, and deliberately so. Every other source fetches a fact about
// an account and offers to write it; this one *is* the writing, so it has no
// Import button and no preview -- every field commits as you change it, the same
// as ticking a task. A Save button here would imply the rest of the app has one.
//
// It also does a job none of the others can: a hypothetical. "What opens up if I
// get Slayer to 92" is the same question the requirement filter answers, asked
// with a number you haven't earned yet, and that is why this pane survived the
// move into Load rather than being retired as the fallback for people without
// RuneLite.
//
// Both halves derive from requirements.ts rather than being listed here. Ten
// skills and nineteen quests are exactly the ones some gate actually asks for,
// so adding a gate on Runecrafting puts a Runecrafting box in this form and
// nobody has to remember to come and add it.

import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  GATED_SKILLS,
  gatedQuests,
  normalizeQuest,
  questLabel,
  type PlayerProfile,
} from "@/lib/requirements";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DialogClose } from "@/components/ui/dialog";

const QUESTS = gatedQuests();

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
  skill: string;
  level: number | undefined;
  onSetLevel: (skill: string, level: number) => void;
}) {
  const [text, setText] = useState(level === undefined ? "" : String(level));

  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{skill}</span>
      <Input
        value={text}
        inputMode="numeric"
        onChange={(event) => {
          const next = event.target.value.replace(/[^0-9]/g, "").slice(0, 3);
          setText(next);
          // An empty box means "I haven't said", which is a 1 to every gate --
          // the same as not having the skill, which is the safe reading.
          onSetLevel(skill, next === "" ? 0 : Number(next));
        }}
        aria-label={`${skill} level`}
        className="h-8 w-16 text-center tabular-nums"
      />
    </label>
  );
}

export interface ManualPanelProps {
  profile: PlayerProfile;
  isEmpty: boolean;
  onSetLevel: (skill: string, level: number) => void;
  onSetQuest: (quest: string, finished: boolean) => void;
  onClear: () => void;
}

export function ManualPanel({
  profile,
  isEmpty,
  onSetLevel,
  onSetQuest,
  onClear,
}: ManualPanelProps) {
  const finished = new Set(profile.quests.map(normalizeQuest));
  const doneCount = QUESTS.filter((quest) =>
    finished.has(normalizeQuest(quest)),
  ).length;

  // Remounts the level boxes when the numbers behind them are replaced from
  // elsewhere. Each box keeps its text in local state so clearing it to type
  // doesn't fight a re-render (see LevelInput), which also means a level
  // arriving from another pane would leave the old number on screen. Keyed on
  // the values themselves, so any import that changes them redraws the form.
  const levelKey = GATED_SKILLS.map(
    (skill) => profile.levels[skill] ?? "",
  ).join(",");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* Two columns on anything but a phone: ten short number fields in one
            column would be a very tall pane for very little content. */}
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <section>
            <h3 className="mb-2 text-sm font-semibold">Skills</h3>
            <div className="space-y-1.5">
              {GATED_SKILLS.map((skill) => (
                <LevelInput
                  key={`${skill}:${levelKey}`}
                  skill={skill}
                  level={profile.levels[skill]}
                  onSetLevel={onSetLevel}
                />
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
              Quests
              <span className="text-muted-foreground text-xs font-normal tabular-nums">
                {doneCount} of {QUESTS.length}
              </span>
            </h3>
            <div className="space-y-1 pr-1">
              {QUESTS.map((quest) => {
                const done = finished.has(normalizeQuest(quest));
                return (
                  <label
                    key={quest}
                    className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm transition-colors"
                  >
                    <Checkbox
                      checked={done}
                      onCheckedChange={(next) =>
                        onSetQuest(quest, next === true)
                      }
                    />
                    <span className="min-w-0 flex-1">{questLabel(quest)}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* No Import, and no status sentence: there is nothing pending. The one
          destructive act available is Clear, so it keeps its distance from Done. */}
      <div className="flex items-center justify-between border-t pt-3">
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
        <DialogClose asChild>
          <Button>Done</Button>
        </DialogClose>
      </div>
    </div>
  );
}
