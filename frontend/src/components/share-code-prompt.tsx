// The question a shared link asks on arrival.
//
// Opening a link is a replace, exactly like an import, so it asks first and says
// what it would cost. Undo covers it afterwards, but only until the next reload,
// which is not long enough to be the whole answer.

import { profileIsEmpty } from "@/lib/requirements";
import type { ShareCodeResult } from "@/lib/share-code";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * What accepting would cost, in one sentence.
 *
 * Said plainly in both directions: a link carrying levels overwrites yours, and
 * one carrying none leaves them be rather than wiping them. The second half is
 * the one somebody would otherwise have to test to find out.
 */
function describe(
  incoming: ShareCodeResult,
  completedCount: number,
  listCount: number,
): string {
  return (
    `This link holds ${incoming.completed.length} completed tasks` +
    (incoming.list.length > 0
      ? ` and a plan of ${incoming.list.length}.`
      : " and no plan.") +
    ` Opening it replaces the ${completedCount} completed tasks in this browser` +
    (listCount > 0 ? ` and your plan of ${listCount}.` : ".") +
    (incoming.dropped > 0
      ? ` ${incoming.dropped} entries weren't recognised and will be ignored.`
      : "") +
    (profileIsEmpty(incoming.profile)
      ? " It carries no levels or quests, so yours are left alone."
      : " Its levels and quests replace yours.")
  );
}

export interface ShareCodePromptProps {
  /** A readable code waiting on a decision, or null. */
  incoming: ShareCodeResult | null;
  /** Why an unreadable code couldn't be read, or null. */
  error: string | null;
  /** What's in this browser now, for the sentence that says what it costs. */
  completedCount: number;
  listCount: number;
  onAccept: (incoming: ShareCodeResult) => void;
  onDismiss: () => void;
}

export function ShareCodePrompt({
  incoming,
  error,
  completedCount,
  listCount,
  onAccept,
  onDismiss,
}: ShareCodePromptProps) {
  return (
    <AlertDialog
      open={incoming !== null || error !== null}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {error
              ? "That link didn't carry readable progress"
              : "Open shared progress?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {error ??
              (incoming ? describe(incoming, completedCount, listCount) : "")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {error ? "Close" : "Keep what I have"}
          </AlertDialogCancel>
          {incoming && (
            <AlertDialogAction onClick={() => onAccept(incoming)}>
              Replace with the link
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
