import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  addMonster,
  applyQuery,
  clearMonster,
  filterTasks,
  isEmptyQuery,
  parseQuery,
  pivotToMonster,
  removeMonster,
  serializeQuery,
  sortDirection,
  sortTasks,
} from "@/lib/task-query";
import type { PlayerProfile } from "@/lib/requirements";
import type { TaskQuery, TaskRow, TaskType, Tier } from "@/lib/types";

let nextId = 0;
function task(over: Partial<TaskRow> = {}): TaskRow {
  const tier: Tier = over.tier ?? "HARD";
  const points = {
    EASY: 1,
    MEDIUM: 2,
    HARD: 3,
    ELITE: 4,
    MASTER: 5,
    GRANDMASTER: 6,
  }[tier];
  return {
    wikiId: nextId++,
    name: "A task",
    monster: "Zulrah",
    description: "Do the thing.",
    tier,
    type: "KILL_COUNT" as TaskType,
    leagueRegion: null,
    completionPct: 50,
    ...over,
    // After the spread: points follow from the tier unless explicitly overridden,
    // so a caller passing only `tier` still gets a coherent row.
    points: over.points ?? points,
  };
}

const ids = (tasks: readonly TaskRow[]) => tasks.map((t) => t.wikiId);

describe("filterTasks: no filters", () => {
  it("returns everything for an empty query", () => {
    const tasks = [task(), task(), task()];
    expect(filterTasks(tasks, {}, new Set())).toHaveLength(3);
  });
});

describe("filterTasks: tier and type", () => {
  it("keeps any of the selected tiers", () => {
    const tasks = [
      task({ tier: "EASY" }),
      task({ tier: "MASTER" }),
      task({ tier: "ELITE" }),
    ];
    const result = filterTasks(tasks, { tier: ["EASY", "ELITE"] }, new Set());
    expect(ids(result)).toEqual([tasks[0].wikiId, tasks[2].wikiId]);
  });

  it("treats an empty tier list as no tier filter at all", () => {
    const tasks = [task({ tier: "EASY" }), task({ tier: "MASTER" })];
    expect(filterTasks(tasks, { tier: [] }, new Set())).toHaveLength(2);
  });

  it("keeps any of the selected types", () => {
    const tasks = [task({ type: "SPEED" }), task({ type: "STAMINA" })];
    expect(ids(filterTasks(tasks, { type: ["SPEED"] }, new Set()))).toEqual([
      tasks[0].wikiId,
    ]);
  });

  // Within a facet the options are alternatives; across facets they narrow.
  it("ANDs across facets while ORing within one", () => {
    const tasks = [
      task({ tier: "EASY", type: "SPEED" }),
      task({ tier: "EASY", type: "STAMINA" }),
      task({ tier: "MASTER", type: "SPEED" }),
    ];
    const result = filterTasks(
      tasks,
      { tier: ["EASY", "MASTER"], type: ["SPEED"] },
      new Set(),
    );
    expect(ids(result)).toEqual([tasks[0].wikiId, tasks[2].wikiId]);
  });
});

describe("filterTasks: monster", () => {
  it("matches a monster exactly", () => {
    const tasks = [task({ monster: "Zulrah" }), task({ monster: "Vorkath" })];
    expect(
      ids(filterTasks(tasks, { monster: ["Vorkath"] }, new Set())),
    ).toEqual([tasks[1].wikiId]);
  });

  // The point of the chips: two bosses on screen at once.
  it("ORs several monsters together", () => {
    const tasks = [
      task({ monster: "Zulrah" }),
      task({ monster: "Vorkath" }),
      task({ monster: "Araxxor" }),
    ];
    const result = filterTasks(
      tasks,
      { monster: ["Zulrah", "Araxxor"] },
      new Set(),
    );
    expect(ids(result)).toEqual([tasks[0].wikiId, tasks[2].wikiId]);
  });

  it("treats an empty monster list as no monster filter at all", () => {
    const tasks = [task({ monster: "Zulrah" }), task({ monster: null })];
    expect(filterTasks(tasks, { monster: [] }, new Set())).toHaveLength(2);
  });

  // The value arrives from a URL someone may have typed or shared.
  it("is case-insensitive", () => {
    const tasks = [task({ monster: "Zulrah" })];
    expect(filterTasks(tasks, { monster: ["zulrah"] }, new Set())).toHaveLength(
      1,
    );
  });

  it("ignores surrounding whitespace and blank entries", () => {
    const tasks = [task({ monster: "Zulrah" })];
    expect(
      filterTasks(tasks, { monster: ["  Zulrah  ", "   "] }, new Set()),
    ).toHaveLength(1);
  });

  it("does not match on a partial name", () => {
    const tasks = [task({ monster: "Abyssal Sire" })];
    expect(
      filterTasks(tasks, { monster: ["Abyssal"] }, new Set()),
    ).toHaveLength(0);
  });

  it("never matches the tasks that have no monster", () => {
    const tasks = [task({ monster: null }), task({ monster: "Zulrah" })];
    expect(ids(filterTasks(tasks, { monster: ["Zulrah"] }, new Set()))).toEqual(
      [tasks[1].wikiId],
    );
  });
});

