import {
  addItemInstance,
  createEmptyInventory,
  createItemInstance,
  type InventoryState,
} from '../items/Inventory'
import type { ProgressSnapshot } from './ProgressStore'

export interface RuntimeProgressState {
  floorIndex: number
  gold: number
  health: number
  maxHealth: number
  inventory: InventoryState
}

export function createProgressSnapshot(params: {
  floorIndex: number
  gold: number
  health: number
  maxHealth: number
  inventory: InventoryState
  journeyLog: ProgressSnapshot['journeyLog']
  achievements: ProgressSnapshot['achievements']
}): ProgressSnapshot {
  return {
    floorIndex: params.floorIndex,
    gold: params.gold,
    health: params.health,
    maxHealth: params.maxHealth,
    inventory: params.inventory,
    journeyLog: params.journeyLog,
    achievements: params.achievements,
  }
}

export function applyProgressSnapshot(
  snapshot: ProgressSnapshot,
  defaults: {
    defaultHealth: number
    inventoryCols: number
    inventoryRows: number
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
      health: snapshot.health ?? defaults.defaultHealth,
      maxHealth: snapshot.maxHealth ?? defaults.defaultHealth,
      inventory: snapshot.inventory ?? createInventoryFromLegacySnapshot(snapshot, defaults.inventoryCols, defaults.inventoryRows),
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
