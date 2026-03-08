import type { CharacterStatModifier } from '../characters/CharacterStatModifier'
import type { SkillActionId } from '../interactions/SkillActionIds'
import type { WeaponProjectileAttackId } from '../interactions/WeaponProjectileAttackBuilder'
import {
  type AttackStyle,
  getItemDefinition,
  isAccessoryItemDefinition,
  isArmorItemDefinition,
  isEquippableItem,
  isGemItem,
  isWeaponItemDefinition,
  type EquippableItemDefinition,
  type GemItemDefinition,
} from './ItemCatalog'
import type { InventoryState, ItemInstance } from './Inventory'

export type EquipmentSlotTarget =
  | { kind: 'weapon' }
  | { kind: 'armor' }
  | { kind: 'accessory'; slotIndex: number }
  | { kind: 'socket'; accessorySlotIndex: number; socketIndex: number }

export interface AccessorySocketLoadout {
  accessoryInstanceId: string
  gemInstanceIds: string[]
}

export interface CharacterEquipmentLoadout {
  weaponInstanceId: string | null
  armorInstanceId: string | null
  accessorySlots: Array<AccessorySocketLoadout | null>
}

const ACCESSORY_SLOT_COUNT = 2

export function createEmptyCharacterEquipmentLoadout(): CharacterEquipmentLoadout {
  return {
    weaponInstanceId: null,
    armorInstanceId: null,
    accessorySlots: new Array<AccessorySocketLoadout | null>(ACCESSORY_SLOT_COUNT).fill(null),
  }
}

export function buildAutomaticEquipmentLoadout(inventory: InventoryState): CharacterEquipmentLoadout {
  const loadout = createEmptyCharacterEquipmentLoadout()
  const equippedInstances = inventory.itemInstances
    .filter(instance => isEquippableItem(getItemDefinition(instance.itemDefinitionId)))

  loadout.weaponInstanceId = equippedInstances.find(instance =>
    isWeaponItemDefinition(getItemDefinition(instance.itemDefinitionId))
  )?.instanceId ?? null
  loadout.armorInstanceId = equippedInstances.find(instance =>
    isArmorItemDefinition(getItemDefinition(instance.itemDefinitionId))
  )?.instanceId ?? null

  const accessoryInstances = equippedInstances.filter(instance =>
    isAccessoryItemDefinition(getItemDefinition(instance.itemDefinitionId))
  )
  const gemInstances = inventory.itemInstances.filter(instance =>
    isGemItem(getItemDefinition(instance.itemDefinitionId))
  )
  let gemIndex = 0

  for (let slotIndex = 0; slotIndex < ACCESSORY_SLOT_COUNT; slotIndex++) {
    const accessory = accessoryInstances[slotIndex]
    if (!accessory) {
      break
    }

    const definition = getItemDefinition(accessory.itemDefinitionId)
    const socketCount = isAccessoryItemDefinition(definition) ? definition.accessorySocketCount ?? 0 : 0
    loadout.accessorySlots[slotIndex] = {
      accessoryInstanceId: accessory.instanceId,
      gemInstanceIds: gemInstances.slice(gemIndex, gemIndex + socketCount).map(instance => instance.instanceId),
    }
    gemIndex += socketCount
  }

  return loadout
}

export function isCharacterEquipmentLoadoutEmpty(loadout: CharacterEquipmentLoadout): boolean {
  return !loadout.weaponInstanceId &&
    !loadout.armorInstanceId &&
    loadout.accessorySlots.every(slot => !slot)
}

export function reconcileCharacterEquipmentLoadout(
  inventory: InventoryState,
  loadout: CharacterEquipmentLoadout
): CharacterEquipmentLoadout {
  const nextLoadout = cloneLoadout(loadout)
  const hasInstance = (instanceId: string | null) => Boolean(findItemInstance(inventory, instanceId))

  if (!hasInstance(nextLoadout.weaponInstanceId)) {
    nextLoadout.weaponInstanceId = null
  }

  if (!hasInstance(nextLoadout.armorInstanceId)) {
    nextLoadout.armorInstanceId = null
  }

  nextLoadout.accessorySlots = nextLoadout.accessorySlots.map(slot => {
    if (!slot || !hasInstance(slot.accessoryInstanceId)) {
      return null
    }

    const accessoryDefinition = getEquippedItemDefinitionByInstanceId(inventory, slot.accessoryInstanceId)
    const socketCount = accessoryDefinition && isAccessoryItemDefinition(accessoryDefinition)
      ? accessoryDefinition.accessorySocketCount ?? 0
      : 0
    return {
      accessoryInstanceId: slot.accessoryInstanceId,
      gemInstanceIds: slot.gemInstanceIds
        .filter(instanceId => hasInstance(instanceId))
        .slice(0, socketCount),
    }
  })

  nextLoadout.accessorySlots = dedupeAccessorySlots(nextLoadout.accessorySlots)
  nextLoadout.weaponInstanceId = clearDuplicateIfUsedByAccessory(nextLoadout.weaponInstanceId, nextLoadout.accessorySlots)
  nextLoadout.armorInstanceId = clearDuplicateIfUsedByAccessory(nextLoadout.armorInstanceId, nextLoadout.accessorySlots)

  return nextLoadout
}

