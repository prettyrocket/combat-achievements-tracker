import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Info } from "lucide-react";
import { TASKS } from "@/data/tasks";
import { Button } from "@/components/ui/button";
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
import { TaskTable } from "@/components/task-table";
import { ProgressToolbar } from "@/components/progress-toolbar";
import { ProgressHeader } from "@/components/progress-header";
import { FilterBar } from "@/components/filter-bar";
import { MonsterBreadcrumb } from "@/components/monster-breadcrumb";
import { TaskListPanel } from "@/components/tasklist-panel";
import { TASKLIST_DROPPABLE, parseDragId } from "@/lib/dnd";
import { readJson, writeJson } from "@/lib/local-store";
import { summarize, summarizeMonster } from "@/lib/progress-summary";
import {
  checkAll,
  profileIsEmpty,
  type PlayerProfile,
} from "@/lib/requirements";
import { rewardStatus, rewardTiers } from "@/lib/rewards";
import {
  clearShareCode,
  decodeShareCode,
  readShareCode,
  type ShareCodeResult,
} from "@/lib/share-code";
import { resolve } from "@/lib/tasklist";
import {
  DEFAULT_SORT,
  addMonster,
  clearMonster,
  pivotToMonster,
  removeMonster,
  applyQuery,
} from "@/lib/task-query";
import { useProfile } from "@/lib/use-profile";
import type { ProfileSource } from "@/lib/profile-store";
import type { LoadSourceId } from "@/lib/load-source";
import { useProgress } from "@/lib/use-progress";
import { useTaskList } from "@/lib/use-tasklist";
import { useTaskQuery } from "@/lib/use-task-query";
import type { SortKey } from "@/lib/types";

