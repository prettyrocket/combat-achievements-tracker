// What it takes to stand in front of a monster at all.
//
// The table below is the one hand-written data set in the app, and it exists
// because the wiki has no machine-readable answer to "what do I need to fight
// this". `bucket('infobox_monster')` does carry `slayer_level`, and that half is
// verified against it on every refresh (`npm run check-requirements`) rather
// than trusted -- but nothing in any bucket maps a monster to the quest that
// unlocks the door in front of it. `bucket('quest')` has a `requirements` field
// and it is free-form wikitext. So: curated, cited, and checked.
//
// Three kinds of gate are modelled, and they are the three you can either meet
// or not meet:
//
//   1. Slayer level, which stops you damaging the monster at all.
//   2. Other skill levels that gate the *route* -- 70 Ranged for the grapple
//      into Armadyl's Eyrie, 50 Firemaking for Wintertodt.
//   3. Quest completion, which is how most bosses are locked.
//
// Four kinds are deliberately *not* modelled, because treating them as
// requirements would grey out rows you can go and do tonight:
//
//   - Consumable keys and totems (Skotizo's dark totem, Obor's giant key,
//     Bryophyta's mossy key). You don't "have" 85 dark totems; you go and get
//     one. That's the task, not a barrier to it.
//   - Kill count (40 followers for a God Wars chamber, one normal Theatre of
//     Blood clear before Hard Mode). Time, not capability.
//   - Callisto, Venenatis and Vet'ion's "medium Wilderness diary *or* a boss
//     Slayer task for that boss". A real gate, but one with a second door that
//     the app has no way to know is open.
//   - Anything unverified. TzKal-Zuk, The Mimic, Royal Titans and the Dagannoth
//     Kings are left ungated rather than guessed at: a wrong gate hides tasks,
//     and a missing one only fails to hide them.
//
// Quests are named exactly as the game names them, which is also their wiki page
// title -- checked against `bucket('quest')`. That matters more than it looks:
// these strings are joined against the `quests` map in a WikiSync paste, and a
// near-miss ("Desert Treasure II") would read as "not done" forever rather than
// as an error.

// Relative, not `@/lib/types`: check-requirements.ts loads this module in bare
// Node to verify the Slayer half against the wiki, and Node doesn't read the
// alias out of tsconfig. types.ts imports nothing, so the graph stops here.
import type { TaskRow } from "./types.ts";

/**
 * The skills any gate actually asks for.
 *
 * Not all 23: this list drives the manual profile form, and asking someone for
 * their Cooking level to filter a Combat Achievement table would be silly. It is
 * derived-by-hand from the table below, and check-requirements asserts the two
 * agree -- add a gate on a new skill and the script says so.
 */
export const GATED_SKILLS = [
  "Slayer",
  "Hitpoints",
  "Ranged",
  "Strength",
  "Agility",
  "Mining",
  "Smithing",
  "Farming",
  "Firemaking",
  "Fishing",
] as const;
export type GatedSkill = (typeof GATED_SKILLS)[number];

export interface MonsterGate {
  /** Levels that must be met. Unboostable in the cases that matter (Slayer). */
  readonly skills?: Readonly<Partial<Record<GatedSkill, number>>>;
  /** Quests that must be finished, by their full in-game name. */
  readonly quests?: readonly string[];
}

// Morytania is behind one quest, and four separate entries need it. Named once
// so they can't drift apart.
const MORYTANIA = "Priest in Peril";
const SOTE = "Song of the Elves";
const DT2 = "Desert Treasure II - The Fallen Empire";
const VARLAMORE = "Children of the Sun";

/**
 * Keyed by the wiki's own monster name, exactly as it arrives in `tasks.json`.
 * check-requirements fails on a key that matches no monster, so a rename in a
 * future release surfaces as an error rather than as a gate that silently stops
 * applying.
 *
 * A monster with no entry has no *modelled* gate -- see the header for what that
 * deliberately excludes.
 */
