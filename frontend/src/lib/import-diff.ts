// What applying an import would change, worked out before anything is written.

export interface ImportDiff {
  /** Not currently ticked, and will be after applying. */
  newlyCompleted: number[];
  /** Already ticked; the import agrees. */
  alreadyCompleted: number[];
  /** Currently ticked but absent from the import, so about to be un-ticked. */
  removed: number[];
  /** Unrecognised entries, ignored rather than failing the whole import. */
  dropped: number;
}

/**
 * What applying this import would actually change. Shown before anything is
 * written -- an import can carry hundreds of tasks and the user should see the
 * size of it first, and the number that matters is what disappears, not what
 * arrives.
 *
 * This always *replaces*: the account is the authority on which Combat
 * Achievements are done, so an import is "here is the truth", not "here is some
 * more". There used to be a merge mode, on the theory that a hand-ticked task
 * deserved protection from an import that hadn't seen it -- but a mode that can
 * only ever leave stale ticks behind is a mode that makes the number at the top
 * wrong. The planned list is a different matter and is never touched by an
 * import; it is yours, not the account's.
 */
export function diffAgainst(
  incoming: { ids: readonly number[]; dropped: number },
  completed: ReadonlySet<number>,
): ImportDiff {
  const newlyCompleted: number[] = [];
  const alreadyCompleted: number[] = [];
  for (const id of incoming.ids) {
    if (completed.has(id)) alreadyCompleted.push(id);
    else newlyCompleted.push(id);
  }

  const kept = new Set(incoming.ids);
  const removed: number[] = [];
  for (const id of completed) {
    if (!kept.has(id)) removed.push(id);
  }
  removed.sort((a, b) => a - b);

  return {
    newlyCompleted,
    alreadyCompleted,
    removed,
    dropped: incoming.dropped,
  };
}

/** Whether applying this diff would change anything at all. */
export function diffIsNoop(diff: ImportDiff): boolean {
  return diff.newlyCompleted.length === 0 && diff.removed.length === 0;
}
