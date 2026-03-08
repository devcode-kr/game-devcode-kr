import {
  DEBUFF_EFFECT_IDS,
  getDebuffEffectDefinition,
} from './EffectDefinitions'
import {
  POISON_DEBUFF_ID,
} from './EffectRuntimeMutations'
import type { ProjectileActionSpec } from './ActionSpecs'
import { PROJECTILE_DEFINITION_IDS } from './ProjectileDefinitions'

export const SKILL_PROJECTILE_ATTACK_IDS = {
  debugPoisonShot: 'debug_poison_shot',
} as const

export type SkillProjectileAttackId =
  (typeof SKILL_PROJECTILE_ATTACK_IDS)[keyof typeof SKILL_PROJECTILE_ATTACK_IDS]

export function buildSkillProjectileAttackSpec(id: SkillProjectileAttackId): ProjectileActionSpec {
  if (id === SKILL_PROJECTILE_ATTACK_IDS.debugPoisonShot) {
    const poisonDefinition = getDebuffEffectDefinition(DEBUFF_EFFECT_IDS.poison)
    return {
      deliveryType: 'projectile',
      definitionId: PROJECTILE_DEFINITION_IDS.debugPoisonBolt,
      onHitEvents: [
        {
          type: 'direct_damage',
          amount: 12,
        },
        {
          type: 'apply_debuff',
          debuff: {
            id: POISON_DEBUFF_ID,
            displayName: poisonDefinition.describe({
              remainingMs: 5000,
              damagePerSecond: 2,
            }).title,
            durationMs: 5000,
            damagePerSecond: 2,
            blocksHealthRegen: true,
            guardMitigatesDamage: true,
          },
        },
      ],
      onExpireEvents: [],
    }
  }

  throw new Error(`Unknown skill projectile attack id: ${id}`)
}
