// The layout, and the wiring between the stores and the things that draw them.
//
// Everything that used to make this file long has a home of its own now: the
// localStorage furniture in use-ui-prefs, the arriving share code in
// use-share-code, the pivot in use-monster-filter, the drag mechanics in
// task-drag-provider. What's left is which component gets what, which is the one
// thing an App file should be for.

import { useCallback, useMemo, useState } from "react";
import { TASKS } from "@/data/tasks";
import { TaskTable } from "@/components/task-table";
import { ProgressToolbar } from "@/components/toolbar";
import { LoadDialog } from "@/components/load-dialog";
import { ProgressHeader } from "@/components/progress-header";
import { FilterBar } from "@/components/filter-bar";
import { MonsterBreadcrumb } from "@/components/monster-breadcrumb";
import { ShareCodePrompt } from "@/components/share-code-prompt";
import { TaskDragProvider } from "@/components/task-drag-provider";
import { TaskListPanel } from "@/components/tasklist-panel";
import { importBackup } from "@/lib/backup";
import type { Notice } from "@/lib/notice";
import { summarize, summarizeMonster } from "@/lib/progress-summary";
import {
  checkAll,
  profileIsEmpty,
  type PlayerProfile,
} from "@/lib/requirements";
import { rewardStatus } from "@/lib/rewards";
import type { ShareCodeResult } from "@/lib/share-code";
import { MONSTERS, REWARD_TIERS } from "@/lib/task-index";
import { resolve } from "@/lib/tasklist";
import { DEFAULT_SORT, applyQuery } from "@/lib/task-query";
import { useMonsterFilter } from "@/lib/use-monster-filter";
import { useProfile } from "@/lib/use-profile";
import { isSideDocked, type ListPosition } from "@/lib/list-position";
import type { AccountSource, LoadSourceId } from "@/lib/load-source";
import { useProgress } from "@/lib/use-progress";
import { useShareCode } from "@/lib/use-share-code";
import { useTaskList } from "@/lib/use-tasklist";
import { useTaskQuery } from "@/lib/use-task-query";
import { useUiPrefs } from "@/lib/use-ui-prefs";

// Source order is panel-then-table, which is already "above" and is also the
// stacked fallback the two side positions want under lg. So the side positions
// only order themselves at lg, and the stacked ones order at every width.
//
// Written out in full rather than built from the position: Tailwind scans for
// complete class names, and a string it assembled at runtime is a class that
// was never generated.
const PANEL_ORDER: Record<ListPosition, string> = {
  left: "lg:order-1 lg:h-full",
  right: "lg:order-2 lg:h-full",
  above: "order-1",
  below: "order-2",
};

const TABLE_ORDER: Record<ListPosition, string> = {
  left: "lg:order-2",
  right: "lg:order-1",
  above: "order-2",
  below: "order-1",
};