const GATES: Readonly<Record<string, MonsterGate>> = {
  // --- Slayer, and only Slayer -----------------------------------------------
  "Aberrant Spectre": { skills: { Slayer: 60 } },
  "Abyssal Sire": { skills: { Slayer: 85 } },
  "Alchemical Hydra": { skills: { Slayer: 95 } },
  Bloodveld: { skills: { Slayer: 50 } },
  "Brutal Black Dragon": { skills: { Slayer: 77 } },
  Cerberus: { skills: { Slayer: 91 } },
  Gargoyle: { skills: { Slayer: 75 } },
  // The wiki files this one under Dusk and Dawn, which is why the check script
  // needs an alias to verify it -- the roof itself is behind a brittle key from
  // a 75 Slayer gargoyle task.
  "Grotesque Guardians": { skills: { Slayer: 75 } },
  Kraken: { skills: { Slayer: 87 } },
  Kurask: { skills: { Slayer: 70 } },
  "Skeletal Wyvern": { skills: { Slayer: 72 } },
  "Thermonuclear Smoke Devil": { skills: { Slayer: 93 } },
  Wyrm: { skills: { Slayer: 62 } },

  // --- Slayer plus a quest ---------------------------------------------------
  Amoxliatl: { skills: { Slayer: 48 }, quests: ["The Heart of Darkness"] },
  Araxxor: { skills: { Slayer: 92 }, quests: [MORYTANIA] },
  "Basilisk Knight": {
    skills: { Slayer: 60 },
    quests: ["The Fremennik Exiles"],
  },
  "Shellbane gryphon": {
    skills: { Slayer: 51 },
    quests: ["Troubled Tortugans"],
  },

  // --- Skill levels that gate the route, not the monster ---------------------
  //
  // The God Wars quartet is the clearest case in the game of a requirement that
  // has nothing to do with the fight: each fortress door asks for one level 70,
  // and none of them can be boosted.
  "Commander Zilyana": { skills: { Agility: 70 } },
  "General Graardor": { skills: { Strength: 70 } },
  "K'ril Tsutsaroth": { skills: { Hitpoints: 70 } },
  "Kree'arra": { skills: { Ranged: 70 } },
  // Nex is behind the whole set at once -- the Ancient Prison is reached through
  // the dungeon, so it inherits every door.
  Nex: { skills: { Hitpoints: 70, Ranged: 70, Strength: 70, Agility: 70 } },
  Hespori: { skills: { Farming: 65 } },
  Tempoross: { skills: { Fishing: 35 } },
  Wintertodt: { skills: { Firemaking: 50 } },
  Zalcano: { skills: { Mining: 70, Smithing: 70 }, quests: [SOTE] },

  // --- Quest-locked ----------------------------------------------------------
  Barrows: { quests: [MORYTANIA] },
  Brutus: { quests: ["The Ides of Milk"] },
  "Corrupted Hunllef": { quests: [SOTE] },
  "Crystalline Hunllef": { quests: [SOTE] },
  "Demonic Gorilla": { quests: ["Monkey Madness II"] },
  "Doom of Mokhaiotl": { quests: ["The Final Dawn"] },
  "Duke Sucellus": { quests: [DT2] },
  "Fortis Colosseum": { quests: [VARLAMORE] },
  "Fragment of Seren": { quests: [SOTE] },
  Galvek: { quests: ["Dragon Slayer II"] },
  Glough: { quests: ["Monkey Madness II"] },
  Leviathan: { quests: [DT2] },
  "Maggot King": { quests: ["The Blood Moon Rises"] },
  "Moons of Peril": { quests: ["Perilous Moons"] },
  "Phantom Muspah": { quests: ["Secrets of the North"] },
  "Phosani's Nightmare": { quests: ["Sins of the Father"] },
  "The Hueycoatl": { quests: [VARLAMORE] },
  "The Nightmare": { quests: [MORYTANIA] },
  "Theatre of Blood": { quests: [MORYTANIA] },
  "Theatre of Blood: Entry Mode": { quests: [MORYTANIA] },
  "Theatre of Blood: Hard Mode": { quests: [MORYTANIA] },
  "Tombs of Amascut": { quests: ["Beneath Cursed Sands"] },
  "Tombs of Amascut: Entry Mode": { quests: ["Beneath Cursed Sands"] },
  "Tombs of Amascut: Expert Mode": { quests: ["Beneath Cursed Sands"] },
  "Tormented Demon": { quests: ["While Guthix Sleeps"] },
  Vardorvis: { quests: [DT2] },
  Vorkath: { quests: ["Dragon Slayer II"] },
  Whisperer: { quests: [DT2] },
  Yama: { quests: ["A Kingdom Divided"] },
  Zulrah: { quests: ["Regicide"] },
};

