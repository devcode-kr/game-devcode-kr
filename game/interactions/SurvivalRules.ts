import { cellCenter } from '../iso'
import { getItemDefinition } from '../items/ItemCatalog'
import { removeSingleItemByDefinition, type InventoryState } from '../items/Inventory'
import type { Trap } from '../world/WorldObjects'

export function isDead(health: number): boolean {
  return health <= 0
}

export function tryUsePotion(params: {
  inventory: InventoryState
  health: number
  maxHealth: number
}): { used: boolean; health: number; status: string } {
  if (params.health >= params.maxHealth) {
    return {
      used: false,
      health: params.health,
      status: 'health already full',
    }
  }

  const removedItem = removeSingleItemByDefinition(params.inventory, 'potion_minor')
  if (!removedItem) {
    return {
      used: false,
      health: params.health,
      status: 'no potion to use',
    }
  }

  const potionDefinition = getItemDefinition('potion_minor')
  const healAmount = potionDefinition.healAmount ?? 0
  const nextHealth = Math.min(params.maxHealth, params.health + healAmount)
  const healed = nextHealth - params.health

  return {
    used: true,
    health: nextHealth,
    status: `used ${potionDefinition.name}: +${healed} health`,
  }
}

export function triggerTrap(params: {
  trap: Trap | undefined
  now: number
  trapRearmMs: number
  trapDamageAmount: number
  health: number
}): { triggered: boolean; health: number; status: string } {
  const { trap, now, trapRearmMs, trapDamageAmount, health } = params
  if (!trap || health <= 0) {
    return { triggered: false, health, status: '' }
  }

  if (now - trap.lastTriggeredAt < trapRearmMs) {
    return { triggered: false, health, status: '' }
  }

  trap.lastTriggeredAt = now
  const nextHealth = Math.max(0, health - trapDamageAmount)

  return {
    triggered: true,
    health: nextHealth,
    status: nextHealth <= 0
      ? `triggered trap: -${trapDamageAmount} health, died`
      : `triggered trap: -${trapDamageAmount} health`,
  }
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
