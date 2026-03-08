import type { ActiveItemBuffRuntime, ActiveItemBuffSnapshot } from '../items/ItemStatRules'
import type { ItemCooldownRuntime, ItemCooldownSnapshot } from '../items/ItemCooldownRules'
import type { TimedModifierRuntime, TimedModifierSnapshot } from './TimedModifierRules'
import type { EffectRuntimeState } from './EffectRuntimeProtocol'

export const DEFAULT_POISON_DAMAGE_PER_SECOND = 3

export interface EffectRuntimeSceneState {
  nowMs: number
  healthRegenRemainder: number
  manaRegenRemainder: number
  poisonedRemainingMs: number
  poisonDamageRemainder: number
  activeItemBuffs: ActiveItemBuffRuntime[]
  itemCooldowns: ItemCooldownRuntime[]
  timedModifiers: TimedModifierRuntime[]
}

export interface EffectRuntimeProgressData {
  poisonedRemainingMs: number
  activeItemBuffs: ActiveItemBuffSnapshot[]
  itemCooldowns: ItemCooldownSnapshot[]
  timedModifiers: TimedModifierSnapshot[]
}

export function createInitialEffectRuntimeSceneState(nowMs: number): EffectRuntimeSceneState {
  return {
    nowMs,
    healthRegenRemainder: 0,
    manaRegenRemainder: 0,
    poisonedRemainingMs: 0,
    poisonDamageRemainder: 0,
    activeItemBuffs: [],
    itemCooldowns: [],
    timedModifiers: [],
  }
}

export function buildEffectRuntimeState(params: {
  sceneState: EffectRuntimeSceneState
  health: number
  maxHealth: number
  healthRegen: number
  mana: number
  maxMana: number
  manaRegen: number
  poisoned: boolean
  guardBuffRemainingMs: number
  poisonDamagePerSecond?: number
}): EffectRuntimeState {
  return {
    currentTimeMs: params.sceneState.nowMs,
    health: params.health,
    maxHealth: params.maxHealth,
    healthRegen: params.healthRegen,
    healthRegenRemainder: params.sceneState.healthRegenRemainder,
    mana: params.mana,
    maxMana: params.maxMana,
    manaRegen: params.manaRegen,
    manaRegenRemainder: params.sceneState.manaRegenRemainder,
    poisoned: params.poisoned,
    poisonedRemainingMs: params.sceneState.poisonedRemainingMs,
    poisonDamagePerSecond: params.poisonDamagePerSecond ?? DEFAULT_POISON_DAMAGE_PER_SECOND,
    poisonDamageRemainder: params.sceneState.poisonDamageRemainder,
    guardBuffRemainingMs: params.guardBuffRemainingMs,
    activeItemBuffs: params.sceneState.activeItemBuffs,
    itemCooldowns: params.sceneState.itemCooldowns,
    timedModifiers: params.sceneState.timedModifiers,
  }
}

export function applyEffectRuntimeWorkerState(
  sceneState: EffectRuntimeSceneState,
  nextState: EffectRuntimeState
): void {
  sceneState.nowMs = nextState.currentTimeMs
  sceneState.healthRegenRemainder = nextState.healthRegenRemainder
  sceneState.manaRegenRemainder = nextState.manaRegenRemainder
  sceneState.poisonedRemainingMs = nextState.poisonedRemainingMs
  sceneState.poisonDamageRemainder = nextState.poisonDamageRemainder
  sceneState.activeItemBuffs = nextState.activeItemBuffs
  sceneState.itemCooldowns = nextState.itemCooldowns
  sceneState.timedModifiers = nextState.timedModifiers
}

export function createEffectRuntimeProgressData(
  sceneState: EffectRuntimeSceneState,
  serialize: {
    activeItemBuffs: (activeItemBuffs: ActiveItemBuffRuntime[], nowMs: number) => ActiveItemBuffSnapshot[]
    itemCooldowns: (itemCooldowns: ItemCooldownRuntime[], nowMs: number) => ItemCooldownSnapshot[]
    timedModifiers: (timedModifiers: TimedModifierRuntime[], nowMs: number) => TimedModifierSnapshot[]
  }
): EffectRuntimeProgressData {
  return {
    poisonedRemainingMs: sceneState.poisonedRemainingMs,
    activeItemBuffs: serialize.activeItemBuffs(sceneState.activeItemBuffs, sceneState.nowMs),
    itemCooldowns: serialize.itemCooldowns(sceneState.itemCooldowns, sceneState.nowMs),
    timedModifiers: serialize.timedModifiers(sceneState.timedModifiers, sceneState.nowMs),
  }
}

