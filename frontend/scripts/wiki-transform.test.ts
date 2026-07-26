// The sanitizer and the Bucket -> TaskRow mapping.
//
// The real-world cases here are not invented: they're the exact strings the wiki
// serves for tasks #18, #315, #501 and #544, which are the only four rows in 646
// that sanitization changes at all.

import { describe, expect, it } from 'vitest'
import {
  assertClean,
  buildTasks,
  decodeEntities,
  EXPECTED_POINTS,
  EXPECTED_ROWS,
  RefreshError,
  sanitize,
  toRow,
  validate,
  type BucketRow,
} from './wiki-transform.ts'

const row = (over: Partial<BucketRow> = {}): BucketRow => ({
  id: 1,
  name: 'A task',
  monster: 'Zulrah',
  tier: 'Hard',
  type: 'Kill Count',
  task: 'Do the thing.',
  ...over,
})

describe('sanitize: wikilinks', () => {
  it('renders the label of a piped link', () => {
    expect(sanitize('Clear the [[Jewelled_Crab|Crystal Crabs]] room without wasting an orb.')).toBe(
      'Clear the Crystal Crabs room without wasting an orb.',
    )
  })

  it('renders the target of an unpiped link', () => {
    expect(sanitize('Defeat Sol Heredit after using [[Fortis Salute]] to the north.')).toBe(
      'Defeat Sol Heredit after using Fortis Salute to the north.',
    )
  })

  it('handles a link inside the league region field', () => {
    expect(sanitize('Asgarnia&Kourend,Asgarnia,(with [[Grimoire]] Relic)')).toBe(
      'Asgarnia&Kourend,Asgarnia,(with Grimoire Relic)',
    )
  })

  it('handles more than one link in a string', () => {
    expect(sanitize('[[A|first]] then [[B]]')).toBe('first then B')
  })
})

describe('sanitize: HTML', () => {
  // Task #18, verbatim. The <sup> is the wiki annotating its own spelling; it is
  // commentary about the wiki, not about the task.
  const TASK_18 =
    'Kill General Graardor whilst he is immobilized<sup class="noprint">&#91;' +
    '<span class="fact-text" title="&quot;Immobilized&quot; is American English, ' +
    'whereas British English would use &quot;immobilised&quot;.">sic</span>&#93;</sup>.'

  it('drops a citation entirely rather than leaving a bare [sic]', () => {
    const result = sanitize(TASK_18)
    expect(result).toBe('Kill General Graardor whilst he is immobilized.')
    expect(result).not.toContain('sic')
    expect(result).not.toContain('[')
  })

  it('turns a line break into a space', () => {
    expect(sanitize('one<br>two')).toBe('one two')
    expect(sanitize('one<br />two')).toBe('one two')
  })

  it('strips any other tag but keeps its text', () => {
    expect(sanitize('a <b>bold</b> claim')).toBe('a bold claim')
  })
})

describe('sanitize: entities and whitespace', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('&amp;&lt;&gt;&quot;&#65;&#x42;')).toBe('&<>"AB')
  })

  // Decoding happens after tag stripping, so an escaped angle bracket stays
  // literal text rather than becoming something the stripper would have eaten.
  it('leaves a decoded angle bracket as text', () => {
    expect(sanitize('use &lt;b&gt; carefully')).toBe('use <b> carefully')
  })

  it('collapses runs of whitespace and trims', () => {
    expect(sanitize('  a   b \n c  ')).toBe('a b c')
  })
})

