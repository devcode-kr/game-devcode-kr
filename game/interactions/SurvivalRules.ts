import { cellCenter } from '../iso'
import type { CharacterStatModifier } from '../characters/CharacterStatModifier'
import {
  getItemDefinition,
  isUsableItemDefinition,
  type ItemCooldownGroup,
} from '../items/ItemCatalog'
import { removeSingleItemByDefinition, type InventoryState } from '../items/Inventory'
import type { Trap } from '../world/WorldObjects'

const TRAP_POISON_DURATION_MS = 8000
const TRAP_SLOW_DURATION_MS = 2500
const TRAP_SLOW_STAT_MODIFIERS: CharacterStatModifier = {
  moveSpeed: -0.35,
}

export function isDead(health: number): boolean {
  return health <= 0
}

export function tryUsePotion(params: {
  inventory: InventoryState
  health: number
  maxHealth: number
  mana: number
  maxMana: number
  poisoned: boolean
}): InventoryItemUseResult {
  return applyInventoryItemUse({
    inventory: params.inventory,
    itemDefinitionId: 'potion_minor',
    health: params.health,
    maxHealth: params.maxHealth,
    mana: params.mana,
    maxMana: params.maxMana,
    poisoned: params.poisoned,
  })
}

export interface InventoryItemUseResult {
  used: boolean
  health: number
  mana: number
  poisoned: boolean
  guardDurationMs: number
  statModifiers?: CharacterStatModifier
  statBuffDurationMs: number
  statBuffItemDefinitionId?: string
  cooldownGroup?: ItemCooldownGroup
  cooldownMs: number
  status: string
}

export function applyInventoryItemUse(params: {
  inventory: InventoryState
  itemDefinitionId: string
  health: number
  maxHealth: number
  mana: number
  maxMana: number
  poisoned: boolean
}): InventoryItemUseResult {
  const definition = getItemDefinition(params.itemDefinitionId)
  if (!isUsableItemDefinition(definition)) {
    return {
      used: false,
      health: params.health,
      mana: params.mana,
      poisoned: params.poisoned,
      guardDurationMs: 0,
      statBuffDurationMs: 0,
      cooldownMs: 0,
      status: `${definition.name} cannot be used right now`,
    }
  }

  if (
    !definition.healAmount &&
    !definition.manaAmount &&
    !definition.curesPoison &&
    !definition.guardDurationMs &&
    !definition.statBuffDurationMs
  ) {
    return {
      used: false,
      health: params.health,
      mana: params.mana,
      poisoned: params.poisoned,
      guardDurationMs: 0,
      statBuffDurationMs: 0,
      cooldownMs: 0,
      status: `${definition.name} cannot be used right now`,
    }
  }

  if (definition.healAmount && params.health >= params.maxHealth) {
    return {
      used: false,
      health: params.health,
      mana: params.mana,
      poisoned: params.poisoned,
      guardDurationMs: 0,
      statBuffDurationMs: 0,
      cooldownMs: 0,
      status: 'health already full',
    }
  }

  if (definition.manaAmount && params.mana >= params.maxMana) {
    return {
      used: false,
      health: params.health,
      mana: params.mana,
      poisoned: params.poisoned,
      guardDurationMs: 0,
      statBuffDurationMs: 0,
      cooldownMs: 0,
      status: 'mana already full',
    }
  }

  if (definition.curesPoison && !params.poisoned) {
    return {
      used: false,
      health: params.health,
      mana: params.mana,
      poisoned: params.poisoned,
      guardDurationMs: 0,
      statBuffDurationMs: 0,
      cooldownMs: 0,
      status: 'no poison to cure',
    }
  }

  const removedItem = removeSingleItemByDefinition(params.inventory, params.itemDefinitionId)
  if (!removedItem) {
    return {
      used: false,
      health: params.health,
      mana: params.mana,
      poisoned: params.poisoned,
      guardDurationMs: 0,
      statBuffDurationMs: 0,
      cooldownMs: 0,
      status: `no ${definition.name} to use`,
    }
  }

  const healAmount = definition.healAmount ?? 0
  const manaAmount = definition.manaAmount ?? 0
  const nextHealth = Math.min(params.maxHealth, params.health + healAmount)
  const nextMana = Math.min(params.maxMana, params.mana + manaAmount)
  const healed = nextHealth - params.health
  const restoredMana = nextMana - params.mana
  const curedPoison = definition.curesPoison && params.poisoned
  const guardDurationMs = definition.guardDurationMs ?? 0
  const statBuffDurationMs = definition.statBuffDurationMs ?? 0
  const cooldownMs = definition.cooldownMs ?? 0
  const effects = [
    healed > 0 ? `+${healed} health` : null,
    restoredMana > 0 ? `+${restoredMana} mana` : null,
    curedPoison ? 'cured poison' : null,
    guardDurationMs > 0 ? `guard ${Math.floor(guardDurationMs / 1000)}s` : null,
    statBuffDurationMs > 0 && definition.statModifiers ? `buff ${Math.floor(statBuffDurationMs / 1000)}s` : null,
  ].filter(Boolean)

  return {
    used: true,
    health: nextHealth,
    mana: nextMana,
    poisoned: definition.curesPoison ? false : params.poisoned,
    guardDurationMs,
    statModifiers: definition.statModifiers,
    statBuffDurationMs,
    statBuffItemDefinitionId: statBuffDurationMs > 0 ? definition.id : undefined,
    cooldownGroup: definition.cooldownGroup,
    cooldownMs,
    status: `used ${definition.name}: ${effects.join(', ')}`,
  }
}

