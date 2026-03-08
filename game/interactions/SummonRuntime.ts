import * as Phaser from 'phaser'
import type { ProjectileActionSpec, SummonActionSpec } from './ActionSpecs'
import type { SummonDefinitionId } from './SummonDefinitions'

export interface SummonRuntimeState {
  id: string
  ownerId: string
  definitionId: SummonDefinitionId
  position: Phaser.Math.Vector2
  createdAtMs: number
  expiresAtMs: number
  attackIntervalMs: number
  nextAttackAtMs: number
  targetingRange: number
  moveSpeed: number
  orbitRadius: number
  inheritedProjectileSpec: ProjectileActionSpec | null
}

export function createSummonRuntimeState(params: {
  id: string
  ownerId: string
  summonAction: SummonActionSpec
  definitionId: SummonDefinitionId
  x: number
  y: number
  nowMs: number
  attackIntervalMs: number
  targetingRange: number
  moveSpeed: number
  orbitRadius: number
  inheritedProjectileSpec?: ProjectileActionSpec | null
}): SummonRuntimeState {
  return {
    id: params.id,
    ownerId: params.ownerId,
    definitionId: params.definitionId,
    position: new Phaser.Math.Vector2(params.x, params.y),
    createdAtMs: params.nowMs,
    expiresAtMs: params.nowMs + params.summonAction.durationMs,
    attackIntervalMs: params.attackIntervalMs,
    nextAttackAtMs: params.nowMs + params.attackIntervalMs,
    targetingRange: params.targetingRange,
    moveSpeed: params.moveSpeed,
    orbitRadius: params.orbitRadius,
    inheritedProjectileSpec: params.inheritedProjectileSpec ?? null,
  }
}

export function pruneExpiredSummons(
  summons: SummonRuntimeState[],
  nowMs: number
): SummonRuntimeState[] {
  return summons.filter(summon => summon.expiresAtMs > nowMs)
}
