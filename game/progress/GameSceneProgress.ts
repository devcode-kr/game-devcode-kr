import type { CharacterJobId } from '../characters/CharacterJobRules'
import type { EffectRuntimeSceneState } from '../interactions/EffectRuntimeSceneBridge'
import type { EffectDebuffRuntime, EffectDebuffSnapshot } from '../interactions/EffectDebuffRules'
import type { ActiveItemBuffRuntime, ActiveItemBuffSnapshot } from '../items/ItemStatRules'
import type { ItemCooldownRuntime, ItemCooldownSnapshot } from '../items/ItemCooldownRules'
import type { InventoryState } from '../items/Inventory'
import {
  applyProgressSnapshot as applyStoredProgressSnapshot,
  createProgressSnapshot as createStoredProgressSnapshot,
} from './ProgressPersistence'
import type {
  AchievementState,
  JourneyLog,
  ProgressSnapshot,
} from './ProgressStore'

export interface GameSceneProgressCreateParams {
  floorIndex: number
  gold: number
  jobId: CharacterJobId
  health: number
  maxHealth: number
  mana: number
  maxMana: number
  poisoned: boolean
  guardBuffRemainingMs: number
  effectRuntimeSceneState: EffectRuntimeSceneState
  inventory: InventoryState
  beltInventory: InventoryState
  journeyLog: JourneyLog
  achievements: AchievementState
  serialize: {
    activeItemBuffs: (activeItemBuffs: ActiveItemBuffRuntime[], nowMs: number) => ActiveItemBuffSnapshot[]
    itemCooldowns: (itemCooldowns: ItemCooldownRuntime[], nowMs: number) => ItemCooldownSnapshot[]
    activeDebuffs: (activeDebuffs: EffectDebuffRuntime[], nowMs: number) => EffectDebuffSnapshot[]
  }
}

export interface AppliedGameSceneProgressState {
  floorIndex: number
  gold: number
  jobId: CharacterJobId
  health: number
  mana: number
  poisoned: boolean
  guardBuffRemainingMs: number
  inventory: InventoryState
  beltInventory: InventoryState
  journeyLog: JourneyLog
  achievements: AchievementState
  effectRuntime: {
    activeItemBuffs: ActiveItemBuffRuntime[]
    itemCooldowns: ItemCooldownRuntime[]
    activeDebuffs: EffectDebuffRuntime[]
  }
}

export function createGameSceneProgressSnapshot(
  params: GameSceneProgressCreateParams
): ProgressSnapshot {
  return createStoredProgressSnapshot({
    floorIndex: params.floorIndex,
    gold: params.gold,
    jobId: params.jobId,
    health: params.health,
    maxHealth: params.maxHealth,
    mana: params.mana,
    maxMana: params.maxMana,
    poisoned: params.poisoned,
    guardBuffRemainingMs: params.guardBuffRemainingMs,
    activeItemBuffs: params.serialize.activeItemBuffs(
      params.effectRuntimeSceneState.activeItemBuffs,
      params.effectRuntimeSceneState.nowMs
    ),
    itemCooldowns: params.serialize.itemCooldowns(
      params.effectRuntimeSceneState.itemCooldowns,
      params.effectRuntimeSceneState.nowMs
    ),
    activeDebuffs: params.serialize.activeDebuffs(
      params.effectRuntimeSceneState.activeDebuffs,
      params.effectRuntimeSceneState.nowMs
    ),
    inventory: params.inventory,
    beltInventory: params.beltInventory,
    journeyLog: params.journeyLog,
    achievements: params.achievements,
  })
}

export function applyGameSceneProgressSnapshot(params: {
  snapshot: ProgressSnapshot
  defaultHealth: number
  defaultMana: number
  inventoryCols: number
  inventoryRows: number
  beltCols: number
  beltRows: number
  nowMs: number
  restore: {
    activeItemBuffs: (snapshots: ActiveItemBuffSnapshot[], nowMs: number) => ActiveItemBuffRuntime[]
    itemCooldowns: (snapshots: ItemCooldownSnapshot[], nowMs: number) => ItemCooldownRuntime[]
    activeDebuffs: (snapshots: EffectDebuffSnapshot[], nowMs: number) => EffectDebuffRuntime[]
  }
}): AppliedGameSceneProgressState {
  const loaded = applyStoredProgressSnapshot(params.snapshot, {
    defaultHealth: params.defaultHealth,
    defaultMana: params.defaultMana,
    inventoryCols: params.inventoryCols,
    inventoryRows: params.inventoryRows,
    beltCols: params.beltCols,
    beltRows: params.beltRows,
  })

  return {
    floorIndex: loaded.runtime.floorIndex,
    gold: loaded.runtime.gold,
    jobId: loaded.runtime.jobId,
    health: loaded.runtime.health,
    mana: loaded.runtime.mana,
    poisoned: loaded.runtime.poisoned,
    guardBuffRemainingMs: loaded.runtime.guardBuffRemainingMs,
    inventory: loaded.runtime.inventory,
    beltInventory: loaded.runtime.beltInventory,
    journeyLog: loaded.journeyLog,
    achievements: loaded.achievements,
    effectRuntime: {
      activeItemBuffs: params.restore.activeItemBuffs(loaded.runtime.activeItemBuffs, params.nowMs),
      itemCooldowns: params.restore.itemCooldowns(loaded.runtime.itemCooldowns, params.nowMs),
      activeDebuffs: params.restore.activeDebuffs(loaded.runtime.activeDebuffs, params.nowMs),
    },
  }
}