describe("filterTasks: search", () => {
  const tasks = [
    task({
      name: "Ourg Freezer",
      description: "Kill General Graardor.",
      monster: "General Graardor",
    }),
    task({
      name: "Chally Time",
      description: "Use a chally.",
      monster: "Theatre of Blood",
    }),
  ];

  it("matches the name", () => {
    expect(ids(filterTasks(tasks, { q: "ourg" }, new Set()))).toEqual([
      tasks[0].wikiId,
    ]);
  });

  it("matches the description", () => {
    expect(ids(filterTasks(tasks, { q: "chally" }, new Set()))).toEqual([
      tasks[1].wikiId,
    ]);
  });

  it("matches the monster", () => {
    expect(ids(filterTasks(tasks, { q: "graardor" }, new Set()))).toEqual([
      tasks[0].wikiId,
    ]);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(filterTasks(tasks, { q: "  OURG  " }, new Set())).toHaveLength(1);
  });

  it("treats a blank search as no search", () => {
    expect(filterTasks(tasks, { q: "   " }, new Set())).toHaveLength(2);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterTasks(tasks, { q: "zzzz" }, new Set())).toHaveLength(0);
  });
});

describe("filterTasks: completion", () => {
  const tasks = [task(), task(), task()];
  const done = new Set([tasks[0].wikiId]);

  it("keeps only completed when true", () => {
    expect(ids(filterTasks(tasks, { completed: true }, done))).toEqual([
      tasks[0].wikiId,
    ]);
  });

  it("keeps only incomplete when false", () => {
    expect(ids(filterTasks(tasks, { completed: false }, done))).toEqual([
      tasks[1].wikiId,
      tasks[2].wikiId,
    ]);
  });

  // Three states, not two: unset means "don't care", which is not the same as false.
  it("keeps everything when unset", () => {
    expect(filterTasks(tasks, {}, done)).toHaveLength(3);
  });
});

describe("filterTasks: requirements", () => {
  // Zulrah is behind Regicide; Scurrius is behind nothing. Both are real entries
  // in the gate table, so this exercises the join the app actually makes rather
  // than a fixture that agrees with itself.
  const locked = task({ monster: "Zulrah" });
  const open = task({ monster: "Scurrius" });
  const anyMonster = task({ monster: null });
  const tasks = [locked, open, anyMonster];

  const done: PlayerProfile = { levels: { Slayer: 99 }, quests: ["Regicide"] };
  const fresh: PlayerProfile = { levels: { Slayer: 1 }, quests: [] };

  it("keeps what you can face", () => {
    expect(ids(filterTasks(tasks, { reqs: "met" }, new Set(), fresh))).toEqual([
      open.wikiId,
      anyMonster.wikiId,
    ]);
  });

  it("keeps what you cannot face yet", () => {
    expect(
      ids(filterTasks(tasks, { reqs: "unmet" }, new Set(), fresh)),
    ).toEqual([locked.wikiId]);
  });

  it("lets everything through once the requirement is met", () => {
    expect(filterTasks(tasks, { reqs: "met" }, new Set(), done)).toHaveLength(
      3,
    );
    expect(filterTasks(tasks, { reqs: "unmet" }, new Set(), done)).toHaveLength(
      0,
    );
  });

  // A shared link carrying reqs= lands on people who have never entered a level.
  // Filtering there would show them an empty table and look like a broken link.
  it("is inert without a profile", () => {
    expect(filterTasks(tasks, { reqs: "met" }, new Set(), null)).toHaveLength(
      3,
    );
    expect(filterTasks(tasks, { reqs: "unmet" }, new Set(), null)).toHaveLength(
      3,
    );
    expect(
      filterTasks(tasks, { reqs: "unmet" }, new Set(), {
        levels: {},
        quests: [],
      }),
    ).toHaveLength(3);
  });

  it("keeps everything when unset", () => {
    expect(filterTasks(tasks, {}, new Set(), fresh)).toHaveLength(3);
  });

  it("combines with the other facets rather than replacing them", () => {
    const query: TaskQuery = { reqs: "unmet", tier: ["HARD"] };
    expect(
      ids(
        filterTasks(
          [...tasks, task({ monster: "Zulrah", tier: "EASY" })],
          query,
          new Set(),
          fresh,
        ),
      ),
    ).toEqual([locked.wikiId]);
  });
});

