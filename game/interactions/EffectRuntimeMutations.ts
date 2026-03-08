import type { ItemCooldownGroup } from '../items/ItemCatalog'
import type { EffectRuntimeSceneState } from './EffectRuntimeSceneBridge'
import {
  DEBUFF_EFFECT_IDS,
  getDebuffEffectDefinition,
} from './EffectDefinitions'
import {
  clearEffectDebuffById,
  restoreEffectDebuffs,
  serializeEffectDebuffs,
  upsertEffectDebuff,
  type EffectDebuffRuntime,
  type EffectDebuffSnapshot,
} from './EffectDebuffRules'
import type { CharacterStatModifier } from '../characters/CharacterStatRules'
import type { ActiveItemBuffRuntime } from '../items/ItemStatRules'
import type { ItemCooldownRuntime } from '../items/ItemCooldownRules'

export const POISON_DEBUFF_ID = DEBUFF_EFFECT_IDS.poison
export const TRAP_SLOW_DEBUFF_ID = DEBUFF_EFFECT_IDS.trapSlow

export function applyTrapRuntimeEffects(params: {
  sceneState: EffectRuntimeSceneState
  nowMs: number
  poisonedDurationMs: number
  poisonDamagePerSecond: number
  slowDurationMs: number
  slowStatModifiers: CharacterStatModifier
}): void {
  if (params.poisonedDurationMs > 0) {
    const definition = getDebuffEffectDefinition(POISON_DEBUFF_ID)
    const resolved = definition.describe({
      remainingMs: params.poisonedDurationMs,
      damagePerSecond: params.poisonDamagePerSecond,
    })
    params.sceneState.activeDebuffs = upsertEffectDebuff({
      debuffs: params.sceneState.activeDebuffs,
      id: POISON_DEBUFF_ID,
      displayName: resolved.title,
      durationMs: params.poisonedDurationMs,
      nowMs: params.nowMs,
      damagePerSecond: params.poisonDamagePerSecond,
      blocksHealthRegen: true,
      guardMitigatesDamage: true,
    })
  }

  if (params.slowDurationMs > 0) {
    const definition = getDebuffEffectDefinition(TRAP_SLOW_DEBUFF_ID)
    const resolved = definition.describe({
      remainingMs: params.slowDurationMs,
      statModifiers: params.slowStatModifiers,
    })
    params.sceneState.activeDebuffs = upsertEffectDebuff({
      debuffs: params.sceneState.activeDebuffs,
      id: TRAP_SLOW_DEBUFF_ID,
      displayName: resolved.title,
      durationMs: params.slowDurationMs,
      nowMs: params.nowMs,
      statModifiers: params.slowStatModifiers,
    })
  }
}

export function clearEffectRuntimeDebuffs(sceneState: EffectRuntimeSceneState): void {
  sceneState.activeDebuffs = []
}

export function clearPoisonRuntime(sceneState: EffectRuntimeSceneState, nowMs: number): void {
  sceneState.activeDebuffs = clearEffectDebuffById(sceneState.activeDebuffs, POISON_DEBUFF_ID, nowMs)
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
    clearPoisonRuntime(params.sceneState, params.nowMs)
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
  restoreActiveItemBuffs: (nowMs: number) => ActiveItemBuffRuntime[]
  restoreItemCooldowns: (nowMs: number) => ItemCooldownRuntime[]
  restoreActiveDebuffs: (nowMs: number) => EffectDebuffRuntime[]
}): void {
  params.sceneState.nowMs = params.nowMs
  params.sceneState.healthRegenRemainder = 0
  params.sceneState.manaRegenRemainder = 0
  params.sceneState.activeItemBuffs = params.restoreActiveItemBuffs(params.nowMs)
  params.sceneState.itemCooldowns = params.restoreItemCooldowns(params.nowMs)
  params.sceneState.activeDebuffs = params.restoreActiveDebuffs(params.nowMs)
}

export function createEffectRuntimeDebuffPersistence(params: {
  sceneState: EffectRuntimeSceneState
  nowMs: number
}): EffectDebuffSnapshot[] {
  return serializeEffectDebuffs(params.sceneState.activeDebuffs, params.nowMs)
}

export function restoreEffectRuntimeDebuffPersistence(
  snapshots: EffectDebuffSnapshot[],
  nowMs: number
): EffectDebuffRuntime[] {
  return restoreEffectDebuffs(snapshots, nowMs)
}
