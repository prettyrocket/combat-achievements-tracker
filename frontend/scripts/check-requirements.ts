// Verifies the hand-written monster gates in src/lib/requirements.ts against the
// wiki.
//
// Run with `npm run check-requirements`, and always after `npm run refresh-data`.
// That table is the one data set in the app nobody generated, which makes it the
// one that can rot quietly: a release adds a boss, or moves a Slayer level, and
// nothing in the UI says so -- the filter just starts giving a slightly wrong
// answer to a question the player trusted it with.
//
// Not everything in the table is checkable. `bucket('infobox_monster')` carries
// `slayer_level`, so that half is verified outright, in both directions:
//
//   * a level we claim that the wiki disagrees with, and
//   * a monster the wiki gates on Slayer that we don't gate at all.
//
// The quest half has no such source -- nothing maps a monster to the quest that
// unlocks it -- so what's checked there is the part that *can* be: that every
// quest we name is a real quest, spelled the way the game spells it. That is
// exactly the failure that would otherwise be silent, because a quest name that
// matches nothing reads as "not done" forever rather than as an error.
//
// Deliberately not a unit test, for the same reason check-links isn't: it needs
// the network, and a suite that goes red because the wiki is having a bad
// afternoon is a suite people learn to ignore. requirements.test.ts covers the
// reasoning offline; this covers the facts.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gateFor, gatedMonsters, gatedQuests, normalizeQuest } from '../src/lib/requirements.ts'
import type { TaskRow } from '../src/lib/types.ts'

const UA =
  'CombatAchievementsTracker/0.1 (https://github.com/prettyrocket/combat-achievements-tracker)'

const BUCKET = 'https://oldschool.runescape.wiki/api.php?action=bucket&format=json&origin=*&query='

/**
 * Boss pages the wiki files under the names of the things you actually fight.
 *
 * The only kind of mismatch that has come up, and it is worth an explicit list
 * rather than fuzzy matching: "Grotesque Guardians" is the encounter, Dusk and
 * Dawn are the monsters with the 75 in their infobox. Guessing at that join is
 * how you end up silently verifying nothing.
 */
const SLAYER_ALIAS: Record<string, string[]> = {
  'Grotesque Guardians': ['Dusk', 'Dawn'],
}

async function bucketQuery<T>(query: string): Promise<T[]> {
  const res = await fetch(BUCKET + encodeURIComponent(query), { headers: { 'User-Agent': UA } })
  if (!res.ok) {
    throw new Error(`Bucket query failed: HTTP ${res.status} ${res.statusText}\n  ${query}`)
  }
  const body = (await res.json()) as { bucket?: T[]; error?: string }
  if (body.error) throw new Error(`Bucket query failed: ${body.error}\n  ${query}`)
  if (!Array.isArray(body.bucket)) {
    throw new Error(`Bucket query returned no rows array -- did the API shape change?\n  ${query}`)
  }
  return body.bucket
}

/** Every page in a bucket, 1000 at a time -- the API's ceiling per request. */
async function bucketAll<T>(select: string, bucket: string): Promise<T[]> {
  const out: T[] = []
  for (let offset = 0; ; offset += 1000) {
    const rows = await bucketQuery<T>(
      `bucket('${bucket}').select(${select}).limit(1000).offset(${offset}).run()`,
    )
    out.push(...rows)
    if (rows.length < 1000) return out
  }
}

async function loadMonsters(): Promise<string[]> {
  const file = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/data/tasks.json',
  )
  const tasks = JSON.parse(await readFile(file, 'utf8')) as TaskRow[]
  return [
    ...new Set(tasks.map((task) => task.monster).filter((m): m is string => m !== null)),
  ].sort()
}

interface MonsterRow {
  name?: string
  slayer_level?: number
}

/**
 * The highest Slayer level any version of a monster asks for, keyed by lowercase
 * name. Highest, because a boss with a quest version and a post-quest version
 * has a row for each and only one of them carries the requirement.
 *
 * Monsters with no requirement are left out entirely rather than stored as 0 --
 * the map is only ever read through a `?? 0`, and "not in here" and "needs no
 * Slayer" are the same answer.
 */