describe("sortDirection", () => {
  it("reads the direction off the key", () => {
    expect(sortDirection("comp_desc")).toBe("desc");
    expect(sortDirection("name_asc")).toBe("asc");
  });
});

describe("sortTasks", () => {
  it("defaults to most-completed first, the easiest-remaining view", () => {
    expect(DEFAULT_SORT).toBe("comp_desc");
  });

  it("sorts by completion percentage descending", () => {
    const tasks = [
      task({ completionPct: 5 }),
      task({ completionPct: 70 }),
      task({ completionPct: 30 }),
    ];
    expect(sortTasks(tasks, "comp_desc").map((t) => t.completionPct)).toEqual([
      70, 30, 5,
    ]);
  });

  it("sorts by completion percentage ascending", () => {
    const tasks = [
      task({ completionPct: 5 }),
      task({ completionPct: 70 }),
      task({ completionPct: 30 }),
    ];
    expect(sortTasks(tasks, "comp_asc").map((t) => t.completionPct)).toEqual([
      5, 30, 70,
    ]);
  });

  // The 9 newest tasks have no Comp% yet. "Unknown" is not "rarest": letting
  // nulls win the ascending sort would park a whole new boss at the top of the
  // list and bury the actual answer.
  it("puts unknown percentages last in BOTH directions", () => {
    const tasks = [task({ completionPct: null }), task({ completionPct: 40 })];
    expect(sortTasks(tasks, "comp_desc").map((t) => t.completionPct)).toEqual([
      40,
      null,
    ]);
    expect(sortTasks(tasks, "comp_asc").map((t) => t.completionPct)).toEqual([
      40,
      null,
    ]);
  });

  it("sorts by tier in both directions", () => {
    const tasks = [
      task({ tier: "MASTER" }),
      task({ tier: "EASY" }),
      task({ tier: "ELITE" }),
    ];
    expect(sortTasks(tasks, "tier_asc").map((t) => t.tier)).toEqual([
      "EASY",
      "ELITE",
      "MASTER",
    ]);
    expect(sortTasks(tasks, "tier_desc").map((t) => t.tier)).toEqual([
      "MASTER",
      "ELITE",
      "EASY",
    ]);
  });

  it("sorts by name in both directions", () => {
    const tasks = [
      task({ name: "Zebra" }),
      task({ name: "apple" }),
      task({ name: "Mango" }),
    ];
    expect(sortTasks(tasks, "name_asc").map((t) => t.name)).toEqual([
      "apple",
      "Mango",
      "Zebra",
    ]);
    expect(sortTasks(tasks, "name_desc").map((t) => t.name)).toEqual([
      "Zebra",
      "Mango",
      "apple",
    ]);
  });

  it("sorts by points, biggest first by default", () => {
    const tasks = [
      task({ tier: "EASY" }),
      task({ tier: "GRANDMASTER" }),
      task({ tier: "HARD" }),
    ];
    expect(sortTasks(tasks, "points_desc").map((t) => t.points)).toEqual([
      6, 3, 1,
    ]);
    expect(sortTasks(tasks, "points_asc").map((t) => t.points)).toEqual([
      1, 3, 6,
    ]);
  });

  it("sorts by type in the tier-like order the chips use", () => {
    const tasks = [
      task({ type: "SPEED" }),
      task({ type: "KILL_COUNT" }),
      task({ type: "PERFECTION" }),
    ];
    expect(sortTasks(tasks, "type_asc").map((t) => t.type)).toEqual([
      "KILL_COUNT",
      "PERFECTION",
      "SPEED",
    ]);
    expect(sortTasks(tasks, "type_desc").map((t) => t.type)).toEqual([
      "SPEED",
      "PERFECTION",
      "KILL_COUNT",
    ]);
  });

  it("sorts by monster, with the no-monster tasks last in both directions", () => {
    const tasks = [
      task({ monster: "Zulrah" }),
      task({ monster: null }),
      task({ monster: "Araxxor" }),
    ];
    expect(sortTasks(tasks, "monster_asc").map((t) => t.monster)).toEqual([
      "Araxxor",
      "Zulrah",
      null,
    ]);
    expect(sortTasks(tasks, "monster_desc").map((t) => t.monster)).toEqual([
      "Zulrah",
      "Araxxor",
      null,
    ]);
  });

  // Without a tiebreak the order of equal rows is unspecified, so the table
  // would reshuffle on unrelated state changes.
  it("breaks ties by id, so the order is deterministic", () => {
    const tasks = [
      task({ completionPct: 10 }),
      task({ completionPct: 10 }),
      task({ completionPct: 10 }),
    ];
    const forward = sortTasks(tasks, "comp_desc");
    const reversed = sortTasks([...tasks].reverse(), "comp_desc");
    expect(ids(forward)).toEqual(ids(reversed));
    expect(ids(forward)).toEqual([...ids(tasks)].sort((a, b) => a - b));
  });

  it("does not mutate the array it was given", () => {
    const tasks = [task({ completionPct: 5 }), task({ completionPct: 70 })];
    const before = ids(tasks);
    sortTasks(tasks, "comp_desc");
    expect(ids(tasks)).toEqual(before);
  });
});

