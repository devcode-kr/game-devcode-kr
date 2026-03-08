import type { ActionSpec, DeployActionSpec, ProjectileActionSpec, SummonActionSpec } from './ActionSpecs'
import { DEPLOYABLE_DEFINITION_IDS } from './DeployableDefinitions'
import {
  DEBUFF_EFFECT_IDS,
  getDebuffEffectDefinition,
} from './EffectDefinitions'
import { PROJECTILE_DEFINITION_IDS } from './ProjectileDefinitions'
import { SKILL_ACTION_IDS, type SkillActionId } from './SkillActionIds'
import { SUMMON_DEFINITION_IDS } from './SummonDefinitions'

export function buildSkillActionSpec(id: SkillActionId): ActionSpec {
  if (id === SKILL_ACTION_IDS.debugPoisonShot) {
    const poisonDefinition = getDebuffEffectDefinition(DEBUFF_EFFECT_IDS.poison)
    const spec: ProjectileActionSpec = {
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
            id: DEBUFF_EFFECT_IDS.poison,
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
    return spec
  }

  if (id === SKILL_ACTION_IDS.debugTotemDrop) {
    const spec: DeployActionSpec = {
      deliveryType: 'deploy',
      deployableId: DEPLOYABLE_DEFINITION_IDS.debugTotem,
      durationMs: 12000,
      maxPlacedCount: 2,
    }
    return spec
  }

  if (id === SKILL_ACTION_IDS.debugSplitShot) {
    const spec: ProjectileActionSpec = {
      deliveryType: 'projectile',
      definitionId: PROJECTILE_DEFINITION_IDS.debugBolt,
      onHitEvents: [],
      onExpireEvents: [
        {
          type: 'spawn_projectile',
          count: 2,
          spreadDegrees: 28,
          projectile: {
            deliveryType: 'projectile',
            definitionId: PROJECTILE_DEFINITION_IDS.debugBolt,
            onHitEvents: [
              {
                type: 'direct_damage',
                amount: 7,
              },
            ],
            onExpireEvents: [],
          },
        },
      ],
    }
    return spec
  }

  if (id === SKILL_ACTION_IDS.debugFamiliarSummon) {
    const spec: SummonActionSpec = {
      deliveryType: 'summon',
      summonUnitId: SUMMON_DEFINITION_IDS.debugFamiliar,
      durationMs: 14000,
      maxSummonCount: 2,
      inheritsOwnerProjectile: true,
      inheritedDamageScale: 0.55,
      inheritedPerActivePenalty: 0.1,
    }
    return spec
  }

  throw new Error(`Unknown skill action id: ${id}`)
}