export default function App() {
  const {
    completed,
    source: progressSource,
    toggle,
    setMany,
    reset,
    storageError,
  } = useProgress();
  const { query, setQuery, clear } = useTaskQuery();
  const taskList = useTaskList();
  const profile = useProfile();
  // Pulled out because it's the one part of `profile` that is stable across
  // renders, which is what the import callback below wants to depend on.
  const { setProfile } = profile;

  // Takes the source because one pref is defaulted from it: manual tracking is
  // on unless an account is already keeping the answers.
  const prefs = useUiPrefs(progressSource);
  const shareCode = useShareCode();
  const filter = useMonsterFilter(query, setQuery, clear);
  // Same reason as `setProfile` above: the stable half of a hook result, pulled
  // out so the callback below doesn't depend on an object rebuilt every render.
  const { dismiss: dismissShareCode } = shareCode;

  // Lifted out of the dialog because the requirement filter opens it: with no
  // levels entered there is nothing to filter on, and sending you to find the
  // button yourself is worse than taking you there. The filter asks for the
  // by-hand pane specifically; everything else opens on whichever source was
  // last imported from.
  const [loadOpen, setLoadOpen] = useState(false);
  const [loadSource, setLoadSource] = useState<LoadSourceId | null>(null);

  // Lives here rather than in the toolbar because a file import finishes after
  // its dialog has closed: the message describes three stores at once and is
  // worth reading once the thing that produced it has gone.
  const [notice, setNotice] = useState<Notice | null>(null);

  const openProfileEditor = useCallback(() => {
    setLoadSource("manual");
    setLoadOpen(true);
  }, []);

  const openLoad = useCallback(() => setLoadOpen(true), []);

  const onLoadOpenChange = useCallback((open: boolean) => {
    setLoadOpen(open);
    // Cleared on close so the next plain Load click gets the remembered source
    // rather than being pinned to wherever the filter last sent you.
    if (!open) setLoadSource(null);
  }, []);

  /**
   * Rethrows rather than swallowing: the file pane shows the failure beside its
   * own button, where the person who picked the file is looking. Only a success
   * reaches the notice line, because that message describes three stores at once
   * and is worth reading after the dialog has gone.
   */
  const handleImportFile = useCallback(async (file: File) => {
    const result = importBackup(await file.text());
    setNotice({
      tone: "ok",
      message:
        `Imported ${result.imported} completed tasks` +
        (result.listImported > 0
          ? ` and ${result.listImported} on your list.`
          : ".") +
        (result.profileImported
          ? " Your levels and quests came with it."
          : "") +
        (result.dropped + result.listDropped > 0
          ? ` Ignored ${result.dropped + result.listDropped} unrecognised entries.`
          : ""),
    });
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

  const sideDocked = isSideDocked(prefs.listPosition);

  const { rememberRsn } = prefs;

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
      source: AccountSource,
    ) => {
      setMany(ids, source);
      if (clearList) taskList.clear();
      // Only when the import actually carried levels. A payload without them
      // must not wipe a profile the player typed in by hand.
      if (imported) setProfile(imported, source);
      rememberRsn(rsn);
    },
    [setMany, taskList, setProfile, rememberRsn],
  );

  const acceptShareCode = useCallback(
    (incoming: ShareCodeResult) => {
      // 'sharecode' rather than 'manual': someone handed you a finished set,
      // which is the same relationship to it that an import has.
      setMany(incoming.completed, "sharecode");
      taskList.replace(incoming.list);
      // Same rule as an imported file (backup.ts): a code without a profile is
      // not an instruction to clear one. 'manual' rather than 'wikisync'
      // because from here it is a thing you accepted, and the source only
      // decides which way of editing wins.
      if (!profileIsEmpty(incoming.profile))
        setProfile(incoming.profile, "manual");
      dismissShareCode();
    },
    [setMany, taskList, setProfile, dismissShareCode],
  );

  return (
    <TaskDragProvider list={taskList.list} onInsertAt={taskList.insertAt}>
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
          </div>
          <ProgressToolbar
            completed={completed}
            completedCount={completed.size}
            list={taskList.list}
            listCount={taskList.list.length}
            profile={profile.profile}
            profileIsEmpty={profile.isEmpty}
            onReset={reset}
            onClearList={taskList.clear}
            onClearProfile={profile.clear}
            onLoadOpen={openLoad}
            notice={notice}
            onNotice={setNotice}
            manualTracking={prefs.manualTracking}
            onManualTrackingChange={prefs.setManualTracking}
            listPosition={prefs.listPosition}
            onListPositionChange={prefs.setListPosition}
          />
        </header>

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
            rsn={prefs.lastRsn}
            compact={prefs.compactSummary}
            onCompactChange={prefs.setCompactSummary}
          />

          <FilterBar
            query={query}
            onChange={setQuery}
            onClear={filter.clearAll}
            monsters={MONSTERS}
            onToggleMonster={filter.toggleMonster}
            resultCount={visible.length}
            totalCount={TASKS.length}
            profileIsEmpty={profile.isEmpty}
            onEditProfile={openProfileEditor}
          />

          {monsterSummaries.length > 0 && (
            <MonsterBreadcrumb
              summaries={monsterSummaries}
              onClear={filter.unpivot}
              onRemove={filter.dropMonster}
              monsters={MONSTERS}
              onToggleMonster={filter.toggleMonster}
              parkedSearch={filter.parkedSearch}
              onRestoreSearch={filter.restoreSearch}
            />
          )}
        </div>

        {/* The split, and the only part allowed to grow: min-h-0 is what lets a
            flex child be *shorter* than its content so the table can scroll
            inside it.

            Left and right stack under lg, where a 320px column would leave the
            table unusable, and the panel goes first there so it can't end up
            stranded below a table that owns the rest of the screen. Above and
            below are a column at every width -- that is what was asked for, and
            a bar can't be squeezed out the way a side column can. */}
        <div
          className={`mt-3 flex min-h-0 flex-1 flex-col gap-3 ${
            sideDocked ? "lg:flex-row lg:items-stretch" : ""
          }`}
        >
          <div className={`shrink-0 ${PANEL_ORDER[prefs.listPosition]}`}>
            <TaskListPanel
              entries={entries}
              rewardTiers={REWARD_TIERS}
              pointsEarned={summary.pointsEarned}
              open={prefs.panelOpen}
              onOpenChange={prefs.setPanelOpen}
              position={prefs.listPosition}
              manualTracking={prefs.manualTracking}
              onToggleCompleted={toggle}
              onRemove={taskList.remove}
              onClear={taskList.clear}
            />
          </div>

          <main
            className={`min-h-0 min-w-0 flex-1 ${TABLE_ORDER[prefs.listPosition]}`}
          >
            {visible.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
                No tasks match these filters.
              </p>
            ) : (
              <TaskTable
                tasks={visible}
                completed={completed}
                onToggle={toggle}
                manualTracking={prefs.manualTracking}
                onList={listedIds}
                onToggleListed={taskList.toggle}
                onAddManyToList={taskList.addMany}
                gates={gates}
                sort={query.sort ?? DEFAULT_SORT}
                onSortChange={filter.setSort}
              />
            )}
          </main>
        </div>
      </div>

      {/* Owned here rather than by the toolbar: the requirement filter opens it
          too -- straight onto the by-hand pane when it has nothing to run on --
          and routing that through the toolbar meant seven of its props existed
          only to be forwarded here. */}
      <LoadDialog
        open={loadOpen}
        onOpenChange={onLoadOpenChange}
        initialSource={loadSource}
        completed={completed}
        listCount={taskList.list.length}
        lastRsn={prefs.lastRsn}
        onImportApply={applyImport}
        onImportLevels={profile.importLevels}
        onImportFile={handleImportFile}
        onRsnCommit={rememberRsn}
        profile={profile.profile}
        profileIsEmpty={profile.isEmpty}
        onSetLevel={profile.setLevel}
        onSetQuest={profile.setQuest}
        onClearProfile={profile.clear}
      />

      <ShareCodePrompt
        incoming={shareCode.incoming}
        error={shareCode.error}
        completedCount={completed.size}
        listCount={taskList.list.length}
        onAccept={acceptShareCode}
        onDismiss={dismissShareCode}
      />
    </TaskDragProvider>
  );
}
