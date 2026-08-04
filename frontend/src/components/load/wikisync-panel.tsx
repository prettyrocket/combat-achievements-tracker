// The WikiSync paste pane.
//
// Step two used to say you had to open the Combat Achievements interface in-game
// and then log out. That is folklore, and it came from the collection log, which
// genuinely is gated that way -- its slots are filled by a script that only fires
// when the interface opens. Combat Achievements aren't: WikiSyncPlugin reads them
// out of the player varps listed in its server-side manifest and uploads on a
// 10-second @Schedule. Logging in with the plugin running is the whole procedure.
//
// The safety net for having said so is below: a payload with no CA field at all
// gets a message that suggests the old ritual as a fix, rather than the "welcome
// to OSRS" that an account with genuinely zero completions deserves.

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import {
  buildSyncUrl,
  displayRsn,
  parseWikiSync,
  WikiSyncParseError,
  type WikiSyncErrorCode,
  type WikiSyncParse,
} from "@/lib/wikisync";
import { useImportFlow } from "@/lib/use-import-flow";
import type { PlayerProfile } from "@/lib/requirements";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Carries,
  DifferentAccountNotice,
  ImportFooter,
  Steps,
} from "@/components/load/pane-parts";

const PLUGIN_HUB_URL = "https://runelite.net/plugin-hub/show/wikisync";

export interface WikiSyncPanelProps {
  /** Owned by the dialog and shared with the other account-shaped sources. */
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
  /**
   * Close the dialog. `remember` is false when nothing was imported -- a player
   * with no achievements yet shouldn't have this pane pinned as their default
   * on the strength of a lookup that found nothing.
   */
  onFinished: (remember: boolean) => void;
}

