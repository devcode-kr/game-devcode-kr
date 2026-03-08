import Phaser from 'phaser'
import { Deployable } from '../entities/Deployable'
import { worldToScreen, type IsoPoint } from '../iso'
import type { ProjectileActionSpec } from '../interactions/ActionSpecs'
import { getDeployableDefinition } from '../interactions/DeployableDefinitions'
import {
  createDeployableRuntimeState,
  pruneExpiredDeployables,
  type DeployableRuntimeState,
} from '../interactions/DeployableRuntime'
import type { DeployActionSpec } from '../interactions/ActionSpecs'

export interface DeployableActor {
  id: string
  runtime: DeployableRuntimeState
  entity: Deployable
}

export function spawnDeployableActor(params: {
  scene: Phaser.Scene
  deployAction: DeployActionSpec
  x: number
  y: number
  nowMs: number
  id: string
  ownerId: string
  inheritedProjectileSpec?: ProjectileActionSpec | null
}): DeployableActor {
  const runtime = createDeployableRuntimeState({
    id: params.id,
    ownerId: params.ownerId,
    deployAction: params.deployAction,
    x: params.x,
    y: params.y,
    nowMs: params.nowMs,
    inheritedProjectileSpec: params.inheritedProjectileSpec,
  })
  const definition = getDeployableDefinition(runtime.definitionId)

  return {
    id: params.id,
    runtime,
    entity: new Deployable(params.scene, definition.presentation),
  }
}

export function destroyDeployableActors(deployables: DeployableActor[]): void {
  for (const deployable of deployables) {
    deployable.entity.destroy()
  }
}

export function updateDeployableActors(
  deployables: DeployableActor[],
  nowMs: number
): DeployableActor[] {
  const activeIds = new Set(pruneExpiredDeployables(deployables.map(actor => actor.runtime), nowMs).map(runtime => runtime.id))
  const survivors: DeployableActor[] = []

  for (const deployable of deployables) {
    if (!activeIds.has(deployable.id)) {
      deployable.entity.destroy()
      continue
    }

    survivors.push(deployable)
  }

  return survivors
}

export function drawDeployableActors(params: {
  deployables: DeployableActor[]
  playerScreen: IsoPoint
  width: number
  height: number
  nowMs: number
}): void {
  for (const deployable of params.deployables) {
    const screen = worldToScreen(deployable.runtime.position)
    const totalDuration = Math.max(1, deployable.runtime.expiresAtMs - deployable.runtime.createdAtMs)
    const remaining = Math.max(0, deployable.runtime.expiresAtMs - params.nowMs)
    const ratio = Phaser.Math.Clamp(remaining / totalDuration, 0, 1)
    deployable.entity.setDepth(500 + Math.floor(deployable.runtime.position.x) + Math.floor(deployable.runtime.position.y))
    deployable.entity.syncScreenPosition(
      screen.x - params.playerScreen.x + params.width / 2,
      screen.y - params.playerScreen.y + params.height / 2 - 10,
      ratio
    )
  }
}