function slayerLevels(rows: MonsterRow[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const row of rows) {
    if (!row.name) continue
    const key = row.name.toLowerCase()
    const level = row.slayer_level ?? 0
    if (level > (out.get(key) ?? 0)) out.set(key, level)
  }
  return out
}

/** What the wiki says a CA monster needs, following an alias if there is one. */
function wikiSlayerFor(monster: string, levels: Map<string, number>): number {
  const names = SLAYER_ALIAS[monster] ?? [monster]
  return Math.max(0, ...names.map((name) => levels.get(name.toLowerCase()) ?? 0))
}

async function main(): Promise<void> {
  const monsters = await loadMonsters()
  const problems: string[] = []

  console.log(`Checking ${gatedMonsters().length} gated monsters against the wiki`)

  // --- the Slayer half, in both directions ----------------------------------

  const monsterRows = await bucketAll<MonsterRow>("'name','slayer_level'", 'infobox_monster')
  const levels = slayerLevels(monsterRows)
  console.log(
    `  read ${monsterRows.length} monster rows, ${levels.size} of them Slayer-gated`,
  )

  let verified = 0
  for (const monster of monsters) {
    const claimed = gateFor(monster)?.skills?.Slayer ?? 0
    const actual = wikiSlayerFor(monster, levels)

    // An unknown page is not a disagreement. Most CA "monsters" are raids and
    // encounters with no infobox_monster row at all, and none of those are
    // Slayer-gated -- so silence from the wiki here means nothing to check.
    if (actual === 0 && claimed === 0) continue

    if (actual === 0) {
      problems.push(
        `${monster}: the table asks for ${claimed} Slayer, but the wiki gives its page no ` +
          `slayer_level.\n    Either the requirement was removed, or the page was renamed and ` +
          `needs a SLAYER_ALIAS entry.`,
      )
    } else if (claimed === 0) {
      problems.push(
        `${monster}: the wiki requires ${actual} Slayer and the table doesn't gate on it at ` +
          `all.\n    New content, most likely -- add it to GATES in src/lib/requirements.ts.`,
      )
    } else if (claimed !== actual) {
      problems.push(
        `${monster}: the table says ${claimed} Slayer, the wiki says ${actual}.`,
      )
    } else {
      verified++
    }
  }
  console.log(`  ${verified} Slayer requirements match`)

  // --- the quest half, as far as it can be checked ---------------------------

  const quests = new Set(
    (await bucketAll<{ page_name?: string }>("'page_name'", 'quest'))
      .map((row) => row.page_name)
      .filter((name): name is string => typeof name === 'string')
      .map(normalizeQuest),
  )
  console.log(`  read ${quests.size} quest pages`)

  const named = gatedQuests()
  let questsFound = 0
  for (const quest of named) {
    if (quests.has(normalizeQuest(quest))) {
      questsFound++
    } else {
      problems.push(
        `"${quest}" is not a quest the wiki knows about.\n    The name has to match the game's ` +
          `exactly -- it's what a WikiSync paste is joined on, and a near miss reads as ` +
          `"not done" forever.`,
      )
    }
  }
  console.log(`  ${questsFound} of ${named.length} quest names match`)

  // --- keys that name nothing -----------------------------------------------

  const known = new Set(monsters.map((monster) => monster.toLowerCase()))
  for (const monster of gatedMonsters()) {
    if (!known.has(monster.toLowerCase())) {
      problems.push(
        `${monster}: gated in the table, but no task in tasks.json names it.\n    A rename or a ` +
          `retired monster -- the gate is doing nothing.`,
      )
    }
  }

  if (problems.length > 0) {
    console.error(`\ncheck-requirements failed: ${problems.length} problem(s)\n`)
    for (const problem of problems) console.error(`  ${problem}`)
    console.error('')
    process.exit(1)
  }

  console.log('The requirement table agrees with the wiki.')
}

await main()