export function triggerTrap(params: {
  trap: Trap | undefined
  now: number
  trapRearmMs: number
  trapDamageAmount: number
  health: number
  poisoned: boolean
  guardActive: boolean
}): {
  triggered: boolean
  health: number
  poisoned: boolean
  poisonedDurationMs: number
  slowDurationMs: number
  slowStatModifiers: CharacterStatModifier
  status: string
} {
  const { trap, now, trapRearmMs, trapDamageAmount, health } = params
  if (!trap || health <= 0) {
    return {
      triggered: false,
      health,
      poisoned: params.poisoned,
      poisonedDurationMs: 0,
      slowDurationMs: 0,
      slowStatModifiers: TRAP_SLOW_STAT_MODIFIERS,
      status: '',
    }
  }

  if (now - trap.lastTriggeredAt < trapRearmMs) {
    return {
      triggered: false,
      health,
      poisoned: params.poisoned,
      poisonedDurationMs: 0,
      slowDurationMs: 0,
      slowStatModifiers: TRAP_SLOW_STAT_MODIFIERS,
      status: '',
    }
  }

  trap.lastTriggeredAt = now
  const appliedDamage = params.guardActive ? Math.ceil(trapDamageAmount * 0.5) : trapDamageAmount
  const nextHealth = Math.max(0, health - appliedDamage)
  const poisoned = nextHealth > 0 ? true : params.poisoned

  return {
    triggered: true,
    health: nextHealth,
    poisoned,
    poisonedDurationMs: nextHealth > 0 ? TRAP_POISON_DURATION_MS : 0,
    slowDurationMs: nextHealth > 0 ? TRAP_SLOW_DURATION_MS : 0,
    slowStatModifiers: TRAP_SLOW_STAT_MODIFIERS,
    status: nextHealth <= 0
      ? `triggered trap: -${appliedDamage} health, died`
      : `triggered trap: -${appliedDamage} health${poisoned && !params.poisoned ? ', poisoned' : ''}, slowed`,
  }
}

export function isGuardActive(guardBuffUntil: number, now: number): boolean {
  return guardBuffUntil > now
}

export function applyDebugDamage(health: number, damageAmount: number): { health: number; status: string } {
  if (health <= 0) {
    return {
      health,
      status: 'already at 0 health',
    }
  }

  const nextHealth = Math.max(0, health - damageAmount)
  return {
    health: nextHealth,
    status: nextHealth <= 0
      ? `took ${damageAmount} damage and died`
      : `took ${damageAmount} damage`,
  }
}

export function getRespawnPosition(spawnTile: { x: number; y: number }): { x: number; y: number } {
  return cellCenter(spawnTile.x, spawnTile.y)
}

export function getRespawnHealth(maxHealth: number, respawnHealthRatio: number): number {
  return Math.max(1, Math.floor(maxHealth * respawnHealthRatio))
}