/**
 * Shorter names for the quest chips and tooltips, where the full in-game title
 * is unwieldy. Only where it earns it -- the full name is what the profile
 * stores and what WikiSync is joined on, so this is display only.
 */
const QUEST_LABEL: Readonly<Record<string, string>> = {
  [DT2]: "Desert Treasure II",
};

export function questLabel(quest: string): string {
  return QUEST_LABEL[quest] ?? quest;
}

/** Lower-cased lookup, so a monster's casing in the data can drift without breaking. */
const BY_MONSTER = new Map<string, MonsterGate>(
  Object.entries(GATES).map(([monster, gate]) => [monster.toLowerCase(), gate]),
);

/** Every monster this module has an opinion about, in the data's own casing. */
export function gatedMonsters(): string[] {
  return Object.keys(GATES);
}

export function gateFor(monster: string | null): MonsterGate | null {
  if (monster === null) return null;
  return BY_MONSTER.get(monster.trim().toLowerCase()) ?? null;
}

/**
 * Every quest any gate mentions, sorted by label. Drives the manual form's
 * checklist, so that list can never fall out of step with the table.
 */
export function gatedQuests(): string[] {
  const seen = new Set<string>();
  for (const gate of Object.values(GATES)) {
    for (const quest of gate.quests ?? []) seen.add(quest);
  }
  return [...seen].sort((a, b) => questLabel(a).localeCompare(questLabel(b)));
}

/**
 * How many quests any gate mentions -- the denominator every pane quotes.
 *
 * Computed once from the table rather than written down, so a gate that starts
 * asking for a twentieth quest moves the number everywhere it appears.
 */
export const GATED_QUEST_COUNT = gatedQuests().length;

// --- the player -------------------------------------------------------------

/**
 * What this browser knows about the account, from a WikiSync paste or typed in
 * by hand.
 *
 * `levels` holds every skill WikiSync reported, not just the gated ten: it costs
 * nothing to keep, and it means adding a gate on a new skill doesn't invalidate
 * every profile already stored. `quests` is the finished ones only.
 */
export interface PlayerProfile {
  readonly levels: Readonly<Record<string, number>>;
  readonly quests: readonly string[];
}

/**
 * Quest names compared loosely enough to survive punctuation, and no looser.
 *
 * The dash in "Desert Treasure II - The Fallen Empire" is the reason: it is a
 * hyphen-minus in the wiki's data, an en dash in some renderings, and the
 * difference between the two is not something a player should ever have to care
 * about. Case and runs of whitespace go the same way.
 */
