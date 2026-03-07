import {
  addItemInstance,
  createEmptyInventory,
  createItemInstance,
  type InventoryState,
} from '../items/Inventory'
import type { ActiveItemBuffSnapshot } from '../items/ItemStatRules'
import type { ItemCooldownSnapshot } from '../items/ItemCooldownRules'
import { getDefaultCharacterJobId, type CharacterJobId } from '../characters/CharacterJobRules'
import type { ProgressSnapshot } from './ProgressStore'

export interface RuntimeProgressState {
  floorIndex: number
  gold: number
  jobId: CharacterJobId
  health: number
  maxHealth: number
  mana: number
  maxMana: number
  poisoned: boolean
  guardBuffRemainingMs: number
  activeItemBuffs: ActiveItemBuffSnapshot[]
  itemCooldowns: ItemCooldownSnapshot[]
  inventory: InventoryState
  beltInventory: InventoryState
}

export function createProgressSnapshot(params: {
  floorIndex: number
  gold: number
  jobId: CharacterJobId
  health: number
  maxHealth: number
  mana: number
  maxMana: number
  poisoned: boolean
  guardBuffRemainingMs: number
  activeItemBuffs: ActiveItemBuffSnapshot[]
  itemCooldowns: ItemCooldownSnapshot[]
  inventory: InventoryState
  beltInventory: InventoryState
  journeyLog: ProgressSnapshot['journeyLog']
  achievements: ProgressSnapshot['achievements']
}): ProgressSnapshot {
  return {
    floorIndex: params.floorIndex,
    gold: params.gold,
    jobId: params.jobId,
    health: params.health,
    maxHealth: params.maxHealth,
    mana: params.mana,
    maxMana: params.maxMana,
    poisoned: params.poisoned,
    guardBuffRemainingMs: params.guardBuffRemainingMs,
    activeItemBuffs: params.activeItemBuffs,
    itemCooldowns: params.itemCooldowns,
    inventory: params.inventory,
    beltInventory: params.beltInventory,
    journeyLog: params.journeyLog,
    achievements: params.achievements,
  }
}

export function applyProgressSnapshot(
  snapshot: ProgressSnapshot,
  defaults: {
    defaultHealth: number
    defaultMana: number
    inventoryCols: number
    inventoryRows: number
    beltCols: number
    beltRows: number
  }
): {
  runtime: RuntimeProgressState
  journeyLog: ProgressSnapshot['journeyLog']
  achievements: ProgressSnapshot['achievements']
} {
  return {
    runtime: {
      floorIndex: snapshot.floorIndex,
      gold: snapshot.gold,
      jobId: snapshot.jobId ?? getDefaultCharacterJobId(),
      health: snapshot.health ?? defaults.defaultHealth,
      maxHealth: snapshot.maxHealth ?? defaults.defaultHealth,
      mana: snapshot.mana ?? defaults.defaultMana,
      maxMana: snapshot.maxMana ?? defaults.defaultMana,
      poisoned: snapshot.poisoned ?? false,
      guardBuffRemainingMs: snapshot.guardBuffRemainingMs ?? 0,
      activeItemBuffs: snapshot.activeItemBuffs ?? [],
      itemCooldowns: snapshot.itemCooldowns ?? [],
      inventory: snapshot.inventory ?? createInventoryFromLegacySnapshot(snapshot, defaults.inventoryCols, defaults.inventoryRows),
      beltInventory: snapshot.beltInventory ?? createEmptyInventory(defaults.beltCols, defaults.beltRows),
    },
    journeyLog: snapshot.journeyLog,
    achievements: snapshot.achievements,
  }
}

export function createInventoryFromLegacySnapshot(
  snapshot: ProgressSnapshot,
  cols: number,
  rows: number
): InventoryState {
  const inventory = createEmptyInventory(cols, rows)
  const legacyKeys = snapshot.keys ?? 0
  const legacyPotions = snapshot.potions ?? 0

  for (let index = 0; index < legacyKeys; index++) {
    addItemInstance(inventory, createItemInstance('utility_key'))
  }

  for (let index = 0; index < legacyPotions; index++) {
    addItemInstance(inventory, createItemInstance('potion_minor'))
  }

  return inventory
}
