// The plan, over the whole window.
//
// The panel beside the table is a queue: what am I doing next, at a third of the
// width, deliberately narrow. This is the other half of the same object -- where
// you sit down and *work on* the plan rather than glance at it. Room for the
// description on every row, headings for the trips, and the whole list reachable
// without dragging inside a box four rows tall.
//
// An overlay and not a route. Every visible arrangement in this app is a URL,
// and adding a second address to a static site to hold one panel would be a
// navigation model bought for one view. This opens over what you were already
// looking at and closes back onto it, which is also what it is: the same plan,
// bigger.

import { useState } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ArrowDown,
  ArrowUp,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ListTree,
} from "lucide-react";
import { dragId } from "@/lib/dnd";
import { gateReason, type GateCheck } from "@/lib/requirements";
import {
  summarize,
  toTrips,
  type TaskListEntry,
  type Trip,
} from "@/lib/tasklist";
import { PlanRow } from "@/components/plan-overlay/row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface PlanOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: readonly TaskListEntry[];
  /** One verdict per monster, as the table and the panel read it. */
  gates: ReadonlyMap<string, GateCheck>;
  onToggleCompleted: (wikiId: number) => void;
  onRemove: (wikiId: number) => void;
  /** Gathers each monster's tasks together -- see gatherByMonster. */
  onGather: () => void;
  /** Moves one trip past its neighbour, tasks and all -- see moveTrip. */
  onMoveTrip: (anchor: number, delta: -1 | 1) => void;
  /** Takes the finished tasks off the plan -- see dropCompleted. */
  onClearCompleted: () => void;
}

