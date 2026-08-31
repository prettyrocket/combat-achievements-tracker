// The share code: everything portable about this browser, as one URL-safe string.
//
// Export (backup.ts) makes localStorage an acceptable system of record; this
// makes it a *movable* one. A file is the right shape for "keep this safe" and
// the wrong shape for "open my progress on my phone", which is the thing the app
// otherwise cannot do at all without a server it was deliberately built without.
//
// Framework-free and storage-free on purpose: a pure codec over values, so the
// round-trip can be tested exhaustively without a fake localStorage or a DOM.
// Reading and writing the actual stores is the caller's job.
//
// The profile travels too, and unlike the other two halves it travels *lossily*.
// A positional format has to agree on what sits at each position, so this file
// owns two append-only orderings -- SKILL_WIRE_ORDER and QUEST_WIRE_ORDER -- and
// anything not on them cannot be encoded at all. That matters in practice:
// WikiSync reports every quest an account has finished, and only nineteen of
// them gate anything here, so a real profile loses the rest on the way into a
// link. The loss is silent by the time a code is decoded -- the bytes were never
// written -- so it has to be reported at encode time instead, which is what
// profileWireLoss exists for. Export remains the lossless option, and the UI
// says so where someone can still act on it.

import { sanitizeIds } from "@/lib/progress-store";
import {
  EMPTY_PROFILE,
  normalizeQuest,
  profileIsEmpty,
  type PlayerProfile,
} from "@/lib/requirements";

/**
 * Bumped only for a change that breaks old readers.
 *
 * Appending a section does not qualify: decode treats a short code as "the
 * later sections are empty", so a v1 code stays readable after a v2 section
 * exists. This moves when an existing byte changes meaning.
 *
 * v2: the Mad Angel release took the game to 655 tasks, so the bitset grew from
 * 81 bytes to 82 and every byte after it slid one to the right. A v1 code read
 * with this layout would take its length byte for bitset padding, so v1 codes
 * are refused below rather than silently misread.
 */
const VERSION = 2;

/**
 * Ids run 0..654 with no gaps -- asserted in the tests against the real data,
 * because this is the assumption the whole format rests on.
 */
const TASK_COUNT = 655;
const BITSET_BYTES = 32 + 50; // 82; ceil(655 / 8), written so the arithmetic shows

/** Version + bitset + one length byte, before any task list entries. */
const HEADER_BYTES = 1 + BITSET_BYTES + 1;

/**
 * A task list longer than this can't state its length in one byte. It is ~10x
 * the largest plan anyone builds by hand, and truncating is better than a
 * format that can't say what it holds.
 */
const MAX_LIST = 255;

// --- the wire orderings -----------------------------------------------------
//
// Both of these are APPEND-ONLY. Never reorder, never remove, never re-sort:
// position *is* the identity here, so moving an entry silently re-points every
// code already in the wild at the wrong skill or the wrong quest.
//
// This is exactly why they live here rather than being derived. gatedQuests()
// (requirements.ts) sorts by label, which is right for a checklist and fatal for
// a wire format -- adding "Below Ice Mountain" would insert at position 2 and
// shift seventeen quests down one bit each. A display order answers "what should
// this list look like"; a wire order answers "what did byte 3 bit 5 mean in
// 2026", and only one of those is allowed to change.
//
// Tests assert these cover GATED_SKILLS and gatedQuests(), so adding a gate
// fails the build until someone appends here.

/** In-game skill order, which is also where a 24th skill would naturally land. */
const SKILL_WIRE_ORDER = [
  "Attack",
  "Defence",
  "Strength",
  "Hitpoints",
  "Ranged",
  "Prayer",
  "Magic",
  "Cooking",
  "Woodcutting",
  "Fletching",
  "Fishing",
  "Firemaking",
  "Crafting",
  "Smithing",
  "Mining",
  "Herblore",
  "Agility",
  "Thieving",
  "Slayer",
  "Farming",
  "Runecraft",
  "Hunter",
  "Construction",
  // Appended, not inserted -- the whole point of this list. Verified against
  // RuneLite's Skill enum, which is where these strings come from: WikiSync
  // writes `Skill.getName()` for every value, so the payload carries whatever
  // that enum holds. `Runecraft` above is from the same source, and `Overall`
  // is deprecated to null there, so it never appears.
  "Sailing",
] as const;

