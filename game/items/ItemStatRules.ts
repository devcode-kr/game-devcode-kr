import type { CharacterStatModifier } from '../characters/CharacterStatRules'
import { getItemDefinition, type ItemCooldownGroup } from './ItemCatalog'
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
    .filter(definition => definition.type === 'equipment' && definition.statModifiers)
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
  const nextExpiresAt = params.now + params.durationMs
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
    itemDefinitionId: params.itemDefinitionId,
    expiresAt: nextExpiresAt,
  })

  return nextBuffs
}
