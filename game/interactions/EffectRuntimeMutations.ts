import type { ItemCooldownGroup } from '../items/ItemCatalog'
import type { EffectRuntimeSceneState } from './EffectRuntimeSceneBridge'
import { upsertTimedModifier, type TimedModifierRuntime } from './TimedModifierRules'
import type { CharacterStatModifier } from '../characters/CharacterStatRules'
import type { ActiveItemBuffRuntime } from '../items/ItemStatRules'
import type { ItemCooldownRuntime } from '../items/ItemCooldownRules'

export function applyTrapRuntimeEffects(params: {
  sceneState: EffectRuntimeSceneState
  nowMs: number
  poisonedDurationMs: number
  slowDurationMs: number
  slowStatModifiers: CharacterStatModifier
}): void {
  if (params.slowDurationMs > 0) {
    params.sceneState.timedModifiers = upsertTimedModifier({
      modifiers: params.sceneState.timedModifiers,
      id: 'trap_slow',
      durationMs: params.slowDurationMs,
      now: params.nowMs,
      statModifiers: params.slowStatModifiers,
    })
  }

  params.sceneState.poisonedRemainingMs = Math.max(
    params.sceneState.poisonedRemainingMs,
    params.poisonedDurationMs
  )

  if (params.poisonedDurationMs > 0) {
    params.sceneState.poisonDamageRemainder = 0
  }
}

export function clearEffectRuntimeDebuffs(sceneState: EffectRuntimeSceneState): void {
  sceneState.poisonedRemainingMs = 0
  sceneState.poisonDamageRemainder = 0
  sceneState.timedModifiers = []
}

export function clearPoisonRuntime(sceneState: EffectRuntimeSceneState): void {
  sceneState.poisonedRemainingMs = 0
  sceneState.poisonDamageRemainder = 0
}

export function applyConsumableRuntimeEffects(params: {
  sceneState: EffectRuntimeSceneState
  nowMs: number
  poisoned: boolean
  statBuffDurationMs: number
  statBuffItemDefinitionId?: string
  cooldownGroup?: ItemCooldownGroup
  cooldownMs: number
  upsertActiveItemBuff: (input: {
    activeBuffs: ActiveItemBuffRuntime[]
    itemDefinitionId: string
    durationMs: number
    now: number
    group?: ItemCooldownGroup
  }) => ActiveItemBuffRuntime[]
  setItemCooldown: (
    cooldowns: ItemCooldownRuntime[],
    group: ItemCooldownGroup,
    durationMs: number,
    now: number
  ) => ItemCooldownRuntime[]
}): void {
  if (!params.poisoned) {
    clearPoisonRuntime(params.sceneState)
  }

  if (params.statBuffDurationMs > 0 && params.statBuffItemDefinitionId) {
    params.sceneState.activeItemBuffs = params.upsertActiveItemBuff({
      activeBuffs: params.sceneState.activeItemBuffs,
      itemDefinitionId: params.statBuffItemDefinitionId,
      durationMs: params.statBuffDurationMs,
      now: params.nowMs,
      group: params.cooldownGroup,
    })
  }

  if (params.cooldownGroup && params.cooldownMs > 0) {
    params.sceneState.itemCooldowns = params.setItemCooldown(
      params.sceneState.itemCooldowns,
      params.cooldownGroup,
      params.cooldownMs,
      params.nowMs
    )
  }
}

export function restoreEffectRuntimeCollections(params: {
  sceneState: EffectRuntimeSceneState
  nowMs: number
  poisonedRemainingMs: number
  restoreActiveItemBuffs: (nowMs: number) => ActiveItemBuffRuntime[]
  restoreItemCooldowns: (nowMs: number) => ItemCooldownRuntime[]
  restoreTimedModifiers: (nowMs: number) => TimedModifierRuntime[]
}): void {
  params.sceneState.nowMs = params.nowMs
  params.sceneState.healthRegenRemainder = 0
  params.sceneState.manaRegenRemainder = 0
  params.sceneState.poisonedRemainingMs = params.poisonedRemainingMs
  params.sceneState.poisonDamageRemainder = 0
  params.sceneState.activeItemBuffs = params.restoreActiveItemBuffs(params.nowMs)
  params.sceneState.itemCooldowns = params.restoreItemCooldowns(params.nowMs)
  params.sceneState.timedModifiers = params.restoreTimedModifiers(params.nowMs)
}
