import type { InventoryState } from '../items/Inventory'
import { getItemDefinition, type ItemCooldownGroup } from '../items/ItemCatalog'
import {
  getItemCooldownRemainingMs,
  isItemCooldownActive,
  setItemCooldown,
  type ItemCooldownRuntime,
} from '../items/ItemCooldownRules'
import {
  upsertActiveItemBuff,
  type ActiveItemBuffRuntime,
} from '../items/ItemStatRules'
import type { EffectRuntimeSceneState } from './EffectRuntimeSceneBridge'
import { applyConsumableRuntimeEffects } from './EffectRuntimeMutations'
import { applyInventoryItemUse } from './SurvivalRules'

export interface InventoryItemUseFlowResult {
  used: boolean
  status: string
  health: number
  mana: number
  poisoned: boolean
  guardDurationMs: number
}

export function runInventoryItemUseFlow(params: {
  beltInventory: InventoryState
  inventory: InventoryState
  itemDefinitionId: string
  health: number
  maxHealth: number
  mana: number
  maxMana: number
  poisoned: boolean
  effectNowMs: number
  effectRuntimeSceneState: EffectRuntimeSceneState
}): InventoryItemUseFlowResult {
  const definition = getItemDefinition(params.itemDefinitionId)

  if (
    definition.cooldownGroup &&
    isItemCooldownActive(
      params.effectRuntimeSceneState.itemCooldowns,
      definition.cooldownGroup,
      params.effectNowMs
    )
  ) {
    const remainingMs = getItemCooldownRemainingMs(
      params.effectRuntimeSceneState.itemCooldowns,
      definition.cooldownGroup,
      params.effectNowMs
    )

    return {
      used: false,
      status: `${definition.name} cooldown: ${(remainingMs / 1000).toFixed(1)}s`,
      health: params.health,
      mana: params.mana,
      poisoned: params.poisoned,
      guardDurationMs: 0,
    }
  }

  const attempt = attemptInventoryUse({
    inventory: params.beltInventory,
    itemDefinitionId: params.itemDefinitionId,
    health: params.health,
    maxHealth: params.maxHealth,
    mana: params.mana,
    maxMana: params.maxMana,
    poisoned: params.poisoned,
  })

  if (attempt.used) {
    applyConsumableUseToRuntime({
      effectRuntimeSceneState: params.effectRuntimeSceneState,
      effectNowMs: params.effectNowMs,
      poisoned: attempt.poisoned,
      statBuffDurationMs: attempt.statBuffDurationMs,
      statBuffItemDefinitionId: attempt.statBuffItemDefinitionId,
      cooldownGroup: attempt.cooldownGroup,
      cooldownMs: attempt.cooldownMs,
    })

    return {
      used: true,
      status: attempt.status,
      health: attempt.health,
      mana: attempt.mana,
      poisoned: attempt.poisoned,
      guardDurationMs: attempt.guardDurationMs,
    }
  }

  const fallbackAttempt = attemptInventoryUse({
    inventory: params.inventory,
    itemDefinitionId: params.itemDefinitionId,
    health: params.health,
    maxHealth: params.maxHealth,
    mana: params.mana,
    maxMana: params.maxMana,
    poisoned: params.poisoned,
  })

  if (fallbackAttempt.used) {
    applyConsumableUseToRuntime({
      effectRuntimeSceneState: params.effectRuntimeSceneState,
      effectNowMs: params.effectNowMs,
      poisoned: fallbackAttempt.poisoned,
      statBuffDurationMs: fallbackAttempt.statBuffDurationMs,
      statBuffItemDefinitionId: fallbackAttempt.statBuffItemDefinitionId,
      cooldownGroup: fallbackAttempt.cooldownGroup,
      cooldownMs: fallbackAttempt.cooldownMs,
    })
  }

  return {
    used: fallbackAttempt.used,
    status: fallbackAttempt.status,
    health: fallbackAttempt.health,
    mana: fallbackAttempt.mana,
    poisoned: fallbackAttempt.poisoned,
    guardDurationMs: fallbackAttempt.guardDurationMs,
  }
}

function attemptInventoryUse(params: {
  inventory: InventoryState
  itemDefinitionId: string
  health: number
  maxHealth: number
  mana: number
  maxMana: number
  poisoned: boolean
}) {
  return applyInventoryItemUse(params)
}

function applyConsumableUseToRuntime(params: {
  effectRuntimeSceneState: EffectRuntimeSceneState
  effectNowMs: number
  poisoned: boolean
  statBuffDurationMs: number
  statBuffItemDefinitionId?: string
  cooldownGroup?: ItemCooldownGroup
  cooldownMs: number
}): void {
  applyConsumableRuntimeEffects({
    sceneState: params.effectRuntimeSceneState,
    nowMs: params.effectNowMs,
    poisoned: params.poisoned,
    statBuffDurationMs: params.statBuffDurationMs,
    statBuffItemDefinitionId: params.statBuffItemDefinitionId,
    cooldownGroup: params.cooldownGroup,
    cooldownMs: params.cooldownMs,
    upsertActiveItemBuff: upsertActiveItemBuffForRuntime,
    setItemCooldown: setItemCooldownForRuntime,
  })
}

function upsertActiveItemBuffForRuntime(params: {
  activeBuffs: ActiveItemBuffRuntime[]
  itemDefinitionId: string
  durationMs: number
  now: number
  group?: ItemCooldownGroup
}): ActiveItemBuffRuntime[] {
  return upsertActiveItemBuff(params)
}

function setItemCooldownForRuntime(
  cooldowns: ItemCooldownRuntime[],
  group: ItemCooldownGroup,
  durationMs: number,
  now: number
): ItemCooldownRuntime[] {
  return setItemCooldown(cooldowns, group, durationMs, now)
}