export function assignItemToEquipmentTarget(params: {
  inventory: InventoryState
  loadout: CharacterEquipmentLoadout
  itemInstanceId: string
  target: EquipmentSlotTarget
}): CharacterEquipmentLoadout | null {
  const instance = findItemInstance(params.inventory, params.itemInstanceId)
  if (!instance) {
    return null
  }

  const definition = getItemDefinition(instance.itemDefinitionId)
  const nextLoadout = cloneLoadout(params.loadout)

  if (params.target.kind === 'weapon') {
    if (!isWeaponItemDefinition(definition)) {
      return null
    }
    nextLoadout.weaponInstanceId = instance.instanceId
    return reconcileCharacterEquipmentLoadout(params.inventory, nextLoadout)
  }

  if (params.target.kind === 'armor') {
    if (!isArmorItemDefinition(definition)) {
      return null
    }
    nextLoadout.armorInstanceId = instance.instanceId
    return reconcileCharacterEquipmentLoadout(params.inventory, nextLoadout)
  }

  if (params.target.kind === 'accessory') {
    if (!isAccessoryItemDefinition(definition)) {
      return null
    }
    nextLoadout.accessorySlots[params.target.slotIndex] = {
      accessoryInstanceId: instance.instanceId,
      gemInstanceIds: [],
    }
    return reconcileCharacterEquipmentLoadout(params.inventory, nextLoadout)
  }

  if (!isGemItem(definition)) {
    return null
  }

  const accessorySlot = nextLoadout.accessorySlots[params.target.accessorySlotIndex]
  if (!accessorySlot) {
    return null
  }
  const accessoryDefinition = getEquippedItemDefinitionByInstanceId(params.inventory, accessorySlot.accessoryInstanceId)
  const socketCount = accessoryDefinition && isAccessoryItemDefinition(accessoryDefinition)
    ? accessoryDefinition.accessorySocketCount ?? 0
    : 0
  if (params.target.socketIndex < 0 || params.target.socketIndex >= socketCount) {
    return null
  }

  accessorySlot.gemInstanceIds = accessorySlot.gemInstanceIds.filter(instanceId => instanceId !== instance.instanceId)
  accessorySlot.gemInstanceIds[params.target.socketIndex] = instance.instanceId
  return reconcileCharacterEquipmentLoadout(params.inventory, nextLoadout)
}

export function clearEquipmentTarget(
  loadout: CharacterEquipmentLoadout,
  target: EquipmentSlotTarget
): CharacterEquipmentLoadout {
  const nextLoadout = cloneLoadout(loadout)

  if (target.kind === 'weapon') {
    nextLoadout.weaponInstanceId = null
    return nextLoadout
  }

  if (target.kind === 'armor') {
    nextLoadout.armorInstanceId = null
    return nextLoadout
  }

  if (target.kind === 'accessory') {
    nextLoadout.accessorySlots[target.slotIndex] = null
    return nextLoadout
  }

  const accessorySlot = nextLoadout.accessorySlots[target.accessorySlotIndex]
  if (!accessorySlot) {
    return nextLoadout
  }

  accessorySlot.gemInstanceIds = accessorySlot.gemInstanceIds.filter((_, index) => index !== target.socketIndex)
  return nextLoadout
}

export function getEquipmentTargetInstanceId(
  loadout: CharacterEquipmentLoadout,
  target: EquipmentSlotTarget
): string | null {
  if (target.kind === 'weapon') {
    return loadout.weaponInstanceId
  }

  if (target.kind === 'armor') {
    return loadout.armorInstanceId
  }

  if (target.kind === 'accessory') {
    return loadout.accessorySlots[target.slotIndex]?.accessoryInstanceId ?? null
  }

  return loadout.accessorySlots[target.accessorySlotIndex]?.gemInstanceIds[target.socketIndex] ?? null
}

export function getEquipmentStatBonuses(
  inventory: InventoryState,
  loadout: CharacterEquipmentLoadout
): CharacterStatModifier[] {
  return [
    ...getEquippedItemDefinitions(inventory, loadout).map(definition => definition.statModifiers),
    ...getSocketedGemDefinitions(inventory, loadout).map(definition => definition.statModifiers),
  ].filter((modifier): modifier is CharacterStatModifier => Boolean(modifier))
}

