import type { InventoryState } from '../items/Inventory'
import type { CharacterJobId } from '../characters/CharacterJobRules'
import type { ActiveItemBuffSnapshot } from '../items/ItemStatRules'
import type { ItemCooldownSnapshot } from '../items/ItemCooldownRules'
import type { TimedModifierSnapshot } from '../interactions/TimedModifierRules'

export interface JourneyLog {
  currentChapter: string
  steps: {
    enteredDungeon: boolean
    talkedToNpc: boolean
    foundKey: boolean
    openedLockedChest: boolean
    reachedNextFloor: boolean
  }
}

export interface AchievementState {
  counters: {
    npcTalks: number
    chestsOpened: number
    lockedChestsOpened: number
    keysCollected: number
    floorsReached: number
  }
  unlocked: string[]
}

export interface ProgressSnapshot {
  floorIndex: number
  gold: number
  jobId?: CharacterJobId
  health?: number
  maxHealth?: number
  mana?: number
  maxMana?: number
  poisoned?: boolean
  poisonedRemainingMs?: number
  guardBuffRemainingMs?: number
  activeItemBuffs?: ActiveItemBuffSnapshot[]
  itemCooldowns?: ItemCooldownSnapshot[]
  timedModifiers?: TimedModifierSnapshot[]
  potions?: number
  keys?: number
  inventory?: InventoryState
  beltInventory?: InventoryState
  journeyLog: JourneyLog
  achievements: AchievementState
}

export interface ProgressStore {
  load(): ProgressSnapshot | null
  save(snapshot: ProgressSnapshot): void
  clear(): void
}

interface WebStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function createWebStorageProgressStore(
  storageKey: string,
  getStorage: () => WebStorageLike | null
): ProgressStore {
  return {
    load(): ProgressSnapshot | null {
      const storage = getStorage()
      if (!storage) {
        return null
      }

      try {
        const raw = storage.getItem(storageKey)
        if (!raw) {
          return null
        }

        return JSON.parse(raw) as ProgressSnapshot
      } catch {
        return null
      }
    },

    save(snapshot: ProgressSnapshot): void {
      const storage = getStorage()
      if (!storage) {
        return
      }

      try {
        storage.setItem(storageKey, JSON.stringify(snapshot))
      } catch {
        // Ignore storage quota or serialization failures for now.
      }
    },

    clear(): void {
      const storage = getStorage()
      if (!storage) {
        return
      }

      try {
        storage.removeItem(storageKey)
      } catch {
        // Ignore storage failures for now.
      }
    },
  }
}

export function createLocalStorageProgressStore(storageKey: string): ProgressStore {
  return createWebStorageProgressStore(storageKey, () => {
    if (typeof window === 'undefined') {
      return null
    }

    return window.localStorage
  })
}

export function createSessionStorageProgressStore(storageKey: string): ProgressStore {
  return createWebStorageProgressStore(storageKey, () => {
    if (typeof window === 'undefined') {
      return null
    }

    return window.sessionStorage
  })
}