export function WikiSyncPanel({
  rsn,
  completed,
  listCount,
  lastRsn,
  onApply,
  onFinished,
}: WikiSyncPanelProps) {
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState("");
  const [parse, setParse] = useState<WikiSyncParse | null>(null);
  const [error, setError] = useState<{
    message: string;
    code: WikiSyncErrorCode;
  } | null>(null);
  // onPaste fires before the onChange for the same edit, so this lets the change
  // handler tell "the user pasted" from "the user is typing" while still reading
  // the field's resulting value rather than the clipboard fragment.
  const pasted = useRef(false);

  const flow = useImportFlow({
    completed,
    listCount,
    lastRsn,
    onApply,
    onApplied: () => onFinished(true),
  });
  const syncUrl = buildSyncUrl(rsn);

  // An account with no achievements isn't a failed import, it's a new player.
  const welcome = error?.code === "NO_CA_LIST" || error?.code === "EMPTY_LIST";

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (syncUrl === null) return;
    try {
      await navigator.clipboard.writeText(syncUrl);
      setCopied(true);
    } catch {
      // Clipboard access needs a secure context and can be refused outright.
      // The URL is on screen and selectable, so this isn't worth an error state.
      setCopied(false);
    }
  }

  function runPreview(value: string) {
    if (value.trim() === "") {
      setParse(null);
      setError(null);
      flow.clear();
      return;
    }
    setError(null);
    try {
      const read = parseWikiSync(value);
      setParse(read);
      flow.read(read);
    } catch (err) {
      setParse(null);
      flow.clear();
      setError(
        err instanceof WikiSyncParseError
          ? { message: err.message, code: err.code }
          : { message: "Could not read that paste.", code: "NOT_JSON" },
      );
    }
  }

  function footerStatus(): {
    status: React.ReactNode;
    tone: string;
    alert: boolean;
  } {
    if (welcome) {
      // No CA field at all is likelier to be a sync that hasn't landed than a
      // player who has done nothing -- an account with genuinely zero of them
      // still reports the field, empty. So this one gets the ritual as a
      // suggestion, which is the only place it's still worth mentioning.
      if (error?.code === "NO_CA_LIST") {
        return {
          status:
            "That paste carries no Combat Achievements at all. If you have some, open the Combat Achievements interface in-game, give it a few seconds, and fetch the URL again.",
          tone: "text-amber-400",
          alert: false,
        };
      }
      const name = displayRsn(rsn);
      return {
        status: `No achievements to load. Welcome to OSRS${name === "" ? "" : `, ${name}`}! 🎉`,
        tone: "text-emerald-400",
        alert: false,
      };
    }
    if (error)
      return { status: error.message, tone: "text-red-400", alert: true };
    const text = flow.status(rsn);
    return {
      status: text,
      tone:
        flow.diff === null
          ? ""
          : flow.variant(rsn) === "default"
            ? "text-emerald-400"
            : "text-foreground",
      alert: false,
    };
  }

  const footer = footerStatus();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <p className="text-muted-foreground text-sm">
          Lookup combat achievements, skill levels and quests on{" "}
          <a
            href="https://oldschool.runescape.wiki/w/RuneScape:WikiSync"
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground font-medium underline underline-offset-2"
          >
            WikiSync
          </a>
          .
        </p>

        <Steps>
          <li>
            Install the{" "}
            <a
              href={PLUGIN_HUB_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground font-medium underline underline-offset-2"
            >
              WikiSync plugin
            </a>{" "}
            from the RuneLite Plugin Hub.
          </li>
          <li>
            Log in via Runelite and{" "}
            <span className="text-foreground font-medium">
              wait about ten seconds
            </span>
            .
          </li>
          <li>Open the URL below and copy everything it gives you.</li>
        </Steps>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code
              className="bg-muted text-muted-foreground min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs"
              title={syncUrl ?? undefined}
            >
              {syncUrl ?? "sync.runescape.wiki/runelite/player/…/STANDARD"}
            </code>
            <Button
              variant="outline"
              size="sm"
              disabled={syncUrl === null}
              onClick={handleCopy}
              aria-label="Copy sync URL"
            >
              {copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={syncUrl === null}
            >
              {/* A normal link, so it's a top-level navigation -- that's what
                  sends no Origin header and makes this work at all. */}
              <a
                href={syncUrl ?? "#"}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Open sync URL in a new tab"
                aria-disabled={syncUrl === null}
                onClick={(event) => {
                  if (syncUrl === null) event.preventDefault();
                }}
              >
                <ExternalLink className="size-4" aria-hidden />
                Open
              </a>
            </Button>
          </div>
        </div>

        <Textarea
          value={text}
          onPaste={() => {
            pasted.current = true;
          }}
          onChange={(event) => {
            const value = event.target.value;
            setText(value);
            if (pasted.current) {
              pasted.current = false;
              runPreview(value);
              return;
            }
            // Mid-edit. Drop the old reading rather than judging a half-typed
            // payload -- nobody needs "that doesn't look like JSON" while
            // they're still writing it. Blur picks it up when they're done.
            setError(null);
            flow.clear();
          }}
          onBlur={() => runPreview(text)}
          placeholder='{"combat_achievements":[0,16,27, …]}'
          className="h-28 font-mono text-xs"
          aria-label="WikiSync JSON"
        />

        {/* The other half of the payload, mentioned because it is not what this
            pane advertises and arriving silently would be a surprise. Also a
            diagnostic: the quest count is joined by name against the gate table,
            so "0 of 19" is how you find out WikiSync started spelling quests
            differently, rather than by wondering why nothing is locked. */}
        {parse?.profile && <Carries name={displayRsn(rsn)} quests />}

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
        label={
          welcome
            ? error?.code === "NO_CA_LIST"
              ? "Close"
              : "LFG"
            : flow.label(rsn)
        }
        disabled={!welcome && flow.disabled(rsn)}
        variant={
          welcome
            ? error?.code === "NO_CA_LIST"
              ? "default"
              : "success"
            : flow.variant(rsn)
        }
        onApply={() => {
          if (welcome) {
            onFinished(false);
            return;
          }
          if (parse) flow.apply(rsn, parse);
        }}
      />
    </div>
  );
}