describe('assertClean', () => {
  it('passes ordinary text', () => {
    expect(() => assertClean('Kill Zulrah 50 times.', 'x')).not.toThrow()
  })

  // The point of the residue check: markup this script has never seen should stop
  // the refresh rather than reach the UI.
  it.each([
    ['a surviving wikilink', 'see [[Thing]]'],
    ['a template', 'see {{Thing}}'],
    ['a tag', 'see <b>'],
    ['an entity', 'see &amp;'],
    ["'' markup", "see ''bold''"],
    ['a U+007F marker', 'see \u007fUNIQ'],
  ])('fails loudly on %s', (_label, value) => {
    expect(() => assertClean(value, 'task #1')).toThrow(RefreshError)
  })

  it('names the field in the error, so the failure is actionable', () => {
    expect(() => assertClean('see [[Thing]]', 'task #99 description')).toThrow(/task #99 description/)
  })
})

describe('toRow', () => {
  const noCompletion = new Map<number, number>()

  it('maps display casing onto the domain types and derives points', () => {
    const result = toRow(row({ tier: 'Grandmaster', type: 'Kill Count' }), noCompletion)
    expect(result.tier).toBe('GRANDMASTER')
    expect(result.type).toBe('KILL_COUNT')
    expect(result.points).toBe(6)
  })

  it('renames Bucket fields to the domain shape', () => {
    const result = toRow(row({ id: 7, task: 'Do it.' }), noCompletion)
    expect(result.wikiId).toBe(7)
    expect(result.description).toBe('Do it.')
  })

  it('maps the "None" monster placeholder to null', () => {
    expect(toRow(row({ monster: 'None' }), noCompletion).monster).toBeNull()
    expect(toRow(row({ monster: 'Zulrah' }), noCompletion).monster).toBe('Zulrah')
  })

  it('treats an absent league region as null', () => {
    expect(toRow(row(), noCompletion).leagueRegion).toBeNull()
    expect(toRow(row({ league_region: 'Kourend' }), noCompletion).leagueRegion).toBe('Kourend')
  })

  it('joins the completion percentage, or null when there is none', () => {
    expect(toRow(row({ id: 3 }), new Map([[3, 41.9]])).completionPct).toBe(41.9)
    expect(toRow(row({ id: 3 }), noCompletion).completionPct).toBeNull()
  })

  // An unrecognised tier or type means the wiki added something the app doesn't
  // model. Failing here beats writing a row the UI can't render.
  it('fails loudly on an unknown tier', () => {
    expect(() => toRow(row({ tier: 'Legendary' }), noCompletion)).toThrow(/unknown tier/)
  })

  it('fails loudly on an unknown task type', () => {
    expect(() => toRow(row({ type: 'Vibes' }), noCompletion)).toThrow(/unknown task type/)
  })

  it('fails on a description that sanitizes away to nothing', () => {
    expect(() => toRow(row({ task: '<sup>x</sup>' }), noCompletion)).toThrow(/empty after/)
  })
})

describe('buildTasks', () => {
  it('sorts by id, so the committed file has a stable diff', () => {
    const tasks = buildTasks([row({ id: 9 }), row({ id: 2 }), row({ id: 5 })], new Map())
    expect(tasks.map((t) => t.wikiId)).toEqual([2, 5, 9])
  })
})

describe('validate', () => {
  // A fixture with the real tier distribution: 646 rows totalling exactly 2671
  // points. Built rather than faked so each check below is reached honestly,
  // instead of by sneaking past the one before it.
  const DISTRIBUTION: Array<[string, number]> = [
    ['Easy', 41],
    ['Medium', 60],
    ['Hard', 86],
    ['Elite', 164],
    ['Master', 174],
    ['Grandmaster', 121],
  ]

  function validFixture(): BucketRow[] {
    const rows: BucketRow[] = []
    for (const [tier, count] of DISTRIBUTION) {
      for (let i = 0; i < count; i++) rows.push(row({ id: rows.length, tier }))
    }
    return rows
  }

  it('the fixture itself is valid, or none of these tests mean anything', () => {
    const tasks = buildTasks(validFixture(), new Map())
    expect(tasks).toHaveLength(EXPECTED_ROWS)
    expect(tasks.reduce((sum, t) => sum + t.points, 0)).toBe(EXPECTED_POINTS)
    expect(() => validate(tasks, new Map())).not.toThrow()
  })

  it('rejects the wrong row count', () => {
    const tasks = buildTasks(validFixture().slice(0, 3), new Map())
    expect(() => validate(tasks, new Map())).toThrow(/Expected 646 tasks, got 3/)
  })

  it('rejects the right count with the wrong point total', () => {
    // 646 rows, but all Easy: the count check passes and the points check catches it.
    const allEasy = validFixture().map((r) => ({ ...r, tier: 'Easy' }))
    expect(() => validate(buildTasks(allEasy, new Map()), new Map())).toThrow(
      /Expected 2671 total tier points, got 646/,
    )
  })

  it('rejects duplicate ids, since ids are the join key', () => {
    const rows = validFixture()
    rows[5] = { ...rows[5], id: rows[4].id, tier: rows[5].tier }
    expect(() => validate(buildTasks(rows, new Map()), new Map())).toThrow(/Duplicate task id/)
  })

  it('rejects a completion entry with no matching task', () => {
    const tasks = buildTasks(validFixture(), new Map())
    expect(() => validate(tasks, new Map([[99999, 10]]))).toThrow(/unknown task id/)
  })

  it('accepts completion entries that do match', () => {
    const tasks = buildTasks(validFixture(), new Map())
    expect(() => validate(tasks, new Map([[0, 41.9]]))).not.toThrow()
  })
})