export function normalizeQuest(quest: string): string {
  return (
    quest
      .toLowerCase()
      // U+2010..U+2015 are the typographic dashes; U+2212 is the maths minus.
      .replace(/[‐-―−]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * How many of the gated quests an account has finished.
 *
 * Joined by name, which is why both sides go through normalizeQuest: every
 * source spells quests its own way, and "0 of 19" against a maxed account is
 * how a spelling change announces itself.
 */
export function countGatedQuests(profile: PlayerProfile): number {
  const finished = new Set(profile.quests.map(normalizeQuest));
  return gatedQuests().filter((quest) => finished.has(normalizeQuest(quest)))
    .length;
}

export const EMPTY_PROFILE: PlayerProfile = { levels: {}, quests: [] };

/** Whether a profile says anything at all -- an empty one can't answer questions. */
export function profileIsEmpty(profile: PlayerProfile | null): boolean {
  return (
    profile === null ||
    (Object.keys(profile.levels).length === 0 && profile.quests.length === 0)
  );
}

// --- checking ---------------------------------------------------------------

/**
 * `unknown` is a real third answer, not a null: with no profile we know Scurrius
 * is open to everyone but genuinely cannot say whether Vorkath is open to you.
 * Collapsing that into "blocked" would hide half the game from someone who
 * simply hasn't told us their levels yet.
 */
export type GateStatus = "open" | "blocked" | "unknown";

export interface Shortfall {
  kind: "skill" | "quest";
  /** Reads as the requirement itself: "92 Slayer", "Dragon Slayer II". */
  label: string;
  /** For skills, the level actually held -- so a tooltip can say how far off. */
  have?: number;
}

export interface GateCheck {
  status: GateStatus;
  /** Everything the gate asks for, met or not. Empty when there is no gate. */
  requires: string[];
  /** Only what's missing. Always empty unless the status is `blocked`. */
  missing: Shortfall[];
}

const OPEN: GateCheck = { status: "open", requires: [], missing: [] };

/**
 * What stands between this profile and this monster.
 *
 * Pure, and cheap enough to call per row: the table is a Map lookup and a gate
 * has at most four clauses.
 */
export function checkGate(
  monster: string | null,
  profile: PlayerProfile | null,
): GateCheck {
  const gate = gateFor(monster);
  // No modelled gate means open to everyone, profile or not -- a third of the
  // 89 monsters, and the reason the filter is worth having at all: 56 of them
  // are behind something, which is far too many to keep in your head.
  if (gate === null) return OPEN;

  const requires: string[] = [];
  for (const [skill, level] of Object.entries(gate.skills ?? {})) {
    requires.push(`${level} ${skill}`);
  }
  for (const quest of gate.quests ?? []) requires.push(questLabel(quest));

  // The `profile === null` half is redundant against profileIsEmpty and is what
  // narrows the type for the two lines below it.
  if (profile === null || profileIsEmpty(profile)) {
    return { status: "unknown", requires, missing: [] };
  }

  const held = profile.levels;
  const finished = new Set(profile.quests.map(normalizeQuest));

  const missing: Shortfall[] = [];
  for (const [skill, level] of Object.entries(gate.skills ?? {})) {
    // Absent means 1, not "assume it's fine": a profile typed by hand may only
    // have Slayer in it, and treating the gaps as met would call Nex open on the
    // strength of one number.
    const have = held[skill] ?? 1;
    if (have < level)
      missing.push({ kind: "skill", label: `${level} ${skill}`, have });
  }
  for (const quest of gate.quests ?? []) {
    if (!finished.has(normalizeQuest(quest))) {
      missing.push({ kind: "quest", label: questLabel(quest) });
    }
  }

  return missing.length === 0
    ? { status: "open", requires, missing: [] }
    : { status: "blocked", requires, missing };
}

/**
 * The same check keyed by monster, computed once for a whole render rather than
 * per row. 89 monsters against a table lookup is trivial, but the table is
 * consulted for all 646 tasks on every filter change and every profile edit.
 */
export function checkAll(
  tasks: readonly TaskRow[],
  profile: PlayerProfile | null,
): Map<string, GateCheck> {
  const out = new Map<string, GateCheck>();
  for (const task of tasks) {
    if (task.monster === null || out.has(task.monster)) continue;
    out.set(task.monster, checkGate(task.monster, profile));
  }
  return out;
}

/** A one-line summary for the tooltip on a locked row. */
export function describeMissing(missing: readonly Shortfall[]): string {
  const parts = missing.map((item) =>
    // "Priest in Peril" alone reads as a place or a person. Naming it as a quest
    // is the difference between a requirement you understand and one you have to
    // go and look up.
    item.kind === "quest" ? `the quest ${item.label}` : item.label,
  );
  // Joined as a sentence, not with a separator. This is read aloud by a screen
  // reader, where "·" is either silence or the word "middot" -- neither of which
  // is what a list of two requirements sounds like.
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
