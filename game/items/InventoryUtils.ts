import {
  addItemInstance,
  countItemsByDefinition,
  createItemInstance,
  getInventoryStackViews,
  type InventoryState,
} from './Inventory'
import { getItemDefinition } from './ItemCatalog'

export function addInventoryItemBatch(
  inventory: InventoryState,
  itemDefinitionId: string,
  amount: number
): number {
  let addedCount = 0

  for (let index = 0; index < amount; index++) {
    const added = addItemInstance(inventory, createItemInstance(itemDefinitionId))
    if (!added) {
      break
    }

    addedCount += 1
  }

  return addedCount
}

export function addInventoryItems(
  inventory: InventoryState,
  itemDefinitionIds: readonly string[]
): { addedCount: number; failedItemDefinitionIds: string[] } {
  let addedCount = 0
  const failedItemDefinitionIds: string[] = []

  for (const itemDefinitionId of itemDefinitionIds) {
    const added = addItemInstance(inventory, createItemInstance(itemDefinitionId))
    if (!added) {
      failedItemDefinitionIds.push(itemDefinitionId)
      continue
    }

    addedCount += 1
  }

  return {
    addedCount,
    failedItemDefinitionIds,
  }
}

export function addItemToInventories(
  itemDefinitionId: string,
  inventories: InventoryState[]
): boolean {
  for (const inventory of inventories) {
    if (addItemInstance(inventory, createItemInstance(itemDefinitionId))) {
      return true
    }
  }

  return false
}

export function addInventoryItemBatchToInventories(
  itemDefinitionId: string,
  amount: number,
  inventories: InventoryState[]
): number {
  const definition = getItemDefinition(itemDefinitionId)
  const orderedInventories = definition.type === 'consumable'
    ? inventories
    : [...inventories].reverse()
  let addedCount = 0

  for (let index = 0; index < amount; index++) {
    const added = addItemToInventories(itemDefinitionId, orderedInventories)
    if (!added) {
      break
    }

    addedCount += 1
  }

  return addedCount
}

export function getItemCountAcrossInventories(
  inventories: InventoryState[],
  itemDefinitionId: string
): number {
  return inventories.reduce((sum, inventory) => sum + countItemsByDefinition(inventory, itemDefinitionId), 0)
}

export function getInventoryItemCount(inventory: InventoryState, itemDefinitionId: string): number {
  return countItemsByDefinition(inventory, itemDefinitionId)
}

export function getInventorySummaryText(inventory: InventoryState): string {
  const stacks = getInventoryStackViews(inventory)
  if (stacks.length === 0) {
    return 'empty'
  }

  return stacks
    .slice(0, 3)
    .map(stack => `${stack.name} ${stack.count}/${stack.maxStack} @${stack.x},${stack.y}`)
    .join(' | ')
}
