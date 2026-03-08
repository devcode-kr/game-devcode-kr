import type { ProjectileActionSpec } from './ActionSpecs'
import { PROJECTILE_DEFINITION_IDS } from './ProjectileDefinitions'

export const WEAPON_PROJECTILE_ATTACK_IDS = {
  debugWand: 'debug_wand',
} as const

export type WeaponProjectileAttackId =
  (typeof WEAPON_PROJECTILE_ATTACK_IDS)[keyof typeof WEAPON_PROJECTILE_ATTACK_IDS]

export function buildWeaponProjectileAttackSpec(id: WeaponProjectileAttackId): ProjectileActionSpec {
  if (id === WEAPON_PROJECTILE_ATTACK_IDS.debugWand) {
    return {
      deliveryType: 'projectile',
      definitionId: PROJECTILE_DEFINITION_IDS.debugBolt,
      onHitEvents: [
        {
          type: 'direct_damage',
          amount: 18,
        },
      ],
      onExpireEvents: [],
    }
  }

  throw new Error(`Unknown weapon projectile attack id: ${id}`)
}
