// The RuneProfile lookup pane.
//
// The same three facts the paste carries, fetched instead of copied. What it
// buys over WikiSync is only the paste itself, and it costs a plugin far fewer
// people have, which is why it sits second in the rail rather than first.
//
// The failure that gets the most room is the one that isn't a failure on the
// wire: a profile predating RuneProfile's per-task storage answers 200 with
// every task incomplete. lib/runeprofile.ts turns that into STALE_PROFILE, and
// it gets amber and a fix rather than red and a shrug, because the alternative
// is telling a maxed account it has done nothing.

import { useEffect, useRef, useState } from "react";
import {
  fetchRuneProfile,
  RUNEPROFILE_PLUGIN_URL,
  RUNEPROFILE_URL,
  RuneProfileError,
  syncedLabel,
  type RuneProfileImport,
} from "@/lib/runeprofile";
import { useImportFlow } from "@/lib/use-import-flow";
import {
  gatedQuests,
  normalizeQuest,
  type PlayerProfile,
} from "@/lib/requirements";
import {
  DifferentAccountNotice,
  ImportFooter,
  LookUpButton,
  Steps,
} from "@/components/load/pane-parts";

const GATE_QUESTS = gatedQuests().map(normalizeQuest);

function countGateQuests(profile: PlayerProfile): number {
  const finished = new Set(profile.quests.map(normalizeQuest));
  return GATE_QUESTS.filter((quest) => finished.has(quest)).length;
}

export interface RuneProfilePanelProps {
  /** Owned by the dialog: who this browser is tracking, not this pane's input. */
  rsn: string;
  completed: ReadonlySet<number>;
  listCount: number;
  lastRsn: string | null;
  onApply: (
    ids: number[],
    rsn: string,
    clearList: boolean,
    profile: PlayerProfile | null,
  ) => void;
  onFinished: (remember: boolean) => void;
}

export function RuneProfilePanel({
  rsn,
  completed,
  listCount,
  lastRsn,
  onApply,
  onFinished,
}: RuneProfilePanelProps) {
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<RuneProfileImport | null>(null);
  const [error, setError] = useState<{ message: string; code: string } | null>(
    null,
  );
  const inFlight = useRef<AbortController | null>(null);

  const flow = useImportFlow({
    completed,
    listCount,
    lastRsn,
    onApply,
    onApplied: () => onFinished(true),
  });

  // A lookup outlives the pane otherwise, and resolves against a component that
  // isn't mounted any more the moment somebody searches and switches source.
  useEffect(() => () => inFlight.current?.abort(), []);

  // Editing the name invalidates whatever the last one found, including an
  // armed destructive apply. Runs on mount too, which costs nothing. Pulled off
  // `flow` into a binding first: the hook's return value is a fresh object each
  // render, but `clear` itself is stable, and a dependency on the whole object
  // would re-run this on every keystroke in the paste box.
  const clearFlow = flow.clear;
  useEffect(() => {
    setFound(null);
    setError(null);
    clearFlow();
  }, [rsn, clearFlow]);

  async function run() {
    if (busy || rsn.trim() === "") return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setBusy(true);
    setError(null);
    setFound(null);
    flow.clear();
    try {
      const imported = await fetchRuneProfile(rsn, controller.signal);
      setFound(imported);
      flow.read(imported);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        err instanceof RuneProfileError
          ? { message: err.message, code: err.code }
          : {
              message: "That lookup failed. Try again in a moment.",
              code: "BAD_RESPONSE",
            },
      );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const synced = found === null ? null : syncedLabel(found.updatedAt);

  const footer = error
    ? {
        // Stale gets amber and a fix, not red and a dead end -- the account is
        // fine, it just hasn't spoken to RuneProfile since they started storing
        // this.
        status: error.message,
        tone:
          error.code === "STALE_PROFILE" ? "text-amber-400" : "text-red-400",
        alert: error.code !== "STALE_PROFILE",
      }
    : {
        status: flow.status(rsn),
        tone:
          flow.diff === null
            ? ""
            : flow.variant(rsn) === "default"
              ? "text-emerald-400"
              : "text-foreground",
        alert: false,
      };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <p className="text-muted-foreground text-sm">
          Lookup combat achievements, skill levels and quests on{" "}
          <a
            href={RUNEPROFILE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground font-medium underline underline-offset-2"
          >
            RuneProfile
          </a>
          .
        </p>

        <Steps>
          <li>
            Install the{" "}
            <a
              href={RUNEPROFILE_PLUGIN_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground font-medium underline underline-offset-2"
            >
              RuneProfile plugin
            </a>{" "}
            from the RuneLite Plugin Hub.
          </li>
          <li>Log in via Runelite.</li>
          <LookUpButton
            busy={busy}
            disabled={rsn.trim() === ""}
            onClick={() => void run()}
          />
        </Steps>

        {/* What arrived, and how old it is. The date is not decoration: only the
            player can refresh a RuneProfile, so somebody importing a month-old
            snapshot needs to know before they trust the numbers. */}
        {found && (
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-medium">{found.displayName}</span>
              {found.accountType !== null &&
                found.accountType !== "regular" && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {found.accountType}
                  </span>
                )}
              {synced !== null && (
                <span className="text-muted-foreground"> · {synced}</span>
              )}
            </p>
            <p className="text-muted-foreground text-xs leading-snug">
              Carries{" "}
              <span className="text-foreground">
                {found.ids.length} completed task
                {found.ids.length === 1 ? "" : "s"}
              </span>
              {found.profile && (
                <>
                  ,{" "}
                  <span className="text-foreground">
                    {Object.keys(found.profile.levels).length} skill levels
                  </span>{" "}
                  and{" "}
                  <span className="text-foreground">
                    {countGateQuests(found.profile)} of {GATE_QUESTS.length}{" "}
                    quests
                  </span>{" "}
                  that gate a boss
                </>
              )}
              .
            </p>
          </div>
        )}

        {flow.differentAccount(rsn) && (
          <DifferentAccountNotice
            listCount={listCount}
            lastRsn={lastRsn}
            clearList={flow.clearList}
            onChange={flow.setClearList}
          />
        )}
      </div>

      <ImportFooter
        status={footer.status}
        tone={footer.tone}
        alert={footer.alert}
        label={flow.label(rsn)}
        disabled={flow.disabled(rsn)}
        variant={flow.variant(rsn)}
        onApply={() => {
          if (found) flow.apply(found.displayName, found);
        }}
      />
    </div>
  );
}
