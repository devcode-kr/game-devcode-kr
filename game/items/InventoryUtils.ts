import {
  addItemInstance,
  countItemsByDefinition,
  createItemInstance,
  getInventoryStackViews,
  type InventoryState,
} from './Inventory'

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
