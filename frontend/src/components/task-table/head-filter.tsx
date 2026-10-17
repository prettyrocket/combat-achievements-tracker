// The filter that lives on a column header: Monster, Type and Tier.
//
// These were three buttons in the bar above the table, a long way from the
// column whose values they narrow. On the header they sit beside the sort that
// already answers "how is this column arranged", and the bar is left with the
// search box.

import type { ComponentProps } from "react";
import { ListFilter } from "lucide-react";
import {
  TIERS,
  TASK_TYPES,
  TYPE_LABEL,
  type TaskQuery,
  type TaskType,
  type Tier,
} from "@/lib/types";
import { FacetPicker } from "@/components/facet-picker";
import { MonsterPicker } from "@/components/monster-picker";
import { TierBadge } from "@/components/tier-badge";

/** The columns that carry a filter, and only those. */
export const FILTERED_COLUMNS = ["monster", "type", "tier"] as const;
export type FilteredColumn = (typeof FILTERED_COLUMNS)[number];

export function isFilteredColumn(id: string): id is FilteredColumn {
  return (FILTERED_COLUMNS as readonly string[]).includes(id);
}

/** Adds or removes one value from a facet, returning undefined when it empties. */
function toggleFacet<T>(current: T[] | undefined, value: T): T[] | undefined {
  const next = current?.includes(value)
    ? current.filter((v) => v !== value)
    : [...(current ?? []), value];
  return next.length ? next : undefined;
}

/**
 * An icon until it is doing something, then the icon and a count -- the header
 * is a label first, and a lit control on every one of them would drown it.
 *
 * The rest of the props are the popover's: as its trigger this receives the
 * click handler, the ref and the aria-expanded state, and must pass them on.
 */
function Trigger({
  label,
  count,
  ...props
}: ComponentProps<"button"> & { label: string; count: number }) {
  return (
    <button
      type="button"
      {...props}
      aria-label={
        count === 0 ? `Filter ${label}` : `Filter ${label}, ${count} selected`
      }
      className={`hover:text-foreground hover:bg-muted inline-flex h-6 items-center gap-0.5 rounded px-1 transition-colors ${
        count > 0 ? "text-foreground bg-muted" : "text-muted-foreground"
      }`}
    >
      <ListFilter
        className={`size-3.5 ${count > 0 ? "" : "opacity-60"}`}
        aria-hidden
      />
      {count > 0 && <span className="text-xs tabular-nums">{count}</span>}
    </button>
  );
}

export interface HeadFilterProps {
  column: FilteredColumn;
  query: TaskQuery;
  onQueryChange: (next: TaskQuery) => void;
  /** Every monster with its task count, for the picker. */
  monsters: readonly { name: string; count: number }[];
  onToggleMonster: (monster: string) => void;
}

export function HeadFilter({
  column,
  query,
  onQueryChange,
  monsters,
  onToggleMonster,
}: HeadFilterProps) {
  if (column === "monster") {
    const selected = query.monster ?? [];
    return (
      <MonsterPicker
        monsters={monsters}
        selected={selected}
        onToggle={onToggleMonster}
        trigger={<Trigger label="monsters" count={selected.length} />}
      />
    );
  }

  if (column === "tier") {
    const selected = query.tier ?? [];
    return (
      <FacetPicker
        label="Tiers"
        options={TIERS}
        selected={selected}
        onToggle={(tier) =>
          onQueryChange({ ...query, tier: toggleFacet(query.tier, tier) })
        }
        renderOption={(tier: Tier) => <TierBadge tier={tier} />}
        trigger={<Trigger label="tiers" count={selected.length} />}
      />
    );
  }

  const selected = query.type ?? [];
  return (
    <FacetPicker
      label="Types"
      options={TASK_TYPES}
      selected={selected}
      onToggle={(type) =>
        onQueryChange({ ...query, type: toggleFacet(query.type, type) })
      }
      renderOption={(type: TaskType) => TYPE_LABEL[type]}
      trigger={<Trigger label="types" count={selected.length} />}
    />
  );
}
