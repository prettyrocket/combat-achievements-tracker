// A column header's one control: its name, opening a menu that sorts, groups
// and filters by that column.
//
// These were three things in three places -- click the header to sort, a picker
// in the bar above to filter, and grouping only as a side effect of sorting by
// monster. Every one of them is a question about this column, so they are asked
// here. The header itself stays a plain label; what is in force shows in the
// menu, not as marks on the header.

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Ellipsis } from "lucide-react";
import {
  TIERS,
  TASK_TYPES,
  TYPE_LABEL,
  type GroupKey,
  type SortKey,
  type TaskQuery,
  type TaskType,
  type Tier,
} from "@/lib/types";
import { COLUMN_SORT, sortDirection } from "@/lib/task-query";
import { MonsterOptions } from "@/components/monster-picker";
import { TierBadge } from "@/components/tier-badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type SortableColumn = keyof typeof COLUMN_SORT;

export function isSortableColumn(id: string): id is SortableColumn {
  return id in COLUMN_SORT;
}

/**
 * What each direction means, in the column's own words. "Ascending" makes you
 * work out which end of Comp% is the rare one; "Rarest first" doesn't.
 */
const SORT_LABEL: Record<SortKey, string> = {
  monster_asc: "A to Z",
  monster_desc: "Z to A",
  type_asc: "A to Z",
  type_desc: "Z to A",
  tier_asc: "Easy first",
  tier_desc: "Grandmaster first",
  points_desc: "Most points first",
  points_asc: "Fewest points first",
  comp_desc: "Most common first",
  comp_asc: "Rarest first",
};

/**
 * Off, then the column's first direction, then its other one, then off again.
 * Arriving from another column's sort counts as off.
 */
function nextSort(
  pair: readonly SortKey[],
  current: SortKey | undefined,
): SortKey | undefined {
  const at = current === undefined ? -1 : pair.indexOf(current);
  return at === -1 ? pair[0] : at === 0 ? pair[1] : undefined;
}

const GROUP_LABEL: Record<GroupKey, string> = {
  monster: "Group by monster",
  type: "Group by type",
  tier: "Group by tier",
};

function isGroupColumn(id: SortableColumn): id is GroupKey {
  return id === "monster" || id === "type" || id === "tier";
}

/** Adds or removes one value from a facet, returning undefined when it empties. */
function toggleFacet<T>(current: T[] | undefined, value: T): T[] | undefined {
  const next = current?.includes(value)
    ? current.filter((v) => v !== value)
    : [...(current ?? []), value];
  return next.length ? next : undefined;
}

/** A menu row with a tick box: the one shape every choice here takes. */
function CheckRow({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
    >
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
          checked
            ? "bg-foreground border-transparent"
            : "border-muted-foreground/40"
        }`}
      >
        {checked && <Check className="text-background size-3" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className="border-b p-1 last:border-b-0"
      role="group"
      aria-label={label}
    >
      <p className="text-muted-foreground px-2 pt-1 pb-0.5 text-xs font-medium">
        {label}
      </p>
      {children}
    </div>
  );
}

export interface ColumnMenuProps {
  column: SortableColumn;
  /** The header's text, as the column definition renders it. */
  label: ReactNode;
  /** The column's name in words, for the trigger's accessible name. */
  name: string;
  query: TaskQuery;
  /** Undefined is the wiki's own order. */
  sort: SortKey | undefined;
  onSortChange: (next: SortKey | undefined) => void;
  onQueryChange: (next: TaskQuery) => void;
  /** Every monster with its task count, for the Monster column's filter. */
  monsters: readonly { name: string; count: number }[];
  onToggleMonster: (monster: string) => void;
}

export function ColumnMenu({
  column,
  label,
  name,
  query,
  sort,
  onSortChange,
  onQueryChange,
  monsters,
  onToggleMonster,
}: ColumnMenuProps) {
  const [open, setOpen] = useState(false);
  const pair: readonly SortKey[] = COLUMN_SORT[column];
  const active = sort !== undefined && pair.includes(sort);
  const SortIcon = !active
    ? ArrowUpDown
    : sortDirection(sort!) === "asc"
      ? ArrowUp
      : ArrowDown;
  const groupable = isGroupColumn(column);
  const grouped = groupable && query.group === column;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${name} column options`}
          className="hover:text-foreground hover:bg-muted text-muted-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors"
        >
          {label}
          <Ellipsis className="size-3.5 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64" aria-label={`${name} column`}>
        {/* One sort row that steps through the column's two directions and
            back to none, the way a spreadsheet header does -- it says where it
            is, so the menu stays open while you step. Group sits with it, one
            tick, no heading needed. */}
        <div className="border-b p-1 last:border-b-0">
          <button
            type="button"
            onClick={() => onSortChange(nextSort(pair, sort))}
            className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
          >
            <SortIcon
              className={`size-4 shrink-0 ${active ? "" : "text-muted-foreground"}`}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">
              {active ? `Sort: ${SORT_LABEL[sort!]}` : "Sort"}
            </span>
          </button>
          {groupable && (
            <CheckRow
              checked={grouped}
              onClick={() =>
                onQueryChange({ ...query, group: grouped ? undefined : column })
              }
            >
              {GROUP_LABEL[column]}
            </CheckRow>
          )}
        </div>

        {column === "monster" && (
          <Section label="Filter">
            <MonsterOptions
              monsters={monsters}
              selected={query.monster ?? []}
              onToggle={onToggleMonster}
            />
          </Section>
        )}

        {column === "tier" && (
          <Section label="Filter">
            {TIERS.map((tier: Tier) => (
              <CheckRow
                key={tier}
                checked={query.tier?.includes(tier) ?? false}
                onClick={() =>
                  onQueryChange({
                    ...query,
                    tier: toggleFacet(query.tier, tier),
                  })
                }
              >
                <TierBadge tier={tier} />
              </CheckRow>
            ))}
          </Section>
        )}

        {column === "type" && (
          <Section label="Filter">
            {TASK_TYPES.map((type: TaskType) => (
              <CheckRow
                key={type}
                checked={query.type?.includes(type) ?? false}
                onClick={() =>
                  onQueryChange({
                    ...query,
                    type: toggleFacet(query.type, type),
                  })
                }
              >
                {TYPE_LABEL[type]}
              </CheckRow>
            ))}
          </Section>
        )}
      </PopoverContent>
    </Popover>
  );
}
