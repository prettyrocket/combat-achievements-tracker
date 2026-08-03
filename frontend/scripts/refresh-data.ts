// Fetches Combat Achievement data from the OSRS Wiki and writes src/data/tasks.json.
//
// Run with `npm run refresh-data`. The output is committed: new CA releases land a
// few times a year, so a commit is the right cadence and the app ships with data
// already bundled (instant load, works offline, no request on first paint).
//
// Both sources are anonymous, key-less and CORS-open. We still send a descriptive
// User-Agent -- the wiki asks for one, and an unattributed scraper is how you get
// a repo banned from an API that didn't have to be open in the first place.
//
// This file is the I/O half only: fetch, write, report. Sanitizing, mapping and
// validating live in wiki-transform.ts, where they can be tested without a network.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTasks,
  fail,
  RefreshError,
  validate,
  EXPECTED_POINTS,
  type BucketRow,
} from "./wiki-transform.ts";

const UA =
  "CombatAchievementsTracker/0.1 (https://github.com/prettyrocket/combat-achievements-tracker)";

const BUCKET_QUERY =
  "bucket('combat_achievement')" +
  ".select('id','name','monster','tier','type','task','league_region')" +
  ".limit(2000).run()";

const BUCKET_URL =
  "https://oldschool.runescape.wiki/api.php?action=bucket&format=json&origin=*&query=" +
  encodeURIComponent(BUCKET_QUERY);

const COMPLETION_URL =
  "https://oldschool.runescape.wiki/w/Module:Combat_Achievements/completion.json?action=raw";

async function get(url: string, label: string): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) fail(`${label}: HTTP ${res.status} ${res.statusText}\n  ${url}`);
  return res;
}

async function fetchBucketRows(): Promise<BucketRow[]> {
  const res = await get(BUCKET_URL, "Bucket query");
  const body = (await res.json()) as { bucket?: unknown };
  if (!Array.isArray(body.bucket)) {
    fail(
      "Bucket query: response had no `bucket` array -- did the API shape change?",
    );
  }
  return body.bucket as BucketRow[];
}

async function fetchCompletion(): Promise<Map<number, number>> {
  const res = await get(COMPLETION_URL, "completion.json");
  const text = await res.text();
  let raw: Record<string, number>;
  try {
    raw = JSON.parse(text) as Record<string, number>;
  } catch {
    // action=raw serves the page verbatim, so a wiki error page arrives as 200 HTML.
    fail(
      `completion.json: not JSON. First 200 chars:\n  ${text.slice(0, 200)}`,
    );
  }
  const map = new Map<number, number>();
  for (const [id, pct] of Object.entries(raw)) {
    if (typeof pct !== "number" || pct < 0 || pct > 100) {
      fail(
        `completion.json: task ${id} has an out-of-range percentage: ${JSON.stringify(pct)}`,
      );
    }
    map.set(Number(id), pct);
  }
  return map;
}

async function main(): Promise<void> {
  const outPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/data/tasks.json",
  );

  console.log(
    "Fetching combat_achievement Bucket + completion.json from oldschool.runescape.wiki",
  );
  const [bucketRows, completion] = await Promise.all([
    fetchBucketRows(),
    fetchCompletion(),
  ]);

  const tasks = buildTasks(bucketRows, completion);
  validate(tasks, completion);

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(tasks, null, 2) + "\n", "utf8");

  const withPct = tasks.filter((t) => t.completionPct !== null).length;
  const withMonster = tasks.filter((t) => t.monster !== null).length;
  console.log(
    `Wrote ${tasks.length} tasks to ${path.relative(process.cwd(), outPath)}`,
  );
  console.log(
    `  ${EXPECTED_POINTS} tier points · ${withPct} with a completion % · ` +
      `${withMonster} tied to a monster · ${new Set(tasks.map((t) => t.monster)).size - 1} monsters`,
  );
}

try {
  await main();
} catch (err) {
  if (err instanceof RefreshError) {
    console.error(`\nrefresh-data failed:\n  ${err.message}\n`);
    process.exit(1);
  }
  throw err;
}
