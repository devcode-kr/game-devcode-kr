import { tickRegeneration } from '../characters/CharacterRegenRules'
import { pruneExpiredItemCooldowns } from '../items/ItemCooldownRules'
import type { ActiveItemBuffRuntime } from '../items/ItemStatRules'
import type { EffectRuntimeState } from './EffectRuntimeProtocol'
import { tickDamageOverTime } from './EffectDamageRules'
import { pruneExpiredEffectDebuffs } from './EffectDebuffRules'

export function advanceEffectRuntimeByTick(
  state: EffectRuntimeState,
  tickMs: number
): EffectRuntimeState {
  // Resolve sustained effects in a deterministic order:
  // 1) expire timed state, 2) apply DoT, 3) apply HP regen/HoT, 4) apply mana regen.
  const nextTimeMs = state.currentTimeMs + tickMs
  const activeItemBuffs = pruneExpiredActiveBuffs(state.activeItemBuffs, nextTimeMs)
  const itemCooldowns = pruneExpiredItemCooldowns(state.itemCooldowns, nextTimeMs)
  const activeDebuffs = pruneExpiredEffectDebuffs(state.activeDebuffs, nextTimeMs)
  const guardBuffRemainingMs = Math.max(0, state.guardBuffRemainingMs - tickMs)
  const guardActive = guardBuffRemainingMs > 0
  const dotTick = applyDebuffDamageTicks(activeDebuffs, state.health, tickMs, guardActive)
  const blocksHealthRegen = activeDebuffs.some(debuff => debuff.blocksHealthRegen)
  const poisoned = activeDebuffs.some(debuff => debuff.id === 'poison')

  const healthTick = tickRegeneration({
    currentValue: dotTick.health,
    maxValue: state.maxHealth,
    regenPerSecond: blocksHealthRegen ? 0 : state.healthRegen,
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
    poisoned: poisoned && healthTick.nextValue > 0,
    guardBuffRemainingMs,
    activeItemBuffs,
    itemCooldowns,
    activeDebuffs: healthTick.nextValue > 0 ? dotTick.debuffs : [],
  }
}

function applyDebuffDamageTicks(
  debuffs: EffectRuntimeState['activeDebuffs'],
  currentHealth: number,
  tickMs: number,
  guardActive: boolean
): { health: number; debuffs: EffectRuntimeState['activeDebuffs'] } {
  let nextHealth = currentHealth
  const nextDebuffs = debuffs.map(debuff => {
    if (!debuff.damagePerSecond || nextHealth <= 0) {
      return debuff
    }

    const effectiveDamagePerSecond = guardActive && debuff.guardMitigatesDamage
      ? debuff.damagePerSecond * 0.5
      : debuff.damagePerSecond

    const damageTick = tickDamageOverTime({
      currentValue: nextHealth,
      damagePerSecond: effectiveDamagePerSecond,
      deltaMs: tickMs,
      remainder: debuff.damageRemainder,
    })
    nextHealth = damageTick.nextValue

    return {
      ...debuff,
      damageRemainder: damageTick.remainder,
    }
  })

  return {
    health: nextHealth,
    debuffs: nextDebuffs,
  }
}

function pruneExpiredActiveBuffs(
  activeItemBuffs: ActiveItemBuffRuntime[],
  nowMs: number
): ActiveItemBuffRuntime[] {
  return activeItemBuffs.filter(buff => buff.expiresAt > nowMs)
}
