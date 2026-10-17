// The layout, and the wiring between the stores and the things that draw them.
//
// Everything that used to make this file long has a home of its own now: the
// localStorage furniture in use-ui-prefs, the arriving share code in
// use-share-code, the pivot in use-monster-filter, the drag mechanics in
// task-drag-provider. What's left is which component gets what, which is the one
// thing an App file should be for.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks, Table2, UserRound } from "lucide-react";
import { TASKS } from "@/data/tasks";
import { TaskTable } from "@/components/task-table";
import { ProgressToolbar } from "@/components/toolbar";
import { LoadDialog } from "@/components/load-dialog";
import { ManualDialog } from "@/components/load/manual-dialog";
import { LoadIcon } from "@/components/toolbar/load-icon";
import { FilterBar } from "@/components/filter-bar";
import { MonsterBreadcrumb } from "@/components/monster-breadcrumb";
import { ShareCodePrompt } from "@/components/share-code-prompt";
import { Toast } from "@/components/toast";
import { WelcomeDialog } from "@/components/welcome-dialog";
import { TaskDragProvider } from "@/components/task-drag-provider";
import { PlanOverlay } from "@/components/plan-overlay";
import { TaskListPanel } from "@/components/tasklist-panel";
import { ListView } from "@/components/list-view";
import { ProfileView } from "@/components/profile-view";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import {
  dropCompleted,
  gatherByMonster,
  moveTrip,
  moveTripTo,
  resolve,
} from "@/lib/tasklist";
import { DEFAULT_SORT, applyQuery } from "@/lib/task-query";
import { useMonsterFilter } from "@/lib/use-monster-filter";
import { useProfile } from "@/lib/use-profile";
import { isSideDocked, type ListPosition } from "@/lib/list-position";
import {
  readStoredSource,
  type AccountSource,
  type LoadSourceId,
} from "@/lib/load-source";
import { quickLoadFor } from "@/lib/quick-load";
import { useQuickLoad } from "@/lib/use-quick-load";
import { useProgress } from "@/lib/use-progress";
import { useShareCode } from "@/lib/use-share-code";
import { useSyncStatus } from "@/lib/use-sync-status";
import { useTaskList } from "@/lib/use-tasklist";
import { useTaskQuery } from "@/lib/use-task-query";
import { useUiPrefs } from "@/lib/use-ui-prefs";
import { useView } from "@/lib/use-view";
import { markWelcomed, shouldWelcome } from "@/lib/welcome";
import type { View } from "@/lib/view";

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
    undo: undoProgress,
    storageError,
  } = useProgress();
  const { query, setQuery, clear } = useTaskQuery();
  const { view, setView } = useView();
  const taskList = useTaskList();
  const profile = useProfile();
  // Pulled out because it's the one part of `profile` that is stable across
  // renders, which is what the import callback below wants to depend on.
  const { setProfile } = profile;

  // Takes the source because one pref is defaulted from it: manual tracking is
  // on unless an account is already keeping the answers.
  const prefs = useUiPrefs(progressSource);
  const shareCode = useShareCode();
  // Written from every door below that lands progress, and left alone by
  // Reset: Reset clears what you've done, not how it gets here -- the
  // remembered source and name survive it too, so the header's Load still
  // knows where to go, and the date of the last pull is still true.
  const { record: recordSync } = useSyncStatus();
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

  // The plan at full size. Not in the URL with the rest of the view state: it is
  // a place you stand for a minute, not an arrangement of the table worth
  // sending to somebody.
  const [planOpen, setPlanOpen] = useState(false);

  // Lives here rather than in the toolbar because a file import finishes after
  // its dialog has closed: the message describes three stores at once and is
  // worth reading once the thing that produced it has gone.
  const [notice, setNotice] = useState<Notice | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  // The levels form on its own -- from the requirement filter as well as from
  // Load. The full dialog with every source is Profile's alone.
  const [manualOpen, setManualOpen] = useState(false);
  const openProfileEditor = useCallback(() => setManualOpen(true), []);

  const openLoad = useCallback(() => setLoadOpen(true), []);

  // Read once, on arrival -- see welcome.ts for what counts as a first visit.
  const [welcomeOpen, setWelcomeOpen] = useState(shouldWelcome);
  // Skipping points at Profile, where Load lives for good, rather than only
  // saying so.
  const [pointAtProfile, setPointAtProfile] = useState(false);

  const pickWelcome = useCallback((source: LoadSourceId) => {
    markWelcomed();
    setWelcomeOpen(false);
    setLoadSource(source);
    setLoadOpen(true);
  }, []);

  const skipWelcome = useCallback(() => {
    markWelcomed();
    setWelcomeOpen(false);
    if (view !== "table") setView("table");
    setPointAtProfile(true);
    setNotice({
      tone: "ok",
      message: "You can sync your progress any time from Profile.",
      action: { label: "Go to Profile", onClick: () => setView("profile") },
    });
  }, [view, setView]);

  // As long as the toast that names it, and not a moment after you've gone.
  useEffect(() => {
    if (!pointAtProfile) return;
    if (view === "profile") {
      setPointAtProfile(false);
      return;
    }
    const timer = window.setTimeout(() => setPointAtProfile(false), 10000);
    return () => window.clearTimeout(timer);
  }, [pointAtProfile, view]);

  // How you last loaded, which decides what the header's Load does. Read again
  // whenever the dialog closes, since that's where it gets written.
  const [lastLoadedFrom, setLastLoadedFrom] = useState(readStoredSource);

  const onLoadOpenChange = useCallback((open: boolean) => {
    setLoadOpen(open);
    // Cleared on close so the next plain Load click gets the remembered source
    // rather than being pinned to wherever the filter last sent you.
    if (!open) {
      setLoadSource(null);
      setLastLoadedFrom(readStoredSource());
    }
  }, []);

  const goToProfile = useCallback(() => setView("profile"), [setView]);
  const quickLoadKind = quickLoadFor(lastLoadedFrom, prefs.lastRsn);
  const quickLoad = useQuickLoad({
    kind: quickLoadKind,
    rsn: prefs.lastRsn,
    completed,
    profile: profile.profile,
    setMany,
    setProfile,
    importLevels: profile.importLevels,
    undoProgress,
    undoProfile: profile.undo,
    onNotice: setNotice,
    goToProfile,
    onSynced: recordSync,
  });

  const { sync } = quickLoad;
  const onHeaderLoad = useCallback(() => {
    if (quickLoadKind === "manual") setManualOpen(true);
    else if (quickLoadKind === "setup") goToProfile();
    else void sync();
  }, [quickLoadKind, goToProfile, sync]);

  /**
   * Rethrows rather than swallowing: the file pane shows the failure beside its
   * own button, where the person who picked the file is looking. Only a success
   * reaches the notice line, because that message describes three stores at once
   * and is worth reading after the dialog has gone.
   */
  const handleImportFile = useCallback(
    async (file: File) => {
      const result = importBackup(await file.text());
      // No date of its own worth claiming: the file says when it was exported,
      // not when any of it was last true in the game.
      recordSync("file", null);
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
    },
    [recordSync],
  );

  const importLevels = profile.importLevels;
  const applyLevels = useCallback(
    (levels: Record<string, number>, updatedAt: Date | null) => {
      importLevels(levels);
      recordSync("wiseoldman", updatedAt);
    },
    [importLevels, recordSync],
  );

  // The form edited from the header's Load counts as a sync only for somebody
  // whose way in is Manual. The requirement filter opens the same form, and
  // nudging a level there while RuneProfile keeps the rest doesn't change how
  // you sync.
  const onManualDialogLanded = useCallback(() => {
    if (readStoredSource() === "manual") recordSync("manual", null);
  }, [recordSync]);
  const onLoadManualLanded = useCallback(
    () => recordSync("manual", null),
    [recordSync],
  );

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

  // A one-press reorder, committed like any other: the plan it hands back is an
  // ordinary plan, and dragging out of a run it just made is allowed.
  const gatherPlan = useCallback(
    () => taskList.replace(gatherByMonster(taskList.list, TASKS)),
    [taskList],
  );

  const clearCompletedFromPlan = useCallback(
    () => taskList.replace(dropCompleted(taskList.list, completed)),
    [taskList, completed],
  );

  // A whole trip at once. By id rather than by monster: a plan can visit one
  // boss twice, and this is one of those visits.
  const removeFromPlan = useCallback(
    (wikiIds: readonly number[]) => {
      const gone = new Set(wikiIds);
      taskList.replace(taskList.list.filter((id) => !gone.has(id)));
    },
    [taskList],
  );

  const moveTripToInPlan = useCallback(
    (anchor: number, to: number) =>
      taskList.replace(moveTripTo(taskList.list, TASKS, anchor, to)),
    [taskList],
  );

  const moveTripInPlan = useCallback(
    (anchor: number, delta: -1 | 1) =>
      taskList.replace(moveTrip(taskList.list, TASKS, anchor, delta)),
    [taskList],
  );

  const sideDocked = isSideDocked(prefs.listPosition);

  const { rememberRsn } = prefs;

  /**
   * An import replaces progress outright -- the account is the authority on
   * what's done. The planned list is not the account's to overwrite, so it
   * survives unless the import is for a different player and you say so.
   *
   * Shared by every door that carries achievements, so the only thing
   * `source` changes is what the profile editor calls it afterwards.
   */
  const applyImport = useCallback(
    (
      ids: number[],
      rsn: string,
      clearList: boolean,
      imported: PlayerProfile | null,
      source: AccountSource,
      updatedAt: Date | null,
    ) => {
      setMany(ids, source);
      if (clearList) taskList.clear();
      // Only when the import actually carried levels. A payload without them
      // must not wipe a profile the player typed in by hand.
      if (imported) setProfile(imported, source);
      rememberRsn(rsn);
      recordSync(source, updatedAt);
    },
    [setMany, taskList, setProfile, rememberRsn, recordSync],
  );

  const acceptShareCode = useCallback(
    (incoming: ShareCodeResult) => {
      // 'sharecode' rather than 'manual': someone handed you a finished set,
      // which is the same relationship to it that an import has.
      setMany(incoming.completed, "sharecode");
      taskList.replace(incoming.list);
      // Same rule as an imported file (backup.ts): a code without a profile is
      // not an instruction to clear one. 'manual' rather than an import
      // source because from here it is a thing you accepted, and the source only
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
      <div className="mx-auto flex h-dvh max-w-[100rem] flex-col overflow-hidden px-4 py-6 sm:px-6">
        {/* One row at every width: name, screens, actions. The outer columns
            are equal while there's room, which puts the switch at the true
            centre; they never shrink below their contents, so on a narrow
            window it settles between the two instead of overlapping either. */}
        <header className="grid shrink-0 grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-center gap-2 border-b pb-4 sm:gap-4">
          <h1 className="text-xl font-bold lg:text-2xl tracking-tight whitespace-nowrap">
            <span className="hidden min-[680px]:inline">
              Combat Achievements Tracker
            </span>
            <span className="min-[680px]:hidden">CA Tracker</span>
          </h1>
          {/* Radix lets a single group be emptied by clicking the pressed
              item; there is always a screen, so that click is ignored. */}
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-label="View"
            value={view}
            onValueChange={(next) => next && setView(next as View)}
          >
            <ToggleGroupItem
              value="table"
              aria-label="Catalog"
              className="sm:px-3"
            >
              <Table2 />
              <span className="max-sm:hidden">Catalog</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="list"
              aria-label="My list"
              className="sm:px-3"
            >
              <ListChecks />
              <span className="max-sm:hidden">My list</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="profile"
              aria-label="Profile"
              className={`sm:px-3 ${
                pointAtProfile ? "ring-2 ring-sky-400/80 animate-pulse" : ""
              }`}
            >
              <UserRound />
              <span className="max-sm:hidden">Profile</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="justify-self-end">
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
              onLoad={onHeaderLoad}
              loadIcon={<LoadIcon kind={quickLoadKind} />}
              loadBusy={quickLoad.busy}
              onNotice={setNotice}
              manualTracking={prefs.manualTracking}
              onManualTrackingChange={prefs.setManualTracking}
              listPosition={prefs.listPosition}
              onListPositionChange={prefs.setListPosition}
            />
          </div>
        </header>

        {storageError && (
          <p
            role="alert"
            className="mt-4 shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
          >
            {storageError}
          </p>
        )}

        {view === "profile" ? (
          <main className="mt-4 min-h-0 flex-1">
            <ProfileView
              summary={summary}
              rewards={rewards}
              rsn={prefs.lastRsn}
              onLoadOpen={openLoad}
            />
          </main>
        ) : view === "list" ? (
          <main className="mt-3 min-h-0 flex-1">
            <ListView
              entries={entries}
              gates={gates}
              onToggleCompleted={toggle}
              onRemove={taskList.remove}
              onRemoveTrip={removeFromPlan}
              onGather={gatherPlan}
              onMoveTripTo={moveTripToInPlan}
              onClearCompleted={clearCompletedFromPlan}
            />
          </main>
        ) : (
          <>
            <div className="shrink-0">
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
                  gates={gates}
                  onExpand={() => setPlanOpen(true)}
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
          </>
        )}
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
        onImportLevels={applyLevels}
        onImportFile={handleImportFile}
        onRsnCommit={rememberRsn}
        onManualLanded={onLoadManualLanded}
        profile={profile.profile}
        profileIsEmpty={profile.isEmpty}
        onSetLevel={profile.setLevel}
        onSetQuest={profile.setQuest}
        onClearProfile={profile.clear}
      />

      <PlanOverlay
        open={planOpen}
        onOpenChange={setPlanOpen}
        entries={entries}
        gates={gates}
        onToggleCompleted={toggle}
        onRemove={taskList.remove}
        onGather={gatherPlan}
        onMoveTrip={moveTripInPlan}
        onClearCompleted={clearCompletedFromPlan}
      />

      <Toast notice={notice} onDismiss={dismissNotice} />

      <ManualDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        profile={profile.profile}
        profileIsEmpty={profile.isEmpty}
        onSetLevel={profile.setLevel}
        onSetQuest={profile.setQuest}
        onClearProfile={profile.clear}
        onManualLanded={onManualDialogLanded}
      />

      <WelcomeDialog
        open={welcomeOpen}
        onPick={pickWelcome}
        onSkip={skipWelcome}
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