export function PlanOverlay({
  open,
  onOpenChange,
  entries,
  gates,
  onToggleCompleted,
  onRemove,
  onGather,
  onMoveTrip,
  onClearCompleted,
}: PlanOverlayProps) {
  // Which trips are shut, keyed by a task in each rather than by position: a
  // trip that moves is still the trip you shut. Overlay-local and not stored --
  // collapsing is how you look at the plan for a minute, not a fact about it.
  const [shut, setShut] = useState<ReadonlySet<number>>(new Set());
  const summary = summarize(entries);
  // Always on here, unlike the panel: at this width a heading costs nothing and
  // the shape of the evening is the thing you came to look at.
  const trips = toTrips(entries);
  // Worth offering only when there is something to gather -- with every monster
  // already in one run the button would do nothing and say nothing about why.
  const canGather = trips.length > new Set(trips.map((t) => t.monster)).size;

  const anchorOf = (trip: Trip) => trip.entries[0].task.wikiId;
  const isShut = (trip: Trip) => shut.has(anchorOf(trip));

  const toggleShut = (anchor: number) =>
    setShut((current) => {
      const next = new Set(current);
      if (!next.delete(anchor)) next.add(anchor);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85dvh] flex-col gap-0 p-0 sm:max-w-5xl">
        {/* Padded on the right for the dialog's own close button, which sits in
            that corner -- the actions land beside it, not under it.

            The floor on the height is what stops the bar moving: the clear
            button comes and goes with the first task you tick, and a header that
            grew to fit it pushed the whole plan down a few pixels on every
            click. Tall enough for a button whether or not one is there. */}
        <DialogHeader className="min-h-13 shrink-0 flex-row items-center gap-3 space-y-0 border-b py-3 pr-14 pl-4">
          <DialogTitle className="text-base">My list</DialogTitle>
          <span className="text-muted-foreground text-sm font-normal tabular-nums">
            {summary.completed}/{summary.total} done · {summary.pointsEarned}/
            {summary.pointsTotal} pts
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* Gone entirely with nothing ticked, rather than sitting there
                disabled: it is the leftmost thing in a group pinned to the right
                edge, so it can appear without moving anything that was already
                on screen. What it takes is off the plan, not off your record --
                the way back is to add the task again, not to undo. */}
            {summary.completed > 0 && (
              <Button variant="outline" size="sm" onClick={onClearCompleted}>
                <CheckCheck className="size-3.5" aria-hidden />
                Clear completed
              </Button>
            )}
            {/* Held rather than hidden, unlike its neighbour: this one is
                pinned to the right edge, and letting it vanish would slide the
                clear button across to take its place. Disabled says "already
                grouped" in the spot the button was in anyway. */}
            <Button
              variant="outline"
              size="sm"
              onClick={onGather}
              disabled={!canGather}
            >
              <ListTree className="size-3.5" aria-hidden />
              Group by monster
            </Button>
          </div>
        </DialogHeader>

        {entries.length === 0 ? (
          <p className="text-muted-foreground px-4 py-16 text-center text-sm">
            Nothing planned yet.
          </p>
        ) : (
          <SortableContext
            // Only what is on screen: a row inside a shut trip isn't rendered,
            // and listing it here would leave the context holding an id with no
            // node behind it.
            items={trips
              .filter((trip) => !isShut(trip))
              .flatMap((trip) =>
                trip.entries.map((entry) => dragId("plan", entry.task.wikiId)),
              )}
            strategy={verticalListSortingStrategy}
          >
            {/* No padding at the top of the scrollport. A sticky heading sticks
                to the padding edge, so any top padding here is a strip the
                heading never covers and the rows scroll through it. The headings
                carry their own top spacing instead, where it travels with them
                and is painted in. */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-3">
              {trips.map((trip, index) => (
                // Keyed by position as well as name: a plan can visit the same
                // boss twice, and those two trips are not one section.
                <section key={`${index}:${trip.monster ?? ""}`}>
                  {/* Sticky, so the boss whose tasks you are reading stays
                      overhead while you scroll them. Three controls rather than
                      one clickable strip: shutting a trip is cheap and
                      reversible, moving one rewrites the plan, and a strip that
                      did the safe thing everywhere except two patches is how you
                      reorganise an evening by accident. */}
                  <h3 className="bg-popover sticky top-0 z-10 flex items-center gap-1 py-2 text-sm font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleShut(anchorOf(trip))}
                      aria-expanded={!isShut(trip)}
                      className="hover:bg-muted -ml-1 flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 transition-colors"
                    >
                      {isShut(trip) ? (
                        <ChevronRight
                          className="size-4 shrink-0 opacity-70"
                          aria-hidden
                        />
                      ) : (
                        <ChevronDown
                          className="size-4 shrink-0 opacity-70"
                          aria-hidden
                        />
                      )}
                      <span
                        className={`truncate ${trip.monster === null ? "italic" : ""}`}
                      >
                        {trip.monster ?? "Any monster"}
                      </span>
                      <span className="text-muted-foreground text-xs font-normal tabular-nums">
                        {trip.entries.length}
                      </span>
                    </button>

                    {/* Only where there is somewhere to go. Buttons rather than a
                        drag: a shut trip is one line, and moving a stop of the
                        route past another is a decision with two answers, not a
                        gesture that needs aiming. */}
                    {trips.length > 1 && (
                      <span className="ml-auto flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onMoveTrip(anchorOf(trip), -1)}
                          disabled={index === 0}
                          title={`Move ${trip.monster ?? "these tasks"} earlier`}
                          aria-label={`Move ${trip.monster ?? "the tasks with no monster"} earlier in my list`}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1 font-normal transition-colors disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ArrowUp className="size-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveTrip(anchorOf(trip), 1)}
                          disabled={index === trips.length - 1}
                          title={`Move ${trip.monster ?? "these tasks"} later`}
                          aria-label={`Move ${trip.monster ?? "the tasks with no monster"} later in my list`}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1 font-normal transition-colors disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ArrowDown className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    )}
                  </h3>
                  {!isShut(trip) && (
                    <ul className="space-y-2">
                      {trip.entries.map((entry) => (
                        <PlanRow
                          key={entry.task.wikiId}
                          entry={entry}
                          requires={gateReason(gates, entry.task.monster)}
                          inTrip={trip.monster !== null}
                          onToggleCompleted={onToggleCompleted}
                          onRemove={onRemove}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </SortableContext>
        )}
      </DialogContent>
    </Dialog>
  );
}
