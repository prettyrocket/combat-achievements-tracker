// Where the plan sits, drawn rather than described.
//
// This was a dropdown reading "Right of the table", which is four words to say
// something a 16px picture says at a glance -- the same reason an IDE puts its
// panel toggles in the corner as little diagrams instead of in a menu. Each
// button is the app in outline with the plan's block shaded, so the control
// looks like what it does.
//
// The glyph is drawn here rather than imported. Lucide has exactly these four
// (`PanelLeft` and friends) but they mark the panel with a divider line and
// leave the region empty, which says where the split is without saying which
// side is yours. A shaded block answers the actual question, and it costs one
// rect. Everything else -- the 24 viewBox, the 2px round-capped stroke -- is
// lucide's geometry, so these sit beside the app's other icons as equals.
//
// The words are still there in `title` and `aria-label`: a screen reader gets
// "Left of the table", and so does anyone who hovers because four small frames
// look alike until you have used them once.

import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { LIST_POSITIONS, type ListPosition } from "@/lib/list-position";

/** The shaded block, and the line where the split falls. */
const REGION: Record<
  ListPosition,
  { x: number; y: number; width: number; height: number; divider: string }
> = {
  left: { x: 3, y: 3, width: 6, height: 18, divider: "M9 3v18" },
  right: { x: 15, y: 3, width: 6, height: 18, divider: "M15 3v18" },
  above: { x: 3, y: 3, width: 18, height: 6, divider: "M3 9h18" },
  below: { x: 3, y: 15, width: 18, height: 6, divider: "M3 15h18" },
};

function LayoutGlyph({ position }: { position: ListPosition }) {
  const { divider, ...block } = REGION[position];
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x={3} y={3} width={18} height={18} rx={2} />
      {/* Under the stroked outline, and rounded to match it, so the block does
          not poke out through the frame's corners. */}
      <rect {...block} rx={1} fill="currentColor" stroke="none" opacity={0.4} />
      <path d={divider} />
    </svg>
  );
}

/**
 * A radio group, not four toggles. One of these is always true and picking one
 * unpicks the rest, which is what gets arrow-key navigation and the right thing
 * read out -- "Right of the table, selected, 2 of 4" rather than four unrelated
 * buttons that happen to sit together.
 *
 * The selected look comes from `value` rather than from a `data-` attribute:
 * this component already knows which one is on, and reading it back off the DOM
 * means guessing at which attribute this version of Radix writes.
 */
export function LayoutPicker({
  value,
  onChange,
}: {
  value: ListPosition;
  onChange: (position: ListPosition) => void;
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(next) => onChange(next as ListPosition)}
      aria-label="Where my list sits"
      className="flex gap-1"
    >
      {LIST_POSITIONS.map(({ id, label }) => {
        const selected = id === value;
        return (
          <RadioGroupPrimitive.Item
            key={id}
            value={id}
            title={label}
            aria-label={label}
            className={`focus-visible:ring-ring/50 rounded-md border p-1.5 transition-colors outline-none focus-visible:ring-3 ${
              selected
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <LayoutGlyph position={id} />
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
