import type { ActiveItemBuffRuntime, ActiveItemBuffSnapshot } from '../items/ItemStatRules'
import type { ItemCooldownRuntime, ItemCooldownSnapshot } from '../items/ItemCooldownRules'
import type { EffectRuntimeState } from './EffectRuntimeProtocol'
import type { EffectDebuffRuntime, EffectDebuffSnapshot } from './EffectDebuffRules'

export interface EffectRuntimeSceneState {
  nowMs: number
  healthRegenRemainder: number
  manaRegenRemainder: number
  activeItemBuffs: ActiveItemBuffRuntime[]
  itemCooldowns: ItemCooldownRuntime[]
  activeDebuffs: EffectDebuffRuntime[]
}

export interface EffectRuntimeProgressData {
  activeItemBuffs: ActiveItemBuffSnapshot[]
  itemCooldowns: ItemCooldownSnapshot[]
  activeDebuffs: EffectDebuffSnapshot[]
}

export function createInitialEffectRuntimeSceneState(nowMs: number): EffectRuntimeSceneState {
  return {
    nowMs,
    healthRegenRemainder: 0,
    manaRegenRemainder: 0,
    activeItemBuffs: [],
    itemCooldowns: [],
    activeDebuffs: [],
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
    guardBuffRemainingMs: params.guardBuffRemainingMs,
    activeItemBuffs: params.sceneState.activeItemBuffs,
    itemCooldowns: params.sceneState.itemCooldowns,
    activeDebuffs: params.sceneState.activeDebuffs,
  }
}

export function applyEffectRuntimeWorkerState(
  sceneState: EffectRuntimeSceneState,
  nextState: EffectRuntimeState
): void {
  sceneState.nowMs = nextState.currentTimeMs
  sceneState.healthRegenRemainder = nextState.healthRegenRemainder
  sceneState.manaRegenRemainder = nextState.manaRegenRemainder
  sceneState.activeItemBuffs = nextState.activeItemBuffs
  sceneState.itemCooldowns = nextState.itemCooldowns
  sceneState.activeDebuffs = nextState.activeDebuffs
}

export function createEffectRuntimeProgressData(
  sceneState: EffectRuntimeSceneState,
  serialize: {
    activeItemBuffs: (activeItemBuffs: ActiveItemBuffRuntime[], nowMs: number) => ActiveItemBuffSnapshot[]
    itemCooldowns: (itemCooldowns: ItemCooldownRuntime[], nowMs: number) => ItemCooldownSnapshot[]
    activeDebuffs: (activeDebuffs: EffectDebuffRuntime[], nowMs: number) => EffectDebuffSnapshot[]
  }
): EffectRuntimeProgressData {
  return {
    activeItemBuffs: serialize.activeItemBuffs(sceneState.activeItemBuffs, sceneState.nowMs),
    itemCooldowns: serialize.itemCooldowns(sceneState.itemCooldowns, sceneState.nowMs),
    activeDebuffs: serialize.activeDebuffs(sceneState.activeDebuffs, sceneState.nowMs),
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

export function getActiveDebuffSummaryText(sceneState: EffectRuntimeSceneState): string {
  const debuffs = sceneState.activeDebuffs
    .filter(debuff => debuff.expiresAt > sceneState.nowMs)
    .map(debuff => {
      const parts = [`${debuff.displayName} ${((debuff.expiresAt - sceneState.nowMs) / 1000).toFixed(1)}s`]
      if (debuff.damagePerSecond) {
        parts.push(`@${debuff.damagePerSecond.toFixed(1)}/s`)
      }
      return parts.join(' ')
    })

  return debuffs.length > 0 ? debuffs.join(', ') : 'none'
}

export function getItemCooldownSummaryText(sceneState: EffectRuntimeSceneState): string {
  const activeCooldowns = sceneState.itemCooldowns
    .filter(cooldown => cooldown.expiresAt > sceneState.nowMs)
    .map(cooldown => `${cooldown.group} ${((cooldown.expiresAt - sceneState.nowMs) / 1000).toFixed(1)}s`)

  return activeCooldowns.length > 0 ? activeCooldowns.join(', ') : 'none'
}

export function getActiveDebuffStatModifiers(sceneState: EffectRuntimeSceneState) {
  return sceneState.activeDebuffs
    .filter(debuff => debuff.expiresAt > sceneState.nowMs && debuff.statModifiers)
    .map(debuff => debuff.statModifiers!)
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
    a.guardBuffRemainingMs === b.guardBuffRemainingMs &&
    areActiveItemBuffsEqual(a.activeItemBuffs, b.activeItemBuffs) &&
    areItemCooldownsEqual(a.itemCooldowns, b.itemCooldowns) &&
    areActiveDebuffsEqual(a.activeDebuffs, b.activeDebuffs)
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

function areActiveDebuffsEqual(a: EffectDebuffRuntime[], b: EffectDebuffRuntime[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  for (let index = 0; index < a.length; index++) {
    const left = a[index]
    const right = b[index]
    if (
      left.id !== right.id ||
      left.displayName !== right.displayName ||
      left.expiresAt !== right.expiresAt ||
      left.damagePerSecond !== right.damagePerSecond ||
      left.damageRemainder !== right.damageRemainder ||
      left.blocksHealthRegen !== right.blocksHealthRegen ||
      left.guardMitigatesDamage !== right.guardMitigatesDamage
    ) {
      return false
    }

    const leftEntries = Object.entries(left.statModifiers ?? {})
    const rightEntries = Object.entries(right.statModifiers ?? {})
    if (leftEntries.length !== rightEntries.length) {
      return false
    }

    for (const [key, value] of leftEntries) {
      const target = right.statModifiers as Record<string, number | undefined> | undefined
      if ((target?.[key] ?? undefined) !== value) {
        return false
      }
    }
  }

  return true
}
