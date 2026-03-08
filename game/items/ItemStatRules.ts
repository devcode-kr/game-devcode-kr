import type { CharacterStatModifier } from '../characters/CharacterStatModifier'
import {
  getItemDefinition,
  isEquippableItemDefinition,
  type ItemCooldownGroup,
} from './ItemCatalog'
import type { InventoryState } from './Inventory'

export interface ActiveItemBuffSnapshot {
  itemDefinitionId: string
  remainingMs: number
}

export interface ActiveItemBuffRuntime {
  itemDefinitionId: string
  expiresAt: number
}

export function getInventoryEquipmentStatBonuses(inventory: InventoryState): CharacterStatModifier[] {
  return inventory.itemInstances
    .map(instance => getItemDefinition(instance.itemDefinitionId))
    .filter(definition => isEquippableItemDefinition(definition) && definition.statModifiers)
    .map(definition => definition.statModifiers!)
}

export function getActiveItemBuffStatBonuses(
  activeBuffs: ActiveItemBuffRuntime[],
  now: number
): CharacterStatModifier[] {
  return activeBuffs
    .filter(buff => buff.expiresAt > now)
    .map(buff => getItemDefinition(buff.itemDefinitionId))
    .filter(definition => definition.statModifiers && definition.statBuffDurationMs)
    .map(definition => definition.statModifiers!)
}

export function serializeActiveItemBuffs(
  activeBuffs: ActiveItemBuffRuntime[],
  now: number
): ActiveItemBuffSnapshot[] {
  return activeBuffs
    .filter(buff => buff.expiresAt > now)
    .map(buff => ({
      itemDefinitionId: buff.itemDefinitionId,
      remainingMs: buff.expiresAt - now,
    }))
}

export function restoreActiveItemBuffs(
  snapshots: ActiveItemBuffSnapshot[],
  now: number
): ActiveItemBuffRuntime[] {
  return snapshots
    .filter(snapshot => snapshot.remainingMs > 0)
    .map(snapshot => ({
      itemDefinitionId: snapshot.itemDefinitionId,
      expiresAt: now + snapshot.remainingMs,
    }))
}

export function upsertActiveItemBuff(params: {
  activeBuffs: ActiveItemBuffRuntime[]
  itemDefinitionId: string
  durationMs: number
  now: number
  group?: ItemCooldownGroup
}): ActiveItemBuffRuntime[] {
  const existing = params.activeBuffs.find(buff => {
    if (buff.expiresAt <= params.now) {
      return false
    }

    if (buff.itemDefinitionId === params.itemDefinitionId) {
      return true
    }

    if (!params.group) {
      return false
    }

    return getItemDefinition(buff.itemDefinitionId).cooldownGroup === params.group
  })
  const nextBuffs = params.activeBuffs.filter(buff => {
    if (buff.expiresAt <= params.now) {
      return false
    }

    if (buff.itemDefinitionId === params.itemDefinitionId) {
      return false
    }

    if (!params.group) {
      return true
    }

    const definition = getItemDefinition(buff.itemDefinitionId)
    return definition.cooldownGroup !== params.group
  })

  nextBuffs.push({
    itemDefinitionId: selectStrongerItemBuff(existing?.itemDefinitionId, params.itemDefinitionId),
    expiresAt: Math.max(existing?.expiresAt ?? params.now, params.now) + params.durationMs,
  })

  return nextBuffs
}

function selectStrongerItemBuff(
  existingItemDefinitionId: string | undefined,
  incomingItemDefinitionId: string
): string {
  if (!existingItemDefinitionId) {
    return incomingItemDefinitionId
  }

  return compareModifierStrength(
    getItemDefinition(existingItemDefinitionId).statModifiers,
    getItemDefinition(incomingItemDefinitionId).statModifiers
  ) > 0
    ? existingItemDefinitionId
    : incomingItemDefinitionId
}

function compareModifierStrength(
  left: CharacterStatModifier | undefined,
  right: CharacterStatModifier | undefined
): number {
  return getModifierStrength(left) - getModifierStrength(right)
}

function getModifierStrength(modifier: CharacterStatModifier | undefined): number {
  if (!modifier) {
    return 0
  }

  return Object.values(modifier).reduce((total, value) => total + Math.abs(value ?? 0), 0)
}