describe("applyQuery", () => {
  it("filters and then sorts", () => {
    const tasks = [
      task({ tier: "EASY", completionPct: 10 }),
      task({ tier: "EASY", completionPct: 80 }),
      task({ tier: "MASTER", completionPct: 99 }),
    ];
    const result = applyQuery(
      tasks,
      { tier: ["EASY"], sort: "comp_desc" },
      new Set(),
    );
    expect(result.map((t) => t.completionPct)).toEqual([80, 10]);
  });

  it("uses the default sort when none is given", () => {
    const tasks = [task({ completionPct: 10 }), task({ completionPct: 80 })];
    expect(
      applyQuery(tasks, {}, new Set()).map((t) => t.completionPct),
    ).toEqual([80, 10]);
  });
});

describe("serializeQuery / parseQuery", () => {
  const roundTrip = (query: TaskQuery) => parseQuery(serializeQuery(query));

  it("omits everything for an empty query, so a clean view has a clean URL", () => {
    expect(serializeQuery({}).toString()).toBe("");
  });

  it("omits the default sort but keeps a non-default one", () => {
    expect(serializeQuery({ sort: DEFAULT_SORT }).toString()).toBe("");
    expect(serializeQuery({ sort: "name_asc" }).get("sort")).toBe("name_asc");
  });

  it("omits empty facet lists and blank searches", () => {
    expect(
      serializeQuery({ tier: [], type: [], q: "  ", monster: [] }).toString(),
    ).toBe("");
  });

  // One param per monster rather than a joined list: no delimiter to collide
  // with a name the wiki chose.
  it("writes one monster param per monster", () => {
    expect(
      serializeQuery({ monster: ["Zulrah", "Vorkath"] }).getAll("monster"),
    ).toEqual(["Zulrah", "Vorkath"]);
  });

  it.each([
    ["tiers", { tier: ["EASY", "MASTER"] as Tier[] }],
    ["types", { type: ["SPEED"] as TaskType[] }],
    ["a monster", { monster: ["Abyssal Sire"] }],
    ["several monsters", { monster: ["Zulrah", "Vorkath", "Araxxor"] }],
    ["a search", { q: "graardor" }],
    ["completed true", { completed: true }],
    ["completed false", { completed: false }],
    ["requirements met", { reqs: "met" as const }],
    ["requirements unmet", { reqs: "unmet" as const }],
    ["a sort", { sort: "tier_asc" as const }],
    [
      "everything at once",
      {
        tier: ["ELITE"] as Tier[],
        type: ["PERFECTION"] as TaskType[],
        monster: ["Zulrah", "Vorkath"],
        q: "orb",
        completed: false,
        sort: "name_asc" as const,
      },
    ],
  ])("round-trips %s", (_label, query) => {
    expect(roundTrip(query as TaskQuery)).toEqual(query);
  });

  it("survives a monster name with a space and a colon", () => {
    expect(
      roundTrip({ monster: ["Chambers of Xeric: Challenge Mode"] }).monster,
    ).toEqual(["Chambers of Xeric: Challenge Mode"]);
  });

  // Links shared before the headers took over sorting still have to work.
  it("accepts the old directionless sort names", () => {
    expect(parseQuery(new URLSearchParams("sort=tier")).sort).toBe("tier_asc");
    expect(parseQuery(new URLSearchParams("sort=name")).sort).toBe("name_asc");
    expect(parseQuery(new URLSearchParams("sort=monster")).sort).toBe(
      "monster_asc",
    );
  });

  // The query string is user-editable and shareable, so it is untrusted input.
  it("drops unknown tiers and types rather than filtering on nonsense", () => {
    const parsed = parseQuery(
      new URLSearchParams("tier=EASY,LEGENDARY&type=VIBES"),
    );
    expect(parsed.tier).toEqual(["EASY"]);
    expect(parsed.type).toBeUndefined();
  });

  it("ignores an unknown sort key and falls back to the default", () => {
    expect(parseQuery(new URLSearchParams("sort=chaos")).sort).toBeUndefined();
  });

  it("drops blank monster params", () => {
    expect(
      parseQuery(new URLSearchParams("monster=&monster=%20")).monster,
    ).toBeUndefined();
  });

  it("treats any non-true/false completed value as unset", () => {
    expect(
      parseQuery(new URLSearchParams("completed=maybe")).completed,
    ).toBeUndefined();
  });

  it("drops an unknown requirement filter", () => {
    expect(
      parseQuery(new URLSearchParams("reqs=someday")).reqs,
    ).toBeUndefined();
  });

  // Written even though it does nothing without a profile: the link describes a
  // view, and whoever opens it may well have their own levels entered.
  it("writes reqs even though it can be inert on the other end", () => {
    expect(serializeQuery({ reqs: "met" }).get("reqs")).toBe("met");
  });

  it("parses an empty query string to an empty query", () => {
    expect(parseQuery(new URLSearchParams(""))).toEqual({});
  });
});

