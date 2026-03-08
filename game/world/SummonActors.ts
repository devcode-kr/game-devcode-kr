import Phaser from 'phaser'
import { Summon } from '../entities/Summon'
import { worldToScreen, type IsoPoint } from '../iso'
import type { ProjectileActionSpec, SummonActionSpec } from '../interactions/ActionSpecs'
import { getSummonDefinition, type SummonDefinitionId } from '../interactions/SummonDefinitions'
import {
  createSummonRuntimeState,
  pruneExpiredSummons,
  type SummonRuntimeState,
} from '../interactions/SummonRuntime'

export interface SummonProjectileRequest {
  attackerId: string
  origin: Phaser.Math.Vector2
  target: Phaser.Math.Vector2
  attackSpec: ProjectileActionSpec
}

export interface SummonActor {
  id: string
  runtime: SummonRuntimeState
  entity: Summon
}

export function spawnSummonActor(params: {
  scene: Phaser.Scene
  summonAction: SummonActionSpec
  definitionId: SummonDefinitionId
  x: number
  y: number
  nowMs: number
  id: string
  ownerId: string
  attackIntervalMs: number
  targetingRange: number
  inheritedProjectileSpec?: ProjectileActionSpec | null
}): SummonActor {
  const definition = getSummonDefinition(params.definitionId)
  const runtime = createSummonRuntimeState({
    id: params.id,
    ownerId: params.ownerId,
    summonAction: params.summonAction,
    definitionId: params.definitionId,
    x: params.x,
    y: params.y,
    nowMs: params.nowMs,
    attackIntervalMs: params.attackIntervalMs,
    targetingRange: params.targetingRange,
    moveSpeed: definition.moveSpeed,
    orbitRadius: definition.orbitRadius,
    inheritedProjectileSpec: params.inheritedProjectileSpec,
  })

  return {
    id: params.id,
    runtime,
    entity: new Summon(params.scene, definition.fillColor, definition.strokeColor),
  }
}

export function destroySummonActors(summons: SummonActor[]): void {
  for (const summon of summons) {
    summon.entity.destroy()
  }
}

export function updateSummonActors(params: {
  summons: SummonActor[]
  nowMs: number
  deltaMs: number
  ownerPosition: Phaser.Math.Vector2
  findNearestTarget: (x: number, y: number, range: number) => Phaser.Math.Vector2 | null
}): {
  survivors: SummonActor[]
  projectileRequests: SummonProjectileRequest[]
} {
  const activeIds = new Set(pruneExpiredSummons(params.summons.map(actor => actor.runtime), params.nowMs).map(runtime => runtime.id))
  const survivors: SummonActor[] = []
  const projectileRequests: SummonProjectileRequest[] = []

  for (const summon of params.summons) {
    if (!activeIds.has(summon.id)) {
      summon.entity.destroy()
      continue
    }

    survivors.push(summon)
  }

  const count = Math.max(1, survivors.length)
  survivors.forEach((summon, index) => {
    const angle = (Math.PI * 2 * index) / count + params.nowMs * 0.0015
    const desired = new Phaser.Math.Vector2(
      params.ownerPosition.x + Math.cos(angle) * summon.runtime.orbitRadius,
      params.ownerPosition.y + Math.sin(angle) * summon.runtime.orbitRadius
    )
    const toDesired = desired.clone().subtract(summon.runtime.position)
    const maxStep = summon.runtime.moveSpeed * (params.deltaMs / 1000)
    if (toDesired.lengthSq() > 0) {
      if (toDesired.length() <= maxStep) {
        summon.runtime.position.copy(desired)
      } else {
        toDesired.normalize().scale(maxStep)
        summon.runtime.position.add(toDesired)
      }
    }

    if (!summon.runtime.inheritedProjectileSpec || summon.runtime.attackIntervalMs <= 0) {
      return
    }
    if (summon.runtime.nextAttackAtMs > params.nowMs) {
      return
    }

    summon.runtime.nextAttackAtMs = params.nowMs + summon.runtime.attackIntervalMs
    const target = params.findNearestTarget(
      summon.runtime.position.x,
      summon.runtime.position.y,
      summon.runtime.targetingRange
    )
    if (!target) {
      return
    }

    projectileRequests.push({
      attackerId: summon.runtime.ownerId,
      origin: summon.runtime.position.clone(),
      target,
      attackSpec: summon.runtime.inheritedProjectileSpec,
    })
  })

  return {
    survivors,
    projectileRequests,
  }
}

export function drawSummonActors(params: {
  summons: SummonActor[]
  playerScreen: IsoPoint
  width: number
  height: number
  nowMs: number
}): void {
  for (const summon of params.summons) {
    const screen = worldToScreen(summon.runtime.position)
    summon.entity.setDepth(650 + Math.floor(summon.runtime.position.x) + Math.floor(summon.runtime.position.y))
    summon.entity.syncScreenPosition(
      screen.x - params.playerScreen.x + params.width / 2,
      screen.y - params.playerScreen.y + params.height / 2 - 12,
      params.nowMs
    )
  }
}
