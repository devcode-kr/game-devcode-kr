import type { ActiveItemBuffRuntime } from '../items/ItemStatRules'
import type { ItemCooldownRuntime } from '../items/ItemCooldownRules'
import type { TimedModifierRuntime } from './TimedModifierRules'

export interface EffectRuntimeState {
  currentTimeMs: number
  health: number
  maxHealth: number
  healthRegen: number
  healthRegenRemainder: number
  mana: number
  maxMana: number
  manaRegen: number
  manaRegenRemainder: number
  poisoned: boolean
  poisonedRemainingMs: number
  poisonDamagePerSecond: number
  poisonDamageRemainder: number
  guardBuffRemainingMs: number
  activeItemBuffs: ActiveItemBuffRuntime[]
  itemCooldowns: ItemCooldownRuntime[]
  timedModifiers: TimedModifierRuntime[]
}

export type EffectRuntimeCommand =
  | {
      type: 'init'
      revision: number
      tickMs: number
      state: EffectRuntimeState
    }
  | {
      type: 'advance'
      revision: number
      deltaMs: number
    }
  | {
      type: 'sync-state'
      revision: number
      state: EffectRuntimeState
    }

export type EffectRuntimeEvent = {
  type: 'state'
  revision: number
  state: EffectRuntimeState
}
