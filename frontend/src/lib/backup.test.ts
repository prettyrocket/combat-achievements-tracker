// The export file is the only thing standing between localStorage and permanent
// loss, so what matters here is that both halves survive a round trip -- and that
// files written before the task list existed still restore cleanly.

import { afterEach, describe, expect, it, vi } from 'vitest'

function fakeStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

async function load() {
  vi.resetModules()
  vi.stubGlobal('window', { localStorage: fakeStorage() })
  return {
    backup: await import('@/lib/backup'),
    progress: await import('@/lib/progress-store'),
    list: await import('@/lib/tasklist-store'),
    profile: await import('@/lib/profile-store'),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildBackup', () => {
  it('carries progress and the list in one document', async () => {
    const { backup, progress, list } = await load()
    progress.setMany([3, 1])
    list.setList([2, 1])

    const file = backup.buildBackup()
    expect(file.app).toBe('combat-achievements-tracker')
    expect(file.completed).toEqual([1, 3])
    expect(file.list).toEqual([2, 1])
  })

  // Progress is a set and sorts; the list is a queue and must not.
  it("keeps the list in the player's order, not sorted", async () => {
    const { backup, list } = await load()
    list.setList([9, 2, 5])
    expect(backup.buildBackup().list).toEqual([9, 2, 5])
  })

  it('includes an empty list rather than omitting the field', async () => {
    const { backup } = await load()
    expect(backup.buildBackup().list).toEqual([])
  })
})

describe('importBackup', () => {
  it('round-trips its own export', async () => {
    const { backup, progress, list } = await load()
    progress.setMany([5, 9])
    list.setList([9, 5, 12])
    const file = JSON.stringify(backup.buildBackup())

    progress.reset()
    list.clear()

    const result = backup.importBackup(file)
    expect(result).toEqual({
      imported: 2,
      dropped: 0,
      listImported: 3,
      listDropped: 0,
      profileImported: false,
    })
    expect([...progress.getCompleted()].sort((a, b) => a - b)).toEqual([5, 9])
    expect(list.getList()).toEqual([9, 5, 12])
  })

  it('replaces the existing list rather than merging into it', async () => {
    const { backup, list } = await load()
    list.setList([1, 2, 3])

    backup.importBackup(
      JSON.stringify({ app: 'combat-achievements-tracker', completed: [], list: [7] }),
    )
    expect(list.getList()).toEqual([7])
  })

  // The whole point of the optional field: a backup taken before this feature
  // existed has to restore, and simply has no plan in it.
  it('restores a file from before the list existed, leaving the list empty', async () => {
    const { backup, progress, list } = await load()
    list.setList([1, 2])

    const v1 = JSON.stringify({
      app: 'combat-achievements-tracker',
      version: 1,
      completed: [3, 4],
    })
    const result = backup.importBackup(v1)

    expect([...progress.getCompleted()].sort((a, b) => a - b)).toEqual([3, 4])
    expect(list.getList()).toEqual([])
    expect(result.listImported).toBe(0)
    // Absent is not the same as damaged: nothing was dropped, so nothing is reported.
    expect(result.listDropped).toBe(0)
  })

  // Unlike progress and the list, an absent profile is *not* an instruction to
  // clear one -- a file exported before this existed must not wipe your levels.
  it('leaves an existing profile alone when the file has none', async () => {
    const { backup, profile } = await load()
    profile.setProfile({ levels: { Slayer: 92 }, quests: ['Regicide'] })

    const result = backup.importBackup(
      JSON.stringify({ app: 'combat-achievements-tracker', completed: [1] }),
    )
    expect(profile.getProfile().levels).toEqual({ Slayer: 92 })
    expect(result.profileImported).toBe(false)
  })

  it('restores a profile when the file carries one', async () => {
    const { backup, profile } = await load()
    const result = backup.importBackup(
      JSON.stringify({
        app: 'combat-achievements-tracker',
        completed: [1],
        profile: { levels: { Slayer: 92 }, quests: ['Regicide'] },
      }),
    )
    expect(profile.getProfile()).toEqual({ levels: { Slayer: 92 }, quests: ['Regicide'] })
    expect(result.profileImported).toBe(true)
  })

  it('treats a malformed profile as no profile rather than clearing yours', async () => {
    const { backup, profile } = await load()
    profile.setProfile({ levels: { Slayer: 92 }, quests: [] })
    const result = backup.importBackup(
      JSON.stringify({ app: 'combat-achievements-tracker', completed: [1], profile: 'nope' }),
    )
    expect(profile.getProfile().levels).toEqual({ Slayer: 92 })
    expect(result.profileImported).toBe(false)
  })

  it('drops list ids no task has, and counts them', async () => {
    const { backup, list } = await load()
    const result = backup.importBackup(
      JSON.stringify({
        app: 'combat-achievements-tracker',
        completed: [1],
        list: [2, 99999, 3],
      }),
    )
    expect(list.getList()).toEqual([2, 3])
    expect(result.listDropped).toBe(1)
  })

  it('treats a malformed list as no list rather than failing the restore', async () => {
    const { backup, progress, list } = await load()
    const result = backup.importBackup(
      JSON.stringify({ app: 'combat-achievements-tracker', completed: [1, 2], list: 'nope' }),
    )
    expect([...progress.getCompleted()].sort((a, b) => a - b)).toEqual([1, 2])
    expect(list.getList()).toEqual([])
    expect(result.imported).toBe(2)
  })

  // Progress is validated and committed first, so a rejected file must leave
  // *both* halves untouched -- not restore the plan and then throw.
  it.each([
    ['malformed JSON', '{{{'],
    ['a file from another app', JSON.stringify({ app: 'wikisync', completed: [1], list: [1] })],
    ['a missing completed list', JSON.stringify({ app: 'combat-achievements-tracker', list: [1] })],
    ['null', 'null'],
  ])('rejects %s without touching progress or the list', async (_label, payload) => {
    const { backup, progress, list } = await load()
    progress.setMany([42])
    list.setList([1, 2])

    expect(() => backup.importBackup(payload)).toThrow()
    expect([...progress.getCompleted()]).toEqual([42])
    expect(list.getList()).toEqual([1, 2])
  })
})

describe('progress and the list stay independent', () => {
  // Reset is about what you have done, not about what you plan to do. Wiping the
  // plan from under it would be a surprise with no undo.
  it('leaves the list alone when progress is reset', async () => {
    const { progress, list } = await load()
    progress.setMany([1, 2])
    list.setList([3, 4])

    progress.reset()
    expect(list.getList()).toEqual([3, 4])
  })

  it('leaves progress alone when the list is cleared', async () => {
    const { progress, list } = await load()
    progress.setMany([1, 2])
    list.setList([3, 4])

    list.clear()
    expect([...progress.getCompleted()].sort((a, b) => a - b)).toEqual([1, 2])
  })

  // Completing a task does not remove it from the plan: the panel keeps it,
  // struck through, and that is how "3 / 8 done" gets to mean anything.
  it('keeps a completed task on the list', async () => {
    const { progress, list } = await load()
    list.setList([1, 2])
    progress.toggle(1)
    expect(list.getList()).toEqual([1, 2])
  })
})