export function getEquippedWeaponAttackId(
  inventory: InventoryState,
  loadout: CharacterEquipmentLoadout
): WeaponProjectileAttackId | null {
  const definition = getEquippedItemDefinitionByInstanceId(inventory, loadout.weaponInstanceId)
  if (!definition) {
    return null
  }

  return isWeaponItemDefinition(definition) ? definition.weaponProjectileAttackId ?? null : null
}

export function getEquippedWeaponAttackStyle(
  inventory: InventoryState,
  loadout: CharacterEquipmentLoadout
): AttackStyle | null {
  const definition = getEquippedItemDefinitionByInstanceId(inventory, loadout.weaponInstanceId)
  if (!definition || !isWeaponItemDefinition(definition)) {
    return null
  }

  return definition.weaponAttackStyle ?? null
}

export function getSocketedSkillAttackIds(
  inventory: InventoryState,
  loadout: CharacterEquipmentLoadout
): SkillActionId[] {
  return getSocketedGemDefinitions(inventory, loadout)
    .map(definition => definition.grantedSkillActionId)
}

export function getSocketedSkillAttackIdsForAttackStyle(
  inventory: InventoryState,
  loadout: CharacterEquipmentLoadout,
  attackStyle: AttackStyle
): SkillActionId[] {
  return getSocketedGemDefinitions(inventory, loadout)
    .filter(definition => definition.compatibleAttackStyle === attackStyle)
    .map(definition => definition.grantedSkillActionId)
}

function getEquippedItemDefinitions(
  inventory: InventoryState,
  loadout: CharacterEquipmentLoadout
): EquippableItemDefinition[] {
  const instanceIds = [
    loadout.weaponInstanceId,
    loadout.armorInstanceId,
    ...loadout.accessorySlots.flatMap(slot => slot ? [slot.accessoryInstanceId] : []),
  ]

  return instanceIds
    .map(instanceId => getEquippedItemDefinitionByInstanceId(inventory, instanceId))
    .filter((definition): definition is EquippableItemDefinition => Boolean(definition))
}

function getSocketedGemDefinitions(
  inventory: InventoryState,
  loadout: CharacterEquipmentLoadout
): GemItemDefinition[] {
  const gemInstanceIds = loadout.accessorySlots.flatMap(slot => slot?.gemInstanceIds ?? [])
  return gemInstanceIds
    .map(instanceId => getGemDefinitionByInstanceId(inventory, instanceId))
    .filter((definition): definition is GemItemDefinition => Boolean(definition))
}

function getEquippedItemDefinitionByInstanceId(
  inventory: InventoryState,
  instanceId: string | null
): EquippableItemDefinition | null {
  const instance = findItemInstance(inventory, instanceId)
  if (!instance) {
    return null
  }

  const definition = getItemDefinition(instance.itemDefinitionId)
  return isEquippableItem(definition) ? definition : null
}

function getGemDefinitionByInstanceId(
  inventory: InventoryState,
  instanceId: string | null
): GemItemDefinition | null {
  const instance = findItemInstance(inventory, instanceId)
  if (!instance) {
    return null
  }

  const definition = getItemDefinition(instance.itemDefinitionId)
  return isGemItem(definition) ? definition : null
}

function findItemInstance(inventory: InventoryState, instanceId: string | null): ItemInstance | null {
  if (!instanceId) {
    return null
  }

  return inventory.itemInstances.find(instance => instance.instanceId === instanceId) ?? null
}

function cloneLoadout(loadout: CharacterEquipmentLoadout): CharacterEquipmentLoadout {
  return {
    weaponInstanceId: loadout.weaponInstanceId,
    armorInstanceId: loadout.armorInstanceId,
    accessorySlots: loadout.accessorySlots.map(slot => slot
      ? {
          accessoryInstanceId: slot.accessoryInstanceId,
          gemInstanceIds: [...slot.gemInstanceIds],
        }
      : null
    ),
  }
}

function dedupeAccessorySlots(
  accessorySlots: Array<AccessorySocketLoadout | null>
): Array<AccessorySocketLoadout | null> {
  const usedAccessoryIds = new Set<string>()
  const usedGemIds = new Set<string>()

  return accessorySlots.map(slot => {
    if (!slot || usedAccessoryIds.has(slot.accessoryInstanceId)) {
      return null
    }

    usedAccessoryIds.add(slot.accessoryInstanceId)
    return {
      accessoryInstanceId: slot.accessoryInstanceId,
      gemInstanceIds: slot.gemInstanceIds.filter(instanceId => {
        if (usedGemIds.has(instanceId)) {
          return false
        }
        usedGemIds.add(instanceId)
        return true
      }),
    }
  })
}

function clearDuplicateIfUsedByAccessory(
  instanceId: string | null,
  accessorySlots: Array<AccessorySocketLoadout | null>
): string | null {
  if (!instanceId) {
    return null
  }

  return accessorySlots.some(slot => slot?.accessoryInstanceId === instanceId) ? null : instanceId
}
