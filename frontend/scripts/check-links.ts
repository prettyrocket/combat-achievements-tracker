// Verifies that every wiki link the app emits actually goes somewhere.
//
// Run with `npm run check-links`, and always after `npm run refresh-data`: a new
// CA release lands tasks in the Bucket API before the wiki necessarily has an
// article for each one, and a task whose page doesn't exist yet would ship as a
// dead link with nothing in the UI to say so.
//
// Deliberately not a unit test. It needs the network, and a test suite that goes
// red because the wiki is having a bad afternoon is a test suite people learn to
// ignore. `wiki.test.ts` covers the URL *building* offline; this covers the one
// thing that can only be answered by asking the wiki.
//
// The links are built with the app's own functions, not from the raw names --
// checking the names would pass while a bug in the encoding shipped 646 broken
// URLs.

// tasks.json is read rather than imported through src/data/tasks.ts: that module
// imports the JSON the way a bundler does, which Node will only do with an import
// attribute. The other import matters more -- these are the app's own URL
// builders, so this checks the links the app actually emits.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { monsterWikiUrl, taskWikiUrl } from '../src/lib/wiki.ts'
import type { TaskRow } from '../src/lib/types.ts'

const UA =
  'CombatAchievementsTracker/0.1 (https://github.com/prettyrocket/combat-achievements-tracker)'

const PREFIX = 'https://oldschool.runescape.wiki/w/'
const API = 'https://oldschool.runescape.wiki/api.php'

interface Link {
  kind: 'task' | 'monster'
  source: string
  url: string
}

/** The title a URL points at -- what the API can be asked about. */
function titleOf(url: string): string {
  return decodeURIComponent(url.slice(PREFIX.length)).replace(/_/g, ' ')
}

async function loadTasks(): Promise<TaskRow[]> {
  const file = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/data/tasks.json',
  )
  return JSON.parse(await readFile(file, 'utf8')) as TaskRow[]
}

function buildLinks(tasks: readonly TaskRow[]): Link[] {
  const links: Link[] = []
  for (const name of new Set(tasks.map((task) => task.name))) {
    links.push({ kind: 'task', source: name, url: taskWikiUrl(name) })
  }
  for (const monster of new Set(tasks.map((task) => task.monster).filter((m) => m !== null))) {
    links.push({ kind: 'monster', source: monster, url: monsterWikiUrl(monster) })
  }
  return links
}

async function main(): Promise<void> {
  const links = buildLinks(await loadTasks())
  const byTitle = new Map<string, Link[]>()
  for (const link of links) {
    const title = titleOf(link.url)
    const existing = byTitle.get(title)
    if (existing) existing.push(link)
    else byTitle.set(title, [link])
  }

  const titles = [...byTitle.keys()]
  console.log(`Checking ${links.length} links (${titles.length} distinct pages) on the wiki`)

  const missing: string[] = []
  let redirected = 0

  // 50 titles per request is the API's limit for anonymous callers, and it turns
  // 735 lookups into 15 -- the difference between a courtesy and a scrape.
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
    const url = `${API}?action=query&format=json&redirects=1&titles=${batch
      .map(encodeURIComponent)
      .join('%7C')}`

    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) {
      console.error(`\ncheck-links failed:\n  HTTP ${res.status} ${res.statusText}\n  ${url}\n`)
      process.exit(1)
    }

    const body = (await res.json()) as {
      query?: { pages?: Record<string, { title: string; missing?: string }>; redirects?: unknown[] }
    }
    for (const page of Object.values(body.query?.pages ?? {})) {
      if (page.missing !== undefined) missing.push(page.title)
    }
    redirected += body.query?.redirects?.length ?? 0

    await new Promise((resolve) => setTimeout(resolve, 120))
  }

  console.log(`  ${redirected} reached through a redirect (fine -- the wiki follows its own)`)

  if (missing.length > 0) {
    console.error(`\ncheck-links failed: ${missing.length} link(s) point at a page that does not exist\n`)
    for (const title of missing) {
      for (const link of byTitle.get(title) ?? []) {
        console.error(`  ${link.kind} "${link.source}"`)
        console.error(`    -> ${link.url}`)
      }
    }
    console.error('')
    process.exit(1)
  }

  console.log(`All ${links.length} links resolve.`)
}

await main()
