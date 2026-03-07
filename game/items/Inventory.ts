import { getItemDefinition, type ItemDefinition } from './ItemCatalog'

export interface ItemInstance {
  instanceId: string
  itemDefinitionId: string
}

export interface InventoryStack {
  stackId: string
  itemInstanceIds: string[]
  x: number
  y: number
}

export interface InventoryState {
  cols: number
  rows: number
  itemInstances: ItemInstance[]
  stacks: InventoryStack[]
}

export interface InventoryStackView {
  stackId: string
  itemDefinitionId: string
  name: string
  count: number
  maxStack: number
  width: number
  height: number
  x: number
  y: number
}

export function createEmptyInventory(cols: number, rows: number): InventoryState {
  return {
    cols,
    rows,
    itemInstances: [],
    stacks: [],
  }
}

export function createItemInstance(itemDefinitionId: string): ItemInstance {
  return {
    instanceId: createUniqueId(),
    itemDefinitionId,
  }
}

export function addItemInstance(inventory: InventoryState, instance: ItemInstance): boolean {
  const definition = getItemDefinition(instance.itemDefinitionId)
  const stack = definition.stackable
    ? inventory.stacks.find(candidate =>
        getStackDefinition(inventory, candidate).id === definition.id &&
        candidate.itemInstanceIds.length < definition.maxStack
      )
    : undefined

  inventory.itemInstances.push(instance)

  if (stack) {
    stack.itemInstanceIds.push(instance.instanceId)
    return true
  }

  const position = findFirstAvailablePosition(inventory, definition)
  if (!position) {
    inventory.itemInstances = inventory.itemInstances.filter(item => item.instanceId !== instance.instanceId)
    return false
  }

  inventory.stacks.push({
    stackId: createUniqueId(),
    itemInstanceIds: [instance.instanceId],
    x: position.x,
    y: position.y,
  })

  return true
}

export function removeSingleItemByDefinition(
  inventory: InventoryState,
  itemDefinitionId: string
): ItemInstance | null {
  const stack = inventory.stacks.find(candidate =>
    getStackDefinition(inventory, candidate).id === itemDefinitionId &&
    candidate.itemInstanceIds.length > 0
  )
  if (!stack) {
    return null
  }

  const instanceId = stack.itemInstanceIds[stack.itemInstanceIds.length - 1]
  stack.itemInstanceIds = stack.itemInstanceIds.filter(candidate => candidate !== instanceId)
  const instance = inventory.itemInstances.find(item => item.instanceId === instanceId) ?? null
  inventory.itemInstances = inventory.itemInstances.filter(item => item.instanceId !== instanceId)

  if (stack.itemInstanceIds.length === 0) {
    inventory.stacks = inventory.stacks.filter(candidate => candidate.stackId !== stack.stackId)
  }

  return instance
}

export function countItemsByDefinition(inventory: InventoryState, itemDefinitionId: string): number {
  return inventory.itemInstances.filter(item => item.itemDefinitionId === itemDefinitionId).length
}

export function getInventoryStackViews(inventory: InventoryState): InventoryStackView[] {
  return inventory.stacks
    .map(stack => {
      const definition = getStackDefinition(inventory, stack)
      return {
        stackId: stack.stackId,
        itemDefinitionId: definition.id,
        name: definition.name,
        count: stack.itemInstanceIds.length,
        maxStack: definition.maxStack,
        width: definition.width,
        height: definition.height,
        x: stack.x,
        y: stack.y,
      }
    })
    .sort((left, right) => left.y - right.y || left.x - right.x)
}

function findFirstAvailablePosition(
  inventory: InventoryState,
  definition: ItemDefinition
): { x: number; y: number } | null {
  for (let y = 0; y <= inventory.rows - definition.height; y++) {
    for (let x = 0; x <= inventory.cols - definition.width; x++) {
      if (canPlaceAt(inventory, definition, x, y)) {
        return { x, y }
      }
    }
  }

  return null
}

function canPlaceAt(
  inventory: InventoryState,
  definition: ItemDefinition,
  x: number,
  y: number
): boolean {
  for (const stack of inventory.stacks) {
    const stackDefinition = getStackDefinition(inventory, stack)

    const intersects =
      x < stack.x + stackDefinition.width &&
      x + definition.width > stack.x &&
      y < stack.y + stackDefinition.height &&
      y + definition.height > stack.y

    if (intersects) {
      return false
    }
  }

  return true
}

function getStackDefinition(inventory: InventoryState, stack: InventoryStack): ItemDefinition {
  const itemInstance = inventory.itemInstances.find(item => item.instanceId === stack.itemInstanceIds[0])
  if (!itemInstance) {
    throw new Error(`Inventory stack ${stack.stackId} is missing its item instance`)
  }

  return getItemDefinition(itemInstance.itemDefinitionId)
}

function createUniqueId(): string {
  if (typeof globalThis !== 'undefined' && 'crypto' in globalThis && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