/** gatedQuests() as it stood when this format was frozen. Append below, never sort. */
const QUEST_WIRE_ORDER = [
  "A Kingdom Divided",
  "Beneath Cursed Sands",
  "Children of the Sun",
  "Desert Treasure II - The Fallen Empire",
  "Dragon Slayer II",
  "Monkey Madness II",
  "Perilous Moons",
  "Priest in Peril",
  "Regicide",
  "Secrets of the North",
  "Sins of the Father",
  "Song of the Elves",
  "The Blood Moon Rises",
  "The Final Dawn",
  "The Fremennik Exiles",
  "The Heart of Darkness",
  "The Ides of Milk",
  "Troubled Tortugans",
  "While Guthix Sleeps",
] as const;

export { SKILL_WIRE_ORDER, QUEST_WIRE_ORDER };

/** Matching profile-store's ceiling, so a level that round-trips there fits here. */
const MAX_LEVEL = 126;

const QUEST_BYTES = Math.ceil(QUEST_WIRE_ORDER.length / 8);

/** Skills are matched case-insensitively; decode emits the spelling above. */
const SKILL_INDEX = new Map(
  SKILL_WIRE_ORDER.map((skill, i) => [skill.toLowerCase(), i]),
);

/** Quests go through normalizeQuest, so an en dash still finds its slot. */
const QUEST_INDEX = new Map(
  QUEST_WIRE_ORDER.map((quest, i) => [normalizeQuest(quest), i]),
);

export interface WireLoss {
  levels: number;
  quests: number;
}

/**
 * What this profile would lose on the way into a link.
 *
 * Reported before the fact rather than after, because after is too late: a code
 * that never carried your 200 finished quests is indistinguishable from one made
 * by someone who hasn't done them. The sender is the only party who still knows,
 * so the sender is who gets told.
 */
export function profileWireLoss(profile: PlayerProfile | null): WireLoss {
  if (profile === null) return { levels: 0, quests: 0 };
  let levels = 0;
  for (const [skill, level] of Object.entries(profile.levels)) {
    if (
      typeof level === "number" &&
      level >= 1 &&
      !SKILL_INDEX.has(skill.toLowerCase())
    )
      levels++;
  }
  let quests = 0;
  for (const quest of profile.quests) {
    if (!QUEST_INDEX.has(normalizeQuest(quest))) quests++;
  }
  return { levels, quests };
}

