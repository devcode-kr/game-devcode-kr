import { tickRegeneration } from '../characters/CharacterRegenRules'
import { pruneExpiredItemCooldowns } from '../items/ItemCooldownRules'
import type { ActiveItemBuffRuntime } from '../items/ItemStatRules'
import type { EffectRuntimeState } from './EffectRuntimeProtocol'
import { tickDamageOverTime } from './EffectDamageRules'
import { pruneExpiredTimedModifiers } from './TimedModifierRules'

export function advanceEffectRuntimeByTick(
  state: EffectRuntimeState,
  tickMs: number
): EffectRuntimeState {
  // Resolve sustained effects in a deterministic order:
  // 1) expire timed state, 2) apply DoT, 3) apply HP regen/HoT, 4) apply mana regen.
  const nextTimeMs = state.currentTimeMs + tickMs
  const activeItemBuffs = pruneExpiredActiveBuffs(state.activeItemBuffs, nextTimeMs)
  const itemCooldowns = pruneExpiredItemCooldowns(state.itemCooldowns, nextTimeMs)
  const timedModifiers = pruneExpiredTimedModifiers(state.timedModifiers, nextTimeMs)
  const guardBuffRemainingMs = Math.max(0, state.guardBuffRemainingMs - tickMs)
  const poisonedRemainingMs = Math.max(0, state.poisonedRemainingMs - tickMs)
  const poisonTick = tickDamageOverTime({
    currentValue: state.health,
    damagePerSecond: poisonedRemainingMs > 0 ? state.poisonDamagePerSecond : 0,
    deltaMs: tickMs,
    remainder: state.poisonDamageRemainder,
  })

  const healthTick = tickRegeneration({
    currentValue: poisonTick.nextValue,
    maxValue: state.maxHealth,
    regenPerSecond: poisonedRemainingMs > 0 ? 0 : state.healthRegen,
    deltaMs: tickMs,
    remainder: state.healthRegenRemainder,
  })
  const manaTick = tickRegeneration({
    currentValue: state.mana,
    maxValue: state.maxMana,
    regenPerSecond: state.manaRegen,
    deltaMs: tickMs,
    remainder: state.manaRegenRemainder,
  })

  return {
    ...state,
    currentTimeMs: nextTimeMs,
    health: healthTick.nextValue,
    healthRegenRemainder: healthTick.remainder,
    mana: manaTick.nextValue,
    manaRegenRemainder: manaTick.remainder,
    poisoned: poisonedRemainingMs > 0 && healthTick.nextValue > 0,
    poisonedRemainingMs: healthTick.nextValue > 0 ? poisonedRemainingMs : 0,
    poisonDamagePerSecond: state.poisonDamagePerSecond,
    poisonDamageRemainder: healthTick.nextValue > 0 ? poisonTick.remainder : 0,
    guardBuffRemainingMs,
    activeItemBuffs,
    itemCooldowns,
    timedModifiers,
  }
}

function pruneExpiredActiveBuffs(
  activeItemBuffs: ActiveItemBuffRuntime[],
  nowMs: number
): ActiveItemBuffRuntime[] {
  return activeItemBuffs.filter(buff => buff.expiresAt > nowMs)
}