// Every distinct monster with its task count, for the picker. Static data, so
// it's computed once at module load rather than per render.
const MONSTERS = (() => {
  const counts = new Map<string, number>();
  for (const task of TASKS) {
    if (task.monster !== null)
      counts.set(task.monster, (counts.get(task.monster) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
})();

const BY_ID = new Map(TASKS.map((task) => [task.wikiId, task]));

// The point requirements for each reward tier, derived from the bundle -- see
// rewards.ts for why they aren't constants. Static data, so once at module load.
const REWARD_TIERS = rewardTiers(TASKS);

// Whether the panel was left open, and whether the summary was left collapsed.
// UI state, not data, so each gets its own key and stays out of the export --
// restoring a backup shouldn't rearrange the furniture.
const PANEL_KEY = "ca-tracker:tasklist-open:v1";
const COMPACT_KEY = "ca-tracker:summary-compact:v1";
// Whether the "this lives in your browser only" notice has been read. Its own
// key for the same reason: it's furniture, not data.
const LOCAL_NOTICE_KEY = "ca-tracker:local-notice-dismissed:v1";
// The account the last WikiSync import came from, so a later import can tell
// whether the planned list beside it was built for this account or another.
const RSN_KEY = "ca-tracker:last-rsn:v1";

function storedFlag(key: string, fallback: boolean): boolean {
  const stored = readJson(key);
  return typeof stored === "boolean" ? stored : fallback;
}

/**
 * Whether the summary should start collapsed, for someone who has never said.
 *
 * Nothing above the table scrolls away any more, which is the point -- but it
 * also means the header block is charged to the table's height. On a short or
 * narrow window the six tier meters would leave a table two rows tall, so the
 * first impression there is the one-line form. Say otherwise once and that
 * choice is remembered.
 */
function compactByDefault(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1024 || window.innerHeight < 900;
}

export default function App() {
  const { completed, toggle, setMany, reset, undo, storageError } =
    useProgress();
  const { query, setQuery, clear } = useTaskQuery();
  const taskList = useTaskList();
  const profile = useProfile();
  // Pulled out because it's the one part of `profile` that is stable across
  // renders, which is what the import callback below wants to depend on.
  const { setProfile } = profile;

  // Lifted out of the dialog because the requirement filter opens it: with no
  // levels entered there is nothing to filter on, and sending you to find the
  // button yourself is worse than taking you there. The filter asks for the
  // by-hand pane specifically; everything else opens on whichever source was
  // last imported from.
  const [loadOpen, setLoadOpen] = useState(false);
  const [loadSource, setLoadSource] = useState<LoadSourceId | null>(null);

  const openProfileEditor = useCallback(() => {
    setLoadSource("manual");
    setLoadOpen(true);
  }, []);

  const onLoadOpenChange = useCallback((open: boolean) => {
    setLoadOpen(open);
    // Cleared on close so the next plain Load click gets the remembered source
    // rather than being pinned to wherever the filter last sent you.
    if (!open) setLoadSource(null);
  }, []);

  // A share code in the address bar, waiting on a yes or no. Never applied on
  // arrival: following a link is not consent to replace what this browser
  // already holds, and the person clicking it may not know it carries anything.
  const [incoming, setIncoming] = useState<ShareCodeResult | null>(null);
  const [incomingError, setIncomingError] = useState<string | null>(null);

  // Open by default: a plan you have to go and find is a plan you stop using.
  const [panelOpen, setPanelOpen] = useState(() => storedFlag(PANEL_KEY, true));
  const [compactSummary, setCompactSummary] = useState(() =>
    storedFlag(COMPACT_KEY, compactByDefault()),
  );
  const [dragging, setDragging] = useState<number | null>(null);
  // What the last pivot took out of the search box, so it can be handed back.
  const [parkedSearch, setParkedSearch] = useState<string | null>(null);
  const [localNoticeSeen, setLocalNoticeSeen] = useState(() =>
    storedFlag(LOCAL_NOTICE_KEY, false),
  );
  const [lastRsn, setLastRsn] = useState<string | null>(() => {
    const stored = readJson(RSN_KEY);
    return typeof stored === "string" && stored.trim() !== "" ? stored : null;
  });

  // Ctrl+Z / ⌘Z anywhere that isn't a text field, and the only way to undo --
  // ticking a task is a one-click change to the thing this app is for, so the
  // reflex that follows a misclick is the right thing to answer, and it's the
  // reflex people already have.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "z" ||
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey
      )
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA"
      ) {
        return;
      }
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo]);

  // Read once, on arrival. A malformed code is reported rather than ignored:
  // silently dropping it would look exactly like a link that did nothing.
  useEffect(() => {
    const code = readShareCode(window.location.hash);
    if (code === null) return;
    try {
      setIncoming(decodeShareCode(code));
    } catch (err) {
      setIncomingError(
        err instanceof Error
          ? err.message
          : "That share code could not be read.",
      );
      clearShareCode();
    }
  }, []);

  const dismissShareCode = useCallback(() => {
    setIncoming(null);
    setIncomingError(null);
    clearShareCode();
  }, []);

  // The summary deliberately ignores the query: it reports progress against the
  // whole game, not against whatever happens to be filtered in right now.
  const summary = useMemo(() => summarize(TASKS, completed), [completed]);

  const rewards = useMemo(
    () => rewardStatus(REWARD_TIERS, summary.pointsEarned),
    [summary.pointsEarned],
  );

  const visible = useMemo(
    () => applyQuery(TASKS, query, completed, profile.profile),
    [query, completed, profile.profile],
  );

  // One verdict per monster, not per task: 646 rows share 89 answers, and the
  // table reads this on every row it draws.
  const gates = useMemo(
    () => checkAll(TASKS, profile.profile),
    [profile.profile],
  );

  const monsterSummaries = useMemo(
    () =>
      (query.monster ?? []).map((monster) =>
        summarizeMonster(TASKS, completed, monster),
      ),
    [query.monster, completed],
  );

  const entries = useMemo(
    () => resolve(taskList.list, TASKS, completed),
    [taskList.list, completed],
  );

  const listedIds = useMemo(() => new Set(taskList.list), [taskList.list]);

  const pivot = useCallback(
    (monster: string) => {
      // Navigation, so it earns its own history entry rather than being folded
      // into whatever filtering came just before it.
      setQuery(pivotToMonster(query, monster), "push");
      setParkedSearch(query.q?.trim() || null);
    },
    [query, setQuery],
  );

  const addToPivot = useCallback(
    (monster: string) => {
      setQuery(addMonster(query, monster), "push");
      if (query.q?.trim()) setParkedSearch(query.q.trim());
    },
    [query, setQuery],
  );

  const dropMonster = useCallback(
    (monster: string) => setQuery(removeMonster(query, monster), "push"),
    [query, setQuery],
  );

  /** The picker's one action: in if it's out, out if it's in. */
  const toggleMonster = useCallback(
    (monster: string) => {
      const isOn = (query.monster ?? []).some(
        (m) => m.trim().toLowerCase() === monster.trim().toLowerCase(),
      );
      setQuery(
        isOn ? removeMonster(query, monster) : addMonster(query, monster),
        "push",
      );
      if (!isOn && query.q?.trim()) setParkedSearch(query.q.trim());
    },
    [query, setQuery],
  );

  const unpivot = useCallback(() => {
    setQuery(clearMonster(query), "push");
    setParkedSearch(null);
  }, [query, setQuery]);

  const restoreSearch = useCallback(() => {
    if (parkedSearch) setQuery({ ...query, q: parkedSearch }, "push");
    setParkedSearch(null);
  }, [parkedSearch, query, setQuery]);

  const setSort = useCallback(
    (sort: SortKey) =>
      setQuery({ ...query, sort: sort === DEFAULT_SORT ? undefined : sort }),
    [query, setQuery],
  );

  const clearAll = useCallback(() => {
    clear();
    setParkedSearch(null);
  }, [clear]);

  const togglePanel = useCallback((open: boolean) => {
    setPanelOpen(open);
    writeJson(PANEL_KEY, open);
  }, []);

  const toggleCompact = useCallback((compact: boolean) => {
    setCompactSummary(compact);
    writeJson(COMPACT_KEY, compact);
  }, []);

  const dismissLocalNotice = useCallback(() => {
    setLocalNoticeSeen(true);
    writeJson(LOCAL_NOTICE_KEY, true);
  }, []);

  /**
   * The account this browser tracks.
   *
   * Set by an import, and also by simply typing the name into Load and closing
   * it -- saying who you are is saying who you are, whether or not anything was
   * fetched. It's what the different-account warning compares against, so a
   * player who enters levels by hand gets that protection too.
   */
  const rememberRsn = useCallback((rsn: string) => {
    const name = rsn.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    if (name === "") return;
    setLastRsn(name);
    writeJson(RSN_KEY, name);
  }, []);

  /**
   * An import replaces progress outright -- the account is the authority on
   * what's done. The planned list is not the account's to overwrite, so it
   * survives unless the import is for a different player and you say so.
   *
   * Shared by both doors: a WikiSync paste and a RuneProfile lookup carry the
   * same three facts and differ only in how they were fetched, so the only
   * thing `source` changes is what the profile editor calls it afterwards.
   */
  const applyImport = useCallback(
    (
      ids: number[],
      rsn: string,
      clearList: boolean,
      imported: PlayerProfile | null,
      source: ProfileSource,
    ) => {
      setMany(ids);
      if (clearList) taskList.clear();
      // Only when the import actually carried levels. A payload without them
      // must not wipe a profile the player typed in by hand.
      if (imported) setProfile(imported, source);
      rememberRsn(rsn);
    },
    [setMany, taskList, setProfile, rememberRsn],
  );

  // Distance-activated, so a press that turns into a click still reaches the
  // checkbox and the monster pivot inside the row rather than starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    setDragging(parseDragId(active.id)?.wikiId ?? null);
  }, []);

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setDragging(null);
      if (!over) return;

      const source = parseDragId(active.id);
      if (!source) return;

      const target = parseDragId(over.id);
      if (target) {
        // Dropped onto an entry: take that entry's place, pushing it down.
        taskList.insertAt(source.wikiId, taskList.list.indexOf(target.wikiId));
        return;
      }

      // Dropped on the panel itself rather than any entry -- append. Only the
      // panel is a valid target, so anything else is a drag that went nowhere.
      if (over.id === TASKLIST_DROPPABLE)
        taskList.insertAt(source.wikiId, taskList.list.length);
    },
    [taskList],
  );

  const draggingTask = dragging === null ? null : BY_ID.get(dragging);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      {/* The app owns the viewport height and hands what's left to the table.
          Nothing above the table scrolls away, and the table's own scrollbars --
          including the horizontal one, which used to sit 646 rows below the fold
          where nobody could reach it -- belong to a box you can see. */}
      <div className="mx-auto flex h-dvh max-w-[100rem] flex-col overflow-hidden px-6 py-6">
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Combat Achievements Tracker
            </h1>
            {/* The counts live in ProgressHeader now -- one place, and one that
                reports summary.completedTasks rather than the raw set size. */}
            <p className="text-muted-foreground mt-1 text-sm">
              OSRS · {TASKS.length} tasks · data from the wiki Bucket API
            </p>
          </div>
          <ProgressToolbar
            completed={completed}
            completedCount={completed.size}
            list={taskList.list}
            listCount={taskList.list.length}
            lastRsn={lastRsn}
            onReset={reset}
            onClearList={taskList.clear}
            onImportApply={applyImport}
            profile={profile.profile}
            profileIsEmpty={profile.isEmpty}
            profileSource={profile.source}
            loadOpen={loadOpen}
            onLoadOpenChange={onLoadOpenChange}
            loadSource={loadSource}
            onRsnCommit={rememberRsn}
            onSetLevel={profile.setLevel}
            onImportLevels={profile.importLevels}
            onSetQuest={profile.setQuest}
            onClearProfile={profile.clear}
          />
        </header>

        {/* Said once, plainly, on the first visit. The honest version of this
            app's biggest caveat is not a tooltip on an Export button: clearing
            site data takes everything, and there is no copy anywhere else. */}
        {!localNoticeSeen && (
          <p className="text-muted-foreground mt-3 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-dashed px-3 py-2 text-sm">
            <Info className="size-4 shrink-0" aria-hidden />
            <span>
              Your progress is saved{" "}
              <span className="text-foreground">in this browser only</span> —
              there's no account and no server copy. Clearing site data erases
              it, so use <span className="text-foreground">Export</span> to keep
              a backup or move to another device.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={dismissLocalNotice}
              className="ml-auto h-6 px-2 text-xs"
            >
              Got it
            </Button>
          </p>
        )}

        {storageError && (
          <p
            role="alert"
            className="mt-4 shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
          >
            {storageError}
          </p>
        )}

        <div className="shrink-0">
          <ProgressHeader
            summary={summary}
            rewards={rewards}
            compact={compactSummary}
            onCompactChange={toggleCompact}
          />

          <FilterBar
            query={query}
            onChange={setQuery}
            onClear={clearAll}
            monsters={MONSTERS}
            onToggleMonster={toggleMonster}
            resultCount={visible.length}
            totalCount={TASKS.length}
            profileIsEmpty={profile.isEmpty}
            onEditProfile={openProfileEditor}
          />

          {monsterSummaries.length > 0 && (
            <MonsterBreadcrumb
              summaries={monsterSummaries}
              onClear={unpivot}
              onRemove={dropMonster}
              monsters={MONSTERS}
              onToggleMonster={toggleMonster}
              parkedSearch={parkedSearch}
              onRestoreSearch={restoreSearch}
            />
          )}
        </div>

        {/* The split, and the only part allowed to grow: min-h-0 is what lets a
            flex child be *shorter* than its content so the table can scroll
            inside it. Stacks under lg, where a 320px column would leave the
            table unusable -- and the panel goes first there, so it can't end up
            stranded below a table that owns the rest of the screen. */}
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
          <div className="shrink-0 lg:order-2 lg:h-full">
            <TaskListPanel
              entries={entries}
              rewardTiers={REWARD_TIERS}
              pointsEarned={summary.pointsEarned}
              open={panelOpen}
              onOpenChange={togglePanel}
              onToggleCompleted={toggle}
              onRemove={taskList.remove}
              onClear={taskList.clear}
            />
          </div>

          <main className="min-h-0 min-w-0 flex-1 lg:order-1">
            {visible.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
                No tasks match these filters.
              </p>
            ) : (
              <TaskTable
                tasks={visible}
                completed={completed}
                onToggle={toggle}
                onPivotToMonster={pivot}
                onAddMonster={addToPivot}
                activeMonsters={query.monster}
                onList={listedIds}
                onToggleListed={taskList.toggle}
                onAddManyToList={taskList.addMany}
                gates={gates}
                sort={query.sort ?? DEFAULT_SORT}
                onSortChange={setSort}
              />
            )}
          </main>
        </div>
      </div>

      {/* Opening a link is a replace, exactly like an import, so it asks first
          and says what it would cost. Undo covers it afterwards, but only until
          the next reload, which is not long enough to be the whole answer. */}
      <AlertDialog
        open={incoming !== null || incomingError !== null}
        onOpenChange={(open) => {
          if (!open) dismissShareCode();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {incomingError
                ? "That link didn't carry readable progress"
                : "Open shared progress?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {incomingError ??
                (incoming
                  ? `This link holds ${incoming.completed.length} completed tasks` +
                    (incoming.list.length > 0
                      ? ` and a plan of ${incoming.list.length}.`
                      : " and no plan.") +
                    ` Opening it replaces the ${completed.size} completed tasks in this browser` +
                    (taskList.list.length > 0
                      ? ` and your plan of ${taskList.list.length}.`
                      : ".") +
                    (incoming.dropped > 0
                      ? ` ${incoming.dropped} entries weren't recognised and will be ignored.`
                      : "") +
                    // Said plainly in both directions: a link carrying levels
                    // overwrites yours, and one carrying none leaves them be
                    // rather than wiping them. The second half is the one
                    // somebody would otherwise have to test to find out.
                    (profileIsEmpty(incoming.profile)
                      ? " It carries no levels or quests, so yours are left alone."
                      : " Its levels and quests replace yours.")
                  : "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {incomingError ? "Close" : "Keep what I have"}
            </AlertDialogCancel>
            {incoming && (
              <AlertDialogAction
                onClick={() => {
                  setMany(incoming.completed);
                  taskList.replace(incoming.list);
                  // Same rule as an imported file (backup.ts): a code without a
                  // profile is not an instruction to clear one. 'manual' rather
                  // than 'wikisync' because from here it is a thing you accepted,
                  // and the source only decides which way of editing wins.
                  if (!profileIsEmpty(incoming.profile))
                    setProfile(incoming.profile, "manual");
                  dismissShareCode();
                }}
              >
                Replace with the link
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Follows the cursor across the gap between table and panel -- without it
          the row stays put and the drag has nothing to show for itself. */}
      <DragOverlay dropAnimation={null}>
        {draggingTask && (
          <div className="bg-card rounded-md border px-3 py-2 text-sm font-medium shadow-lg">
            {draggingTask.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