// --- base64url --------------------------------------------------------------
//
// Plain base64 is not URL-safe: `+` and `/` survive a fragment by luck and not
// by spec, and `=` padding is noise in a string people paste into chat. The
// substitution is the standard one (RFC 4648 §5) and is its own inverse.

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(code: string): Uint8Array {
  const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// --- encode -----------------------------------------------------------------

export interface Shareable {
  completed: Iterable<number>;
  list: readonly number[];
  /** Omitted or empty means the code carries no profile section at all. */
  profile?: PlayerProfile | null;
}

/**
 * The profile section: skill levels, then finished quests.
 *
 *   byte  0        skill count, s
 *   bytes 1..s     level per skill in SKILL_WIRE_ORDER; 0 means "not known"
 *   byte  1+s      quest bitset length in bytes, q
 *   bytes 2+s..    q bytes, bit `i` for QUEST_WIRE_ORDER[i]
 *
 * Both lengths are written rather than assumed, which is what lets the orderings
 * grow. A build with 24 skills reading a 23-skill code knows to stop at 23 and
 * treat Sailing as unknown; a build with 23 reading a 24-skill code knows to skip
 * a byte it can't name rather than reading the quest length out of the middle of
 * the level block. Without the counts, appending to either list would silently
 * shred every older code.
 *
 * One byte per level rather than the seven bits a level needs. Seven-bit packing
 * saves three bytes across all 23 skills -- four characters of URL -- and costs a
 * bit cursor in both directions, which is the same trade the task list already
 * declined.
 */
function encodeProfile(profile: PlayerProfile): Uint8Array {
  const levels = new Uint8Array(SKILL_WIRE_ORDER.length);
  for (const [skill, level] of Object.entries(profile.levels)) {
    const at = SKILL_INDEX.get(skill.toLowerCase());
    // Not on the wire ordering: it cannot travel. profileWireLoss counts these
    // for the sender, which is the only place the fact is still knowable.
    if (at === undefined) continue;
    if (typeof level !== "number" || !Number.isFinite(level) || level < 1)
      continue;
    levels[at] = Math.min(Math.floor(level), MAX_LEVEL);
  }

  const quests = new Uint8Array(QUEST_BYTES);
  for (const quest of profile.quests) {
    const at = QUEST_INDEX.get(normalizeQuest(quest));
    if (at === undefined) continue;
    quests[at >> 3] |= 1 << (at & 7);
  }

  const out = new Uint8Array(1 + levels.length + 1 + quests.length);
  out[0] = levels.length;
  out.set(levels, 1);
  out[1 + levels.length] = quests.length;
  out.set(quests, 2 + levels.length);
  return out;
}

/**
 * Layout, v2:
 *
 *   byte  0        version
 *   bytes 1..82    completion bitset, bit `id` for task `id`
 *   byte  83       task list length, n
 *   bytes 84..     n ids, two bytes each, big-endian, in list order
 *   bytes ..       the profile section above, when there is a profile
 *
 * Completions are positional because they are a set over a fixed universe: the
 * cost is 82 bytes whether one task is done or all 655, which beats a list of
 * ids as soon as ~40 are complete and never gets worse. The task list is *not*
 * a set -- its order is the whole point -- so it pays for ids by value.
 *
 * Two bytes per id rather than the 10 bits an id actually needs. The packing
 * would save 19 bytes on a 25-task list, which is 25 characters of URL nobody
 * will ever notice, in exchange for a bit-cursor to get wrong in both
 * directions. Byte-aligned stays legible in a hex dump.
 *
 * The profile section is omitted entirely for an empty profile rather than
 * written as zeroes. It keeps a code from someone who never entered their levels
 * byte-identical to one made before this section existed, which is the cheapest
 * possible proof that appending it broke nothing.
 */
export function encodeShareCode({
  completed,
  list,
  profile,
}: Shareable): string {
  const trimmed = list.slice(0, MAX_LIST);
  const tail =
    profile && !profileIsEmpty(profile) ? encodeProfile(profile) : null;
  const bytes = new Uint8Array(
    HEADER_BYTES + trimmed.length * 2 + (tail?.length ?? 0),
  );

  bytes[0] = VERSION;
  for (const id of completed) {
    // Guard rather than trust: an id outside the universe would corrupt a
    // neighbouring task's bit, or silently write past the bitset into the
    // length byte. Dropping it matches what sanitizeIds does on the way in.
    if (!Number.isInteger(id) || id < 0 || id >= TASK_COUNT) continue;
    bytes[1 + (id >> 3)] |= 1 << (id & 7);
  }

  bytes[1 + BITSET_BYTES] = trimmed.length;
  trimmed.forEach((id, i) => {
    const at = HEADER_BYTES + i * 2;
    bytes[at] = (id >> 8) & 0xff;
    bytes[at + 1] = id & 0xff;
  });

  if (tail) bytes.set(tail, HEADER_BYTES + trimmed.length * 2);

  return toBase64Url(bytes);
}

// --- decode -----------------------------------------------------------------

export interface ShareCodeResult {
  completed: number[];
  list: number[];
  /** Ids the code named that this build doesn't know -- retired, or from a newer release. */
  dropped: number;
  /** Levels and quests the code carried. Empty when it carried no profile section. */
  profile: PlayerProfile;
  /**
   * Entries the section held at positions this build can't name -- a code from a
   * newer release with a skill or quest appended since. Not the same thing as
   * profileWireLoss, which is what never made it into the code in the first place.
   */
  profileDropped: WireLoss;
}

/**
 * Reads the profile section, or reports its absence.
 *
 * An absent section is a normal, expected outcome -- every code made before this
 * existed, and every code from someone who never entered their levels -- so it
 * returns an empty profile rather than throwing. A section that is *present but
 * truncated* is a different thing, and throws like any other cut-off code.
 */
function decodeProfile(
  bytes: Uint8Array,
  at: number,
): { profile: PlayerProfile; dropped: WireLoss } {
  const absent = { profile: EMPTY_PROFILE, dropped: { levels: 0, quests: 0 } };
  if (at >= bytes.length) return absent;

  const skillCount = bytes[at];
  // The count byte, the levels, and the quest-length byte all have to be there.
  if (at + 1 + skillCount + 1 > bytes.length) {
    throw new Error(
      "That share code is incomplete -- it may have been cut off when copied.",
    );
  }

  const levels: Record<string, number> = {};
  let droppedLevels = 0;
  for (let i = 0; i < skillCount; i++) {
    const level = bytes[at + 1 + i];
    if (level === 0) continue;
    const skill = SKILL_WIRE_ORDER[i];
    // Past the end of our ordering: a skill appended after this build shipped.
    if (skill === undefined) {
      droppedLevels++;
      continue;
    }
    levels[skill] = Math.min(level, MAX_LEVEL);
  }

  const questAt = at + 1 + skillCount;
  const questBytes = bytes[questAt];
  if (questAt + 1 + questBytes > bytes.length) {
    throw new Error(
      "That share code is incomplete -- it may have been cut off when copied.",
    );
  }

  const quests: string[] = [];
  let droppedQuests = 0;
  for (let i = 0; i < questBytes * 8; i++) {
    if (!(bytes[questAt + 1 + (i >> 3)] & (1 << (i & 7)))) continue;
    const quest = QUEST_WIRE_ORDER[i];
    if (quest === undefined) {
      droppedQuests++;
      continue;
    }
    quests.push(quest);
  }

  return {
    profile: { levels, quests },
    dropped: { levels: droppedLevels, quests: droppedQuests },
  };
}

/**
 * Throws, with a message fit for showing the user, on anything that isn't one
 * of our codes -- matching importProgress, because a pasted code and a chosen
 * file fail for the same reasons and should read the same way.
 *
 * Everything that survives the shape checks still goes through sanitizeIds, so
 * there is exactly one answer in the codebase to "is this a real task id".
 */
export function decodeShareCode(code: string): ShareCodeResult {
  const trimmed = code.trim();
  if (trimmed === "") throw new Error("That share code is empty.");

  // Checked before atob rather than relying on it to throw: atob quietly
  // ignores whitespace, so "hello there" decodes to seven junk bytes and would
  // otherwise be reported as a code that got cut off when copied -- which sends
  // the reader off looking for the missing half of something that was never a
  // code at all.
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new Error("That doesn't look like a share code.");
  }

  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(trimmed);
  } catch {
    throw new Error("That doesn't look like a share code.");
  }

  // Version before length, because how long a code *should* be depends on which
  // format it is. A complete v1 code is 83 bytes and this build's header is 84,
  // so checking length first tells someone their intact code was cut off when
  // copied -- sending them to re-copy a code that will never work.
  if (bytes.length === 0) {
    throw new Error(
      "That share code is incomplete -- it may have been cut off when copied.",
    );
  }
  if (bytes[0] !== VERSION) {
    throw new Error(
      `That share code was made by a different version of this app (format ${bytes[0]}, this build reads ${VERSION}).`,
    );
  }
  if (bytes.length < HEADER_BYTES) {
    throw new Error(
      "That share code is incomplete -- it may have been cut off when copied.",
    );
  }

  // Loop to TASK_COUNT, not to the end of the bitset: bit 655 is padding in the
  // last byte and means nothing.
  const rawCompleted: number[] = [];
  for (let id = 0; id < TASK_COUNT; id++) {
    if (bytes[1 + (id >> 3)] & (1 << (id & 7))) rawCompleted.push(id);
  }

  const listLength = bytes[1 + BITSET_BYTES];
  const expected = HEADER_BYTES + listLength * 2;
  if (bytes.length < expected) {
    throw new Error(
      "That share code is incomplete -- it may have been cut off when copied.",
    );
  }

  const rawList: number[] = [];
  for (let i = 0; i < listLength; i++) {
    const at = HEADER_BYTES + i * 2;
    rawList.push((bytes[at] << 8) | bytes[at + 1]);
  }

  const { profile, dropped: profileDropped } = decodeProfile(bytes, expected);

  const completed = sanitizeIds(rawCompleted);
  const list = sanitizeIds(rawList);
  return {
    completed: completed.ids,
    list: list.ids,
    dropped: completed.dropped + list.dropped,
    profile,
    profileDropped,
  };
}

// --- the URL ----------------------------------------------------------------
//
// The fragment, not the query string. Two reasons, and the first is the one
// that matters: a fragment is never sent in the HTTP request, so a link to
// someone's account progress stays out of server logs, proxy logs and Referer
// headers on a host we don't control. The second is that use-task-query owns
// the search half and preserves the hash, so the two never fight.

const SHARE_KEY = "s";

/**
 * The link, deliberately without the current filters.
 *
 * A share code is about what you've done, not what you were looking at when you
 * copied it -- carrying the query string too would mean the recipient opens your
 * progress filtered to whatever boss you happened to be reading about.
 */
export function buildShareUrl(
  shareable: Shareable,
  location: Location,
): string {
  return `${location.origin}${location.pathname}#${SHARE_KEY}=${encodeShareCode(shareable)}`;
}

/** The share code in a URL fragment, or null when there isn't one. */
export function readShareCode(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  return new URLSearchParams(hash.slice(1)).get(SHARE_KEY);
}

/**
 * Drops the code from the address bar without adding a history entry.
 *
 * Called once the code has been dealt with, accepted or not: leaving it there
 * means a reload re-asks a question already answered, and -- worse -- that a
 * later reload could offer to overwrite progress made since.
 */
export function clearShareCode(): void {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}
