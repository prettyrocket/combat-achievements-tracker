// React binding for profile-store.ts.
//
// Same reasoning as use-progress: the store is the system of record and can
// change from outside React -- another tab writing, a WikiSync import -- so
// useSyncExternalStore rather than useState and an effect.

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  clearProfile,
  getProfile,
  getSource,
  refreshFromStorage,
  setLevel,
  setProfile,
  setQuest,
  subscribe,
  type ProfileSource,
} from '@/lib/profile-store'
import { profileIsEmpty, type PlayerProfile } from '@/lib/requirements'

export interface UseProfile {
  profile: PlayerProfile
  /** True until there is anything to check requirements against. */
  isEmpty: boolean
  source: ProfileSource
  setProfile: (profile: PlayerProfile, source?: ProfileSource) => void
  setLevel: (skill: string, level: number) => void
  setQuest: (quest: string, finished: boolean) => void
  clear: () => void
}

export function useProfile(): UseProfile {
  const profile = useSyncExternalStore(subscribe, getProfile, getProfile)

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('ca-tracker:profile:')) {
        refreshFromStorage()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return {
    profile,
    isEmpty: profileIsEmpty(profile),
    // Read during render rather than kept in state: every change to the source
    // is also a change to the profile, which has already re-rendered us.
    source: getSource(),
    setProfile: useCallback(
      (next: PlayerProfile, source?: ProfileSource) => setProfile(next, source),
      [],
    ),
    setLevel: useCallback((skill: string, level: number) => setLevel(skill, level), []),
    setQuest: useCallback((quest: string, finished: boolean) => setQuest(quest, finished), []),
    clear: useCallback(() => clearProfile(), []),
  }
}
