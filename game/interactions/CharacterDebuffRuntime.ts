import type { CharacterUnit } from '../characters/CharacterUnit'
import {
  DEBUFF_EFFECT_IDS,
} from './EffectDefinitions'
import {
  pruneExpiredEffectDebuffs,
  upsertEffectDebuff,
  type EffectDebuffRuntime,
} from './EffectDebuffRules'

export function syncCharacterDebuffState(character: CharacterUnit, nowMs: number): void {
  const activeDebuffs = pruneExpiredEffectDebuffs(character.getActiveDebuffs(), nowMs)
  character.setActiveDebuffs(activeDebuffs)
  character.setTemporaryBonuses(
    activeDebuffs
      .map(debuff => debuff.statModifiers)
      .filter((modifier): modifier is NonNullable<typeof modifier> => Boolean(modifier))
  )
  character.setPoisoned(activeDebuffs.some(debuff => debuff.id === DEBUFF_EFFECT_IDS.poison))
}

export function applyDebuffToCharacter(params: {
  character: CharacterUnit
  nowMs: number
  debuff: {
    id: string
    displayName: string
    durationMs: number
    statModifiers?: EffectDebuffRuntime['statModifiers']
    damagePerSecond?: number
    blocksHealthRegen?: boolean
    guardMitigatesDamage?: boolean
  }
}): void {
  params.character.setActiveDebuffs(upsertEffectDebuff({
    debuffs: params.character.getActiveDebuffs(),
    id: params.debuff.id,
    displayName: params.debuff.displayName,
    durationMs: params.debuff.durationMs,
    nowMs: params.nowMs,
    statModifiers: params.debuff.statModifiers,
    damagePerSecond: params.debuff.damagePerSecond,
    blocksHealthRegen: params.debuff.blocksHealthRegen,
    guardMitigatesDamage: params.debuff.guardMitigatesDamage,
  }))
  syncCharacterDebuffState(params.character, params.nowMs)
}
