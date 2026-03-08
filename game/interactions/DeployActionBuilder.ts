import type { DeployActionSpec } from './ActionSpecs'
import { DEPLOYABLE_DEFINITION_IDS } from './DeployableDefinitions'

export const DEPLOY_ACTION_IDS = {
  debugTotem: 'debug_totem',
} as const

export type DeployActionId =
  (typeof DEPLOY_ACTION_IDS)[keyof typeof DEPLOY_ACTION_IDS]

export function buildDeployActionSpec(id: DeployActionId): DeployActionSpec {
  if (id === DEPLOY_ACTION_IDS.debugTotem) {
    return {
      deliveryType: 'deploy',
      deployableId: DEPLOYABLE_DEFINITION_IDS.debugTotem,
      durationMs: 12000,
      maxPlacedCount: 2,
      inheritsOwnerProjectile: true,
      inheritedDamageScale: 0.65,
      inheritedPerActivePenalty: 0.12,
      attackIntervalMs: 1400,
      targetingRange: 6,
    }
  }

  throw new Error(`Unknown deploy action id: ${id}`)
}
