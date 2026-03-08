import * as Phaser from 'phaser'
import type { DeployActionSpec, ProjectileActionSpec } from './ActionSpecs'
import type { DeployableDefinitionId } from './DeployableDefinitions'

export interface DeployableRuntimeState {
  id: string
  ownerId: string
  definitionId: DeployableDefinitionId
  position: Phaser.Math.Vector2
  createdAtMs: number
  expiresAtMs: number
  attackIntervalMs: number
  nextAttackAtMs: number
  targetingRange: number
  inheritedProjectileSpec: ProjectileActionSpec | null
}

export function createDeployableRuntimeState(params: {
  id: string
  ownerId: string
  deployAction: DeployActionSpec
  x: number
  y: number
  nowMs: number
  inheritedProjectileSpec?: ProjectileActionSpec | null
}): DeployableRuntimeState {
  return {
    id: params.id,
    ownerId: params.ownerId,
    definitionId: params.deployAction.deployableId,
    position: new Phaser.Math.Vector2(params.x, params.y),
    createdAtMs: params.nowMs,
    expiresAtMs: params.nowMs + params.deployAction.durationMs,
    attackIntervalMs: params.deployAction.attackIntervalMs ?? 0,
    nextAttackAtMs: params.nowMs + (params.deployAction.attackIntervalMs ?? 0),
    targetingRange: params.deployAction.targetingRange ?? 0,
    inheritedProjectileSpec: params.inheritedProjectileSpec ?? null,
  }
}

export function pruneExpiredDeployables(
  deployables: DeployableRuntimeState[],
  nowMs: number
): DeployableRuntimeState[] {
  return deployables.filter(deployable => deployable.expiresAtMs > nowMs)
}
