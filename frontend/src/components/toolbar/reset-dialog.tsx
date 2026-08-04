// Reset, and the three separate things it can clear.
//
// Three stores, three answers. Wiping your levels because you wanted to re-tick
// your tasks was never something anyone asked for, and the levels are the
// slowest to type back in.

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import type { Notice } from "@/lib/notice";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** What Reset is allowed to clear, ticked one by one. */
interface ResetTargets {
  completed: boolean;
  list: boolean;
  profile: boolean;
}

// Progress only, because that's what Reset has always meant and it's the one
// with an undo. Levels and the list are opt-in every time.
const DEFAULT_RESET_TARGETS: ResetTargets = {
  completed: true,
  list: false,
  profile: false,
};

/** "a", "a and b", "a, b and c" -- for a sentence, not a table. */
function formatList(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** One tickable thing Reset can clear, with how much of it there is. */
function ResetOption({
  label,
  detail,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 rounded px-1.5 py-1.5 text-sm ${
        disabled
          ? "opacity-50"
          : "hover:bg-muted cursor-pointer transition-colors"
      }`}
    >
      <Checkbox
        checked={checked && !disabled}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <span className="flex-1">{label}</span>
      <span className="text-muted-foreground text-xs tabular-nums">
        {detail}
      </span>
    </label>
  );
}

export interface ResetDialogProps {
  completedCount: number;
  listCount: number;
  profileIsEmpty: boolean;
  /** Clears completed tasks. Reset picks which of these three it calls. */
  onReset: () => void;
  onClearList: () => void;
  onClearProfile: () => void;
  onNotice: (notice: Notice) => void;
}

export function ResetDialog({
  completedCount,
  listCount,
  profileIsEmpty,
  onReset,
  onClearList,
  onClearProfile,
  onNotice,
}: ResetDialogProps) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<ResetTargets>(DEFAULT_RESET_TARGETS);

  const nothingToReset =
    completedCount === 0 && listCount === 0 && profileIsEmpty;
  const willReset =
    (targets.completed && completedCount > 0) ||
    (targets.list && listCount > 0) ||
    (targets.profile && !profileIsEmpty);

  function handleReset() {
    const done: string[] = [];
    if (targets.completed && completedCount > 0) {
      onReset();
      done.push(`${completedCount} completed tasks`);
    }
    if (targets.list && listCount > 0) {
      onClearList();
      done.push(`your list of ${listCount}`);
    }
    if (targets.profile && !profileIsEmpty) {
      onClearProfile();
      done.push("your levels and quests");
    }
    onNotice({ tone: "ok", message: `Cleared ${formatList(done)}.` });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Back to defaults on the way in, not on the way out: a dialog that
        // reopens still holding "and my levels" from last time is how you
        // clear something you didn't mean to.
        if (next) setTargets(DEFAULT_RESET_TARGETS);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={nothingToReset}>
          <RotateCcw className="size-4" aria-hidden />
          Reset
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset</AlertDialogTitle>
        </AlertDialogHeader>

        {/* Each row disabled when there's nothing behind it, so the dialog
            says what you actually have as well as what it will do. */}
        <div className="space-y-1">
          <ResetOption
            label="Completed tasks"
            detail={
              completedCount === 0 ? "none ticked" : `${completedCount} ticked`
            }
            checked={targets.completed}
            disabled={completedCount === 0}
            onChange={(next) =>
              setTargets((current) => ({ ...current, completed: next }))
            }
          />
          <ResetOption
            label="My list"
            detail={listCount === 0 ? "empty" : `${listCount} planned`}
            checked={targets.list}
            disabled={listCount === 0}
            onChange={(next) =>
              setTargets((current) => ({ ...current, list: next }))
            }
          />
          <ResetOption
            label="My levels and quests"
            detail={profileIsEmpty ? "not entered" : "entered"}
            checked={targets.profile}
            disabled={profileIsEmpty}
            onChange={(next) =>
              setTargets((current) => ({ ...current, profile: next }))
            }
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReset} disabled={!willReset}>
            Reset
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
