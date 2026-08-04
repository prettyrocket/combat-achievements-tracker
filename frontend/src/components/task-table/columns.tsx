// What a column *is*: eight definitions and the row state they read.
//
// The one thing to keep in mind when editing this file is what a column def is
// allowed to close over. Defs that capture `completed` are rebuilt on every tick,
// and a new def array makes TanStack rebuild its columns and remount every cell
// -- which is how toggling one checkbox used to block the main thread for over a
// second. Anything that changes as you use the table arrives through `TableMeta`
// instead; only the callbacks belong in the closure.

import type { ColumnDef } from "@tanstack/react-table";
import { gateReason, type GateCheck } from "@/lib/requirements";
import { TYPE_LABEL, type TaskRow } from "@/lib/types";
import {
  COMPLETION_TONE_CLASS,
  completionTone,
  formatCompletion,
} from "@/lib/completion";
import { monsterWikiUrl, taskWikiUrl } from "@/lib/wiki";
import { TierBadge } from "@/components/tier-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ListToggle, SplitName, WikiLink } from "@/components/task-table/cells";

/**
 * Row state that changes constantly, kept out of the column defs.
 *
 * Column defs that close over `completed` are rebuilt on every tick, and a new
 * def array makes TanStack rebuild its columns and remount every cell. Reading
 * this from meta instead means a tick re-renders cells and nothing more.
 */
export interface TableMeta {
  completed: ReadonlySet<number>;
  onList: ReadonlySet<number>;
  activeMonsters: readonly string[];
  gates: ReadonlyMap<string, GateCheck>;
}

/** The callbacks a column may close over -- all stable, none row state. */
export interface ColumnHandlers {
  onToggle: (wikiId: number) => void;
  onPivotToMonster: (monster: string) => void;
  onAddMonster: (monster: string) => void;
  onToggleListed: (wikiId: number) => void;
}

export function buildColumns({
  onToggle,
  onPivotToMonster,
  onAddMonster,
  onToggleListed,
}: ColumnHandlers): ColumnDef<TaskRow>[] {
  return [
    {
      id: "completed",
      header: () => <span className="sr-only">Completed</span>,
      cell: ({ row, table }) => {
        const task = row.original;
        const isDone = (table.options.meta as TableMeta).completed.has(
          task.wikiId,
        );
        return (
          <Checkbox
            checked={isDone}
            onCheckedChange={() => onToggle(task.wikiId)}
            aria-label={`Mark "${task.name}" as ${isDone ? "not completed" : "completed"}`}
          />
        );
      },
    },
    {
      id: "listed",
      header: () => <span className="sr-only">On my list</span>,
      cell: ({ row, table }) => {
        const task = row.original;
        const { onList, gates } = table.options.meta as TableMeta;
        return (
          <ListToggle
            name={task.name}
            listed={onList.has(task.wikiId)}
            gateReason={gateReason(gates, task.monster)}
            onToggle={() => onToggleListed(task.wikiId)}
          />
        );
      },
    },
    {
      id: "monster",
      header: "Monster",
      accessorFn: (t) => t.monster,
      cell: ({ row, table }) => {
        const { monster } = row.original;
        if (monster === null) {
          return <span className="text-muted-foreground italic">Any</span>;
        }
        const { activeMonsters: active } = table.options.meta as TableMeta;
        // Already filtered to this one: clicking would be a no-op, so don't offer it.
        const isActive = active.some(
          (m) => m.toLowerCase() === monster.toLowerCase(),
        );
        return (
          <span className="flex items-start gap-1.5">
            {isActive ? (
              <SplitName value={monster} />
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  // Shift adds to the filter instead of replacing it, so you can
                  // hold two bosses side by side without retyping either.
                  if (event.shiftKey) onAddMonster(monster);
                  else onPivotToMonster(monster);
                }}
                title={`Show only ${monster} tasks — shift-click to add it alongside`}
                className="hover:text-foreground text-left underline decoration-dotted underline-offset-4 hover:decoration-solid"
              >
                <SplitName value={monster} />
              </button>
            )}
            <WikiLink
              href={monsterWikiUrl(monster)}
              label={`${monster} on the wiki`}
            />
          </span>
        );
      },
    },
    {
      id: "name",
      header: "Name",
      accessorFn: (t) => t.name,
      cell: ({ row }) => (
        <span className="flex items-start gap-1.5">
          <SplitName value={row.original.name} className="font-medium" />
          <WikiLink
            href={taskWikiUrl(row.original.name)}
            label={`"${row.original.name}" on the wiki`}
          />
        </span>
      ),
    },
    {
      id: "description",
      header: "Description",
      accessorFn: (t) => t.description,
      // The only column allowed to wrap freely -- descriptions are full
      // sentences, and truncating them hides the actual requirement.
      cell: ({ row }) => (
        <span className="text-muted-foreground block max-w-prose whitespace-normal">
          {row.original.description}
        </span>
      ),
    },
    {
      id: "type",
      header: "Type",
      accessorFn: (t) => t.type,
      cell: ({ row }) => TYPE_LABEL[row.original.type],
    },
    {
      id: "tier",
      header: "Tier",
      accessorFn: (t) => t.tier,
      cell: ({ row }) => <TierBadge tier={row.original.tier} />,
    },
    {
      id: "points",
      header: () => <span className="block text-right">Pts</span>,
      accessorFn: (t) => t.points,
      cell: ({ row }) => (
        <span className="text-muted-foreground block text-right tabular-nums">
          {row.original.points}
        </span>
      ),
    },
    {
      id: "completionPct",
      header: () => <span className="block text-right">Comp%</span>,
      accessorFn: (t) => t.completionPct,
      cell: ({ row }) => {
        const { completionPct } = row.original;
        return (
          <span
            className={`block text-right tabular-nums ${COMPLETION_TONE_CLASS[completionTone(completionPct)]}`}
          >
            {formatCompletion(completionPct)}
          </span>
        );
      },
    },
  ];
}