describe("isEmptyQuery", () => {
  it("is true for nothing set and for explicitly empty values", () => {
    expect(isEmptyQuery({})).toBe(true);
    expect(isEmptyQuery({ tier: [], q: "  ", monster: [] })).toBe(true);
    expect(isEmptyQuery({ sort: DEFAULT_SORT })).toBe(true);
  });

  it("is false once any filter is active", () => {
    expect(isEmptyQuery({ tier: ["EASY"] })).toBe(false);
    expect(isEmptyQuery({ q: "x" })).toBe(false);
    expect(isEmptyQuery({ completed: false })).toBe(false);
    expect(isEmptyQuery({ sort: "name_asc" })).toBe(false);
    expect(isEmptyQuery({ monster: ["Zulrah"] })).toBe(false);
  });
});

describe("pivotToMonster", () => {
  it("sets the monster", () => {
    expect(pivotToMonster({}, "Zulrah").monster).toEqual(["Zulrah"]);
  });

  // The headline workflow: Comp% desc + not-completed, pivot to the top row's
  // boss, and still be looking at that boss's easiest remaining tasks.
  it("keeps sort, completion and facet filters through the pivot", () => {
    const query: TaskQuery = {
      sort: "comp_desc",
      completed: false,
      tier: ["EASY", "MEDIUM"],
      type: ["KILL_COUNT"],
    };
    expect(pivotToMonster(query, "Vardorvis")).toEqual({
      ...query,
      monster: ["Vardorvis"],
    });
  });

  // A leftover search term would hide most of the rows the pivot just asked for,
  // with nothing near the table to explain why. The caller hands it back through
  // the breadcrumb instead.
  it("drops the free-text search", () => {
    expect(pivotToMonster({ q: "vard" }, "Vardorvis").q).toBeUndefined();
  });

  it("replaces every monster already pivoted to", () => {
    expect(
      pivotToMonster({ monster: ["Zulrah", "Araxxor"] }, "Vorkath").monster,
    ).toEqual(["Vorkath"]);
  });

  it("does not mutate the query it was given", () => {
    const query: TaskQuery = { q: "vard", tier: ["EASY"] };
    pivotToMonster(query, "Vardorvis");
    expect(query).toEqual({ q: "vard", tier: ["EASY"] });
  });

  it("round-trips through the URL", () => {
    const pivoted = pivotToMonster({ sort: "name_asc" }, "Kree'arra");
    expect(parseQuery(serializeQuery(pivoted))).toEqual(pivoted);
  });
});

