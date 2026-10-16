import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Trip } from "@/lib/tasklist";

const tripId = (anchor: number) => `trip:${anchor}`;

// A column of names only goes up and down; letting the line wander sideways
// out of it says it could land somewhere else.
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/**
 * Every stop of the plan in one column, as a way to get to it and a way to
 * rearrange the route.
 *
 * One line per trip rather than per monster: a plan can visit the same boss
 * twice, and those are two places in the list, so a single line for both would
 * only ever take you to one of them -- and could only move one of them.
 *
 * A drag context of its own, inside the app's. What moves here is a trip, not
 * a task, and the app's drop handler has no business guessing which a
 * `trip:` id is.
 */
export function ListOutline({
  trips,
  anchorOf,
  onSelect,
  onMoveTrip,
}: {
  trips: readonly Trip[];
  anchorOf: (trip: Trip) => number;
  onSelect: (anchor: number) => void;
  /** Moves the trip named by `anchor` to trip index `to` -- see moveTripTo. */
  onMoveTrip: (anchor: number, to: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = trips.map((trip) => tripId(anchorOf(trip)));

  // Whether anything is out of sight past each edge. Re-read on scroll, and
  // whenever the column or what is in it changes size -- a trip added, the
  // window resized -- since either can start or stop the overflow.
  const scroller = useRef<HTMLElement>(null);
  const content = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState({ above: false, below: false });

  const measure = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    // A pixel of slack: zoomed pages report fractional scroll positions, and
    // "0.4px left to go" is not more to see.
    const above = node.scrollTop > 1;
    const below = node.scrollTop + node.clientHeight < node.scrollHeight - 1;
    setMore((current) =>
      current.above === above && current.below === below
        ? current
        : { above, below },
    );
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(measure);
    if (scroller.current) observer.observe(scroller.current);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, [measure]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onMoveTrip(anchorOf(trips[from]), to);
  };

  return (
    // The shadows sit on this wrapper rather than in the scroller, so they stay
    // at the edges instead of scrolling away with the names.
    <div className="relative hidden w-56 shrink-0 border-r md:block">
      <nav
        ref={scroller}
        onScroll={measure}
        aria-label="Monsters on my list"
        className="h-full overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[verticalOnly]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul ref={content}>
              {trips.map((trip) => (
                <OutlineLine
                  key={anchorOf(trip)}
                  trip={trip}
                  anchor={anchorOf(trip)}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </nav>
      <EdgeShadow edge="top" shown={more.above} />
      <EdgeShadow edge="bottom" shown={more.below} />
    </div>
  );
}

/**
 * Says there is more past this edge without a scrollbar to say it: the names
 * dissolve into the page as they reach it. A fade rather than a shadow because
 * the app is dark-only, and a black shadow on a near-black page is one nobody
 * sees. No line of its own -- both edges already have a border to go under.
 */
function EdgeShadow({
  edge,
  shown,
}: {
  edge: "top" | "bottom";
  shown: boolean;
}) {
  return (
    <div
      aria-hidden
      className={`from-background pointer-events-none absolute inset-x-0 h-10 to-transparent transition-opacity duration-150 ${
        edge === "top" ? "top-0 bg-gradient-to-b" : "bottom-0 bg-gradient-to-t"
      } ${shown ? "opacity-100" : "opacity-0"}`}
    />
  );
}

function OutlineLine({
  trip,
  anchor,
  onSelect,
}: {
  trip: Trip;
  anchor: number;
  onSelect: (anchor: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tripId(anchor) });
  const finished = trip.entries.every((entry) => entry.completed);
  const name = trip.monster ?? "Any monster";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group flex items-center ${
        isDragging ? "bg-muted relative z-10 shadow-md" : ""
      }`}
    >
      {/* The handle, not the line: the line is the button that takes you to
          the trip, and Enter on it should go there rather than pick it up. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${name}`}
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none py-1.5 pl-2 opacity-40 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onSelect(anchor)}
        className={`hover:bg-muted min-w-0 flex-1 truncate py-1.5 pr-3 pl-1.5 text-left text-sm transition-colors ${
          finished ? "text-muted-foreground" : ""
        } ${trip.monster === null ? "italic" : ""}`}
      >
        {name}
      </button>
    </li>
  );
}