export function getActiveBuffSummaryText(params: {
  sceneState: EffectRuntimeSceneState
  getItemLabel: (itemDefinitionId: string) => string
}): string {
  const activeBuffs = params.sceneState.activeItemBuffs
    .filter(buff => buff.expiresAt > params.sceneState.nowMs)
    .map(buff => `${params.getItemLabel(buff.itemDefinitionId)} ${((buff.expiresAt - params.sceneState.nowMs) / 1000).toFixed(1)}s`)

  return activeBuffs.length > 0 ? activeBuffs.join(', ') : 'none'
}

export function getActiveDebuffSummaryText(params: {
  sceneState: EffectRuntimeSceneState
  poisonDamagePerSecond?: number
}): string {
  const debuffs: string[] = []

  if (params.sceneState.poisonedRemainingMs > 0) {
    debuffs.push(
      `poison ${(params.sceneState.poisonedRemainingMs / 1000).toFixed(1)}s @${(params.poisonDamagePerSecond ?? DEFAULT_POISON_DAMAGE_PER_SECOND).toFixed(1)}/s`
    )
  }

  for (const modifier of params.sceneState.timedModifiers) {
    if (modifier.expiresAt <= params.sceneState.nowMs) {
      continue
    }

    debuffs.push(`${modifier.id} ${((modifier.expiresAt - params.sceneState.nowMs) / 1000).toFixed(1)}s`)
  }

  return debuffs.length > 0 ? debuffs.join(', ') : 'none'
}

export function getItemCooldownSummaryText(sceneState: EffectRuntimeSceneState): string {
  const activeCooldowns = sceneState.itemCooldowns
    .filter(cooldown => cooldown.expiresAt > sceneState.nowMs)
    .map(cooldown => `${cooldown.group} ${((cooldown.expiresAt - sceneState.nowMs) / 1000).toFixed(1)}s`)

  return activeCooldowns.length > 0 ? activeCooldowns.join(', ') : 'none'
}

export function areEffectRuntimeStatesEqual(a: EffectRuntimeState, b: EffectRuntimeState): boolean {
  return a.currentTimeMs === b.currentTimeMs &&
    a.health === b.health &&
    a.maxHealth === b.maxHealth &&
    a.healthRegen === b.healthRegen &&
    a.healthRegenRemainder === b.healthRegenRemainder &&
    a.mana === b.mana &&
    a.maxMana === b.maxMana &&
    a.manaRegen === b.manaRegen &&
    a.manaRegenRemainder === b.manaRegenRemainder &&
    a.poisoned === b.poisoned &&
    a.poisonedRemainingMs === b.poisonedRemainingMs &&
    a.poisonDamagePerSecond === b.poisonDamagePerSecond &&
    a.poisonDamageRemainder === b.poisonDamageRemainder &&
    a.guardBuffRemainingMs === b.guardBuffRemainingMs &&
    areActiveItemBuffsEqual(a.activeItemBuffs, b.activeItemBuffs) &&
    areItemCooldownsEqual(a.itemCooldowns, b.itemCooldowns) &&
    areTimedModifiersEqual(a.timedModifiers, b.timedModifiers)
}

function areActiveItemBuffsEqual(a: ActiveItemBuffRuntime[], b: ActiveItemBuffRuntime[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  for (let index = 0; index < a.length; index++) {
    if (a[index].itemDefinitionId !== b[index].itemDefinitionId || a[index].expiresAt !== b[index].expiresAt) {
      return false
    }
  }

  return true
}

function areItemCooldownsEqual(a: ItemCooldownRuntime[], b: ItemCooldownRuntime[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  for (let index = 0; index < a.length; index++) {
    if (a[index].group !== b[index].group || a[index].expiresAt !== b[index].expiresAt) {
      return false
    }
  }

  return true
}

function areTimedModifiersEqual(a: TimedModifierRuntime[], b: TimedModifierRuntime[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  for (let index = 0; index < a.length; index++) {
    if (a[index].id !== b[index].id || a[index].expiresAt !== b[index].expiresAt) {
      return false
    }

    const aEntries = Object.entries(a[index].modifiers)
    const bEntries = Object.entries(b[index].modifiers)
    if (aEntries.length !== bEntries.length) {
      return false
    }

    for (const [key, value] of aEntries) {
      const targetModifiers = b[index].modifiers as Record<string, number | undefined>
      if (targetModifiers[key] !== value) {
        return false
      }
    }
  }

  return true
}