describe("addMonster / removeMonster", () => {
  it("appends to what is already there", () => {
    expect(addMonster({ monster: ["Zulrah"] }, "Vorkath").monster).toEqual([
      "Zulrah",
      "Vorkath",
    ]);
  });

  it("starts the list when there is none", () => {
    expect(addMonster({}, "Zulrah").monster).toEqual(["Zulrah"]);
  });

  // Shift-clicking the same boss twice shouldn't stack a duplicate chip.
  it("ignores a monster already on the list, whatever the case", () => {
    const query: TaskQuery = { monster: ["Zulrah"] };
    expect(addMonster(query, "zulrah")).toBe(query);
  });

  it("drops the search, same as a pivot", () => {
    expect(addMonster({ q: "vard" }, "Vardorvis").q).toBeUndefined();
  });

  it("removes one monster and leaves the others", () => {
    expect(
      removeMonster({ monster: ["Zulrah", "Vorkath"] }, "Zulrah").monster,
    ).toEqual(["Vorkath"]);
  });

  it("unsets the facet entirely when the last one goes", () => {
    expect(
      removeMonster({ monster: ["Zulrah"] }, "zulrah").monster,
    ).toBeUndefined();
  });

  it("does not mutate the query it was given", () => {
    const query: TaskQuery = { monster: ["Zulrah"] };
    addMonster(query, "Vorkath");
    removeMonster(query, "Zulrah");
    expect(query.monster).toEqual(["Zulrah"]);
  });
});

describe("clearMonster", () => {
  it("removes every monster and leaves everything else alone", () => {
    const query: TaskQuery = {
      monster: ["Zulrah", "Vorkath"],
      tier: ["ELITE"],
      completed: false,
      sort: "name_asc",
    };
    expect(clearMonster(query)).toEqual({
      tier: ["ELITE"],
      completed: false,
      sort: "name_asc",
    });
  });

  it("is a no-op when nothing was pivoted to", () => {
    expect(isEmptyQuery(clearMonster({}))).toBe(true);
  });

  it("does not mutate the query it was given", () => {
    const query: TaskQuery = { monster: ["Zulrah"] };
    clearMonster(query);
    expect(query.monster).toEqual(["Zulrah"]);
  });
});

describe("pivot: end to end over a task list", () => {
  it("narrows the table to that monster, keeping the not-completed filter", () => {
    const tasks = [
      task({ monster: "Vardorvis", completionPct: 40 }),
      task({ monster: "Vardorvis", completionPct: 9 }),
      task({ monster: "Zulrah", completionPct: 80 }),
    ];
    const completed = new Set([tasks[0].wikiId]);
    const start: TaskQuery = { sort: "comp_desc", completed: false };

    const pivoted = pivotToMonster(start, "Vardorvis");
    expect(ids(applyQuery(tasks, pivoted, completed))).toEqual([
      tasks[1].wikiId,
    ]);

    // ...and backing out of the pivot restores the wider view unchanged.
    expect(ids(applyQuery(tasks, clearMonster(pivoted), completed))).toEqual([
      tasks[2].wikiId,
      tasks[1].wikiId,
    ]);
  });

  // Shift-click: hold two bosses side by side, still easiest-first.
  it("widens to both bosses when a second is added", () => {
    const tasks = [
      task({ monster: "Vardorvis", completionPct: 9 }),
      task({ monster: "Zulrah", completionPct: 80 }),
      task({ monster: "Araxxor", completionPct: 40 }),
    ];
    const widened = addMonster(pivotToMonster({}, "Vardorvis"), "Zulrah");
    expect(ids(applyQuery(tasks, widened, new Set()))).toEqual([
      tasks[1].wikiId,
      tasks[0].wikiId,
    ]);
  });

  it("matches the monster whatever case the URL carried it in", () => {
    const tasks = [task({ monster: "Vardorvis" }), task({ monster: "Zulrah" })];
    const result = applyQuery(
      tasks,
      parseQuery(new URLSearchParams("monster=vardorvis")),
      new Set(),
    );
    expect(ids(result)).toEqual([tasks[0].wikiId]);
  });
});
