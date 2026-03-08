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
  footprint: number[][]
  x: number
  y: number
}

export function getInventoryStackById(
  inventory: InventoryState,
  stackId: string
): InventoryStack | null {
  return inventory.stacks.find(stack => stack.stackId === stackId) ?? null
}

export function getStackPrimaryItemInstanceId(
  inventory: InventoryState,
  stackId: string
): string | null {
  return getInventoryStackById(inventory, stackId)?.itemInstanceIds[0] ?? null
}

export function getStackIdByItemInstanceId(
  inventory: InventoryState,
  instanceId: string
): string | null {
  return inventory.stacks.find(stack => stack.itemInstanceIds.includes(instanceId))?.stackId ?? null
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

  const position = findBestAvailablePosition(inventory, definition)
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
        footprint: definition.footprint,
        x: stack.x,
        y: stack.y,
      }
    })
    .sort((left, right) => left.y - right.y || left.x - right.x)
}

export function moveInventoryStack(
  inventory: InventoryState,
  stackId: string,
  x: number,
  y: number
): boolean {
  const stack = inventory.stacks.find(candidate => candidate.stackId === stackId)
  if (!stack) {
    return false
  }

  const definition = getStackDefinition(inventory, stack)
  if (!canPlaceAt(inventory, definition, x, y, stackId)) {
    return false
  }

  stack.x = x
  stack.y = y
  return true
}

export function transferInventoryStack(
  sourceInventory: InventoryState,
  targetInventory: InventoryState,
  stackId: string,
  x: number,
  y: number
): boolean {
  const stack = sourceInventory.stacks.find(candidate => candidate.stackId === stackId)
  if (!stack) {
    return false
  }

  const definition = getStackDefinition(sourceInventory, stack)
  if (!canPlaceAt(targetInventory, definition, x, y)) {
    return false
  }

  sourceInventory.stacks = sourceInventory.stacks.filter(candidate => candidate.stackId !== stackId)
  targetInventory.stacks.push({
    ...stack,
    x,
    y,
  })
  targetInventory.itemInstances = [...targetInventory.itemInstances, ...sourceInventory.itemInstances.filter(item =>
    stack.itemInstanceIds.includes(item.instanceId)
  )]
  sourceInventory.itemInstances = sourceInventory.itemInstances.filter(item =>
    !stack.itemInstanceIds.includes(item.instanceId)
  )
  return true
}

export function canTransferInventoryStack(
  sourceInventory: InventoryState,
  targetInventory: InventoryState,
  stackId: string,
  x: number,
  y: number
): boolean {
  const stack = sourceInventory.stacks.find(candidate => candidate.stackId === stackId)
  if (!stack) {
    return false
  }

  const definition = getStackDefinition(sourceInventory, stack)
  return canPlaceAt(targetInventory, definition, x, y)
}

export function canMoveInventoryStack(
  inventory: InventoryState,
  stackId: string,
  x: number,
  y: number
): boolean {
  const stack = inventory.stacks.find(candidate => candidate.stackId === stackId)
  if (!stack) {
    return false
  }

  const definition = getStackDefinition(inventory, stack)
  return canPlaceAt(inventory, definition, x, y, stackId)
}

function findBestAvailablePosition(
  inventory: InventoryState,
  definition: ItemDefinition
): { x: number; y: number } | null {
  let bestPosition: { x: number; y: number } | null = null
  let bestScore: [number, number, number, number, number] | null = null

  for (let y = 0; y <= inventory.rows - definition.height; y++) {
    for (let x = 0; x <= inventory.cols - definition.width; x++) {
      if (!canPlaceAt(inventory, definition, x, y)) {
        continue
      }

      const score = scorePlacementCandidate(inventory, definition, x, y)
      if (!bestScore || comparePlacementScores(score, bestScore) < 0) {
        bestScore = score
        bestPosition = { x, y }
      }
    }
  }

  return bestPosition
}

function canPlaceAt(
  inventory: InventoryState,
  definition: ItemDefinition,
  x: number,
  y: number,
  ignoreStackId?: string
): boolean {
  if (x < 0 || y < 0 || x + definition.width > inventory.cols || y + definition.height > inventory.rows) {
    return false
  }

  for (const stack of inventory.stacks) {
    if (stack.stackId === ignoreStackId) {
      continue
    }

    const stackDefinition = getStackDefinition(inventory, stack)
    if (footprintsIntersect(definition, x, y, stackDefinition, stack.x, stack.y)) {
      return false
    }
  }

  return true
}

function footprintsIntersect(
  leftDefinition: ItemDefinition,
  leftX: number,
  leftY: number,
  rightDefinition: ItemDefinition,
  rightX: number,
  rightY: number
): boolean {
  for (let row = 0; row < leftDefinition.height; row++) {
    for (let col = 0; col < leftDefinition.width; col++) {
      if (!occupiesCell(leftDefinition, col, row)) {
        continue
      }

      const worldX = leftX + col
      const worldY = leftY + row
      const rightLocalX = worldX - rightX
      const rightLocalY = worldY - rightY

      if (rightLocalX < 0 || rightLocalY < 0 || rightLocalX >= rightDefinition.width || rightLocalY >= rightDefinition.height) {
        continue
      }

      if (occupiesCell(rightDefinition, rightLocalX, rightLocalY)) {
        return true
      }
    }
  }

  return false
}

function occupiesCell(definition: ItemDefinition, x: number, y: number): boolean {
  return definition.footprint[y]?.[x] === 1
}

function scorePlacementCandidate(
  inventory: InventoryState,
  definition: ItemDefinition,
  x: number,
  y: number
): [number, number, number, number, number] {
  const occupiedCells = getOccupiedCells(definition, x, y)
  const bottom = Math.max(...occupiedCells.map(cell => cell.y))
  const right = Math.max(...occupiedCells.map(cell => cell.x))
  const contactScore = getContactScore(inventory, definition, x, y)
  const centerDistance = occupiedCells.reduce((sum, cell) => sum + cell.x + cell.y, 0)

  // Prefer top-left, then compact contact-heavy placements.
  return [bottom, right, -contactScore, centerDistance, x]
}

function comparePlacementScores(
  left: [number, number, number, number, number],
  right: [number, number, number, number, number]
): number {
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) {
      return left[index] - right[index]
    }
  }

  return 0
}

function getContactScore(
  inventory: InventoryState,
  definition: ItemDefinition,
  x: number,
  y: number
): number {
  const occupied = new Set<string>()
  for (const stack of inventory.stacks) {
    const stackDefinition = getStackDefinition(inventory, stack)
    for (const cell of getOccupiedCells(stackDefinition, stack.x, stack.y)) {
      occupied.add(`${cell.x},${cell.y}`)
    }
  }

  let score = 0
  for (const cell of getOccupiedCells(definition, x, y)) {
    const neighbors = [
      { x: cell.x - 1, y: cell.y },
      { x: cell.x + 1, y: cell.y },
      { x: cell.x, y: cell.y - 1 },
      { x: cell.x, y: cell.y + 1 },
    ]

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= inventory.cols || neighbor.y >= inventory.rows) {
        score += 1
        continue
      }

      if (occupied.has(`${neighbor.x},${neighbor.y}`)) {
        score += 2
      }
    }
  }

  return score
}

function getOccupiedCells(
  definition: ItemDefinition,
  originX: number,
  originY: number
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = []

  for (let row = 0; row < definition.height; row++) {
    for (let col = 0; col < definition.width; col++) {
      if (!occupiesCell(definition, col, row)) {
        continue
      }

      cells.push({
        x: originX + col,
        y: originY + row,
      })
    }
  }

  return cells
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
