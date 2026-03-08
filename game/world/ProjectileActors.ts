import * as Phaser from 'phaser'
import { Projectile } from '../entities/Projectile'
import type { ProjectileActionSpec } from '../interactions/ActionSpecs'
import { getProjectileDefinition } from '../interactions/ProjectileDefinitions'
import {
  createProjectileRuntimeState,
  stepProjectileRuntime,
  type ProjectileExpiration,
  type ProjectileImpact,
  type ProjectileRuntimeState,
  type ProjectileTarget,
} from '../interactions/ProjectileRuntime'
import { worldToScreen, type IsoPoint } from '../iso'

export interface ProjectileActor {
  id: string
  runtime: ProjectileRuntimeState
  entity: Projectile
}

export interface ProjectileLaunchConfig {
  id: string
  attackerId: string
  originX: number
  originY: number
  targetX: number
  targetY: number
  attackSpec: ProjectileActionSpec
}

export function spawnProjectileActor(
  scene: Phaser.Scene,
  config: ProjectileLaunchConfig
): ProjectileActor | null {
  const definition = getProjectileDefinition(config.attackSpec.definitionId)
  const runtime = createProjectileRuntimeState({
    ...config,
    definitionId: definition.id,
    speed: definition.speed,
    radius: definition.radius,
    maxRange: definition.maxRange,
    piercesTargets: definition.piercesTargets,
    maxHits: definition.maxHits,
  })
  if (!runtime) {
    return null
  }

  return {
    id: config.id,
    runtime,
    entity: new Projectile(scene, definition.presentation),
  }
}

export function destroyProjectileActors(projectiles: ProjectileActor[]): void {
  for (const projectile of projectiles) {
    projectile.entity.destroy()
  }
}

export function updateProjectileActors(params: {
  projectiles: ProjectileActor[]
  deltaMs: number
  targets: ProjectileTarget[]
  canTraverse: (x: number, y: number, radius: number) => boolean
}): { impacts: ProjectileImpact[]; expirations: ProjectileExpiration[]; survivors: ProjectileActor[] } {
  const impacts: ProjectileImpact[] = []
  const expirations: ProjectileExpiration[] = []
  const survivors: ProjectileActor[] = []

  for (const projectile of params.projectiles) {
    const result = stepProjectileRuntime({
      projectile: projectile.runtime,
      deltaMs: params.deltaMs,
      targets: params.targets,
      canTraverse: params.canTraverse,
    })

    impacts.push(...result.impacts)
    expirations.push(...result.expirations)

    if (result.expired) {
      projectile.entity.destroy()
      continue
    }

    projectile.runtime = result.nextState
    survivors.push(projectile)
  }

  return { impacts, expirations, survivors }
}

export function drawProjectileActors(params: {
  projectiles: ProjectileActor[]
  playerScreen: IsoPoint
  width: number
  height: number
}): void {
  for (const projectile of params.projectiles) {
    const screen = worldToScreen(projectile.runtime.position)
    projectile.entity.syncScreenPosition(
      screen.x - params.playerScreen.x + params.width / 2,
      screen.y - params.playerScreen.y + params.height / 2 - 8
    )
  }
}
