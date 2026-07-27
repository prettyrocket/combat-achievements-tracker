// Links back out to the wiki the data came from.
//
// Both targets were verified against the live wiki: all 646 task names resolve to
// a page (they are real articles, categorised under "Combat Achievements", not
// rows on a list page), and all 89 monsters resolve too -- 18 of them through a
// redirect like `Fire Giant` -> `Fire giant` or `Whisperer` -> `The Whisperer`,
// which the wiki follows on its own. So the task's own name is a usable key and
// nothing here needs a lookup table.

const WIKI = 'https://oldschool.runescape.wiki/w/'

/**
 * MediaWiki titles use underscores for spaces; everything else still needs
 * encoding, and `encodeURIComponent` would eat the slash in a subpage title like
 * `Chambers of Xeric/Challenge Mode`, so slashes are put back.
 */
function wikiUrl(title: string): string {
  return WIKI + encodeURIComponent(title.trim().replace(/\s+/g, '_')).replace(/%2F/g, '/')
}

export function monsterWikiUrl(monster: string): string {
  return wikiUrl(monster)
}

export function taskWikiUrl(taskName: string): string {
  return wikiUrl(taskName)
}

/** For the reward items -- `Ghommal's hilt 4` and the like. Same builder; a
 *  separate name because check-links reports what kind of link broke. */
export function itemWikiUrl(item: string): string {
  return wikiUrl(item)
}

/**
 * Splits a name at its first colon, or returns `[value, null]` when there isn't
 * one.
 *
 * Only 5 monsters and 14 task names have a colon -- but they are the longest
 * strings in the data by a wide margin (`Chambers of Xeric: CM (5-Scale)
 * Speed-Chaser`), so they were single-handedly setting the width of two columns
 * for all 646 rows. Breaking after the colon lets those columns size to the rest.
 */
export function splitAtColon(value: string): [string, string | null] {
  const at = value.indexOf(':')
  if (at === -1) return [value, null]
  const tail = value.slice(at + 1).trim()
  return tail === '' ? [value, null] : [value.slice(0, at), tail]
}
