import * as Phaser from 'phaser'
import type { BSPDungeon } from '../map/BSPDungeon'
import { canOccupyCell } from '../navigation/NavigationRules'
import type { DeployableActor } from '../world/DeployableActors'
import { spawnDeployableActor } from '../world/DeployableActors'
import type { MonsterActor } from '../world/MonsterActors'
import type { ProjectileActor } from '../world/ProjectileActors'
import { spawnProjectileActor } from '../world/ProjectileActors'
import type { SummonActor } from '../world/SummonActors'
import { spawnSummonActor, updateSummonActors } from '../world/SummonActors'
import type { ActionBundle } from './ActionBundleRules'
import type { DeployActionSpec, ProjectileActionSpec, SummonActionSpec } from './ActionSpecs'
import { getProjectileDefinition } from './ProjectileDefinitions'
import { scaleProjectileActionSpec } from './ProjectileActionRules'
import { cellCenter } from '../iso'

export interface ActionExecutionCollections {
  deployables: DeployableActor[]
  summons: SummonActor[]
  projectiles: ProjectileActor[]
}

export interface FacingActionContext {
  scene: Phaser.Scene
  dungeon: BSPDungeon
  nowMs: number
  ownerId: string
  origin: Phaser.Math.Vector2
  facing: Phaser.Math.Vector2
}

export function executeActionBundle(params: {
  context: FacingActionContext
  actionBundle: ActionBundle
  collections: ActionExecutionCollections
  successStatus: string
  summonAttackIntervalMs: number
  summonTargetingRange: number
}): ActionExecutionCollections & { performed: boolean; status: string } {
  let collections = params.collections
  let performed = false
  let status = 'action failed'

  if (params.actionBundle.projectile) {
    const projectileResult = launchProjectileInFacing({
      context: params.context,
      projectiles: collections.projectiles,
      attackSpec: params.actionBundle.projectile,
      successStatus: params.successStatus,
    })
    collections = { ...collections, projectiles: projectileResult.projectiles }
    if (projectileResult.launched) {
      performed = true
      status = projectileResult.status
    } else {
      status = projectileResult.status
    }
  }

  for (const deployAction of params.actionBundle.deploys) {
    const deployResult = deployFacingAction({
      context: params.context,
      deployAction,
      deployables: collections.deployables,
      inheritedProjectileSpec: params.actionBundle.projectile,
    })
    collections = { ...collections, deployables: deployResult.deployables }
    performed = deployResult.deployed || performed
  }

  for (const summonAction of params.actionBundle.summons) {
    const summonResult = summonFacingAction({
      context: params.context,
      summonAction,
      summons: collections.summons,
      inheritedProjectileSpec: params.actionBundle.projectile,
      attackIntervalMs: params.summonAttackIntervalMs,
      targetingRange: params.summonTargetingRange,
    })
    collections = { ...collections, summons: summonResult.summons }
    performed = summonResult.summoned || performed
  }

  if (!performed) {
    return {
      ...collections,
      performed: false,
      status,
    }
  }

  if ((params.actionBundle.deploys.length > 0 || params.actionBundle.summons.length > 0) && params.actionBundle.projectile) {
    status = `${params.successStatus} + support`
  } else if (params.actionBundle.deploys.length > 0 || params.actionBundle.summons.length > 0) {
    status = `spawned support ${params.actionBundle.deploys.length + params.actionBundle.summons.length}`
  }

  return {
    ...collections,
    performed: true,
    status,
  }
}

export function launchProjectileInFacing(params: {
  context: Pick<FacingActionContext, 'scene' | 'nowMs' | 'ownerId' | 'origin' | 'facing'>
  projectiles: ProjectileActor[]
  attackSpec: ProjectileActionSpec
  successStatus: string
}): { projectiles: ProjectileActor[]; launched: boolean; status: string } {
  const projectileDefinition = getProjectileDefinition(params.attackSpec.definitionId)
  const target = new Phaser.Math.Vector2(
    params.context.origin.x + params.context.facing.x * projectileDefinition.maxRange,
    params.context.origin.y + params.context.facing.y * projectileDefinition.maxRange
  )

  return launchProjectileFromPosition({
    scene: params.context.scene,
    nowMs: params.context.nowMs,
    attackerId: params.context.ownerId,
    origin: params.context.origin,
    target,
    attackSpec: params.attackSpec,
    projectiles: params.projectiles,
    successStatus: params.successStatus,
    failureStatus: 'projectile failed: invalid direction',
  })
}

export function launchProjectileFromPosition(params: {
  scene: Phaser.Scene
  nowMs: number
  attackerId: string
  origin: Phaser.Math.Vector2
  target: Phaser.Math.Vector2
  attackSpec: ProjectileActionSpec
  projectiles: ProjectileActor[]
  successStatus: string
  failureStatus?: string
}): { projectiles: ProjectileActor[]; launched: boolean; status: string } {
  const projectile = spawnProjectileActor(params.scene, {
    id: `projectile-${params.nowMs}-${params.projectiles.length}`,
    attackerId: params.attackerId,
    originX: params.origin.x,
    originY: params.origin.y,
    targetX: params.target.x,
    targetY: params.target.y,
    attackSpec: params.attackSpec,
  })
  if (!projectile) {
    return {
      projectiles: params.projectiles,
      launched: false,
      status: params.failureStatus ?? params.successStatus,
    }
  }

  return {
    projectiles: [...params.projectiles, projectile],
    launched: true,
    status: params.successStatus,
  }
}

export function deployFacingAction(params: {
  context: FacingActionContext
  deployAction: DeployActionSpec
  deployables: DeployableActor[]
  inheritedProjectileSpec?: ProjectileActionSpec | null
}): { deployables: DeployableActor[]; deployed: boolean } {
  const targetX = Math.floor(params.context.origin.x + params.context.facing.x)
  const targetY = Math.floor(params.context.origin.y + params.context.facing.y)
  if (!canOccupyCell(params.context.dungeon, targetX, targetY, 0.1)) {
    return {
      deployables: params.deployables,
      deployed: false,
    }
  }

  const deployables = [...params.deployables]
  if (typeof params.deployAction.maxPlacedCount === 'number' && deployables.length >= params.deployAction.maxPlacedCount) {
    const oldest = deployables.shift()
    oldest?.entity.destroy()
  }

  const world = cellCenter(targetX, targetY)
  const scaledProjectileSpec = params.deployAction.inheritsOwnerProjectile && params.inheritedProjectileSpec
    ? scaleProjectileActionSpec(
        params.inheritedProjectileSpec,
        getInheritedScale(
          params.deployAction.inheritedDamageScale,
          params.deployAction.inheritedPerActivePenalty,
          deployables.length + 1
        )
      )
    : null

  deployables.push(spawnDeployableActor({
    scene: params.context.scene,
    deployAction: params.deployAction,
    x: world.x,
    y: world.y,
    nowMs: params.context.nowMs,
    id: `deploy-${params.context.nowMs}-${deployables.length}`,
    ownerId: params.context.ownerId,
    inheritedProjectileSpec: scaledProjectileSpec,
  }))

  return {
    deployables,
    deployed: true,
  }
}

export function summonFacingAction(params: {
  context: Pick<FacingActionContext, 'scene' | 'nowMs' | 'ownerId' | 'origin' | 'facing'>
  summonAction: SummonActionSpec
  summons: SummonActor[]
  inheritedProjectileSpec?: ProjectileActionSpec | null
  attackIntervalMs: number
  targetingRange: number
}): { summons: SummonActor[]; summoned: boolean } {
  const spawnX = params.context.origin.x + params.context.facing.x * 0.8
  const spawnY = params.context.origin.y + params.context.facing.y * 0.8
  const summons = [...params.summons]

  if (typeof params.summonAction.maxSummonCount === 'number' && summons.length >= params.summonAction.maxSummonCount) {
    const oldest = summons.shift()
    oldest?.entity.destroy()
  }

  const scaledProjectileSpec = params.summonAction.inheritsOwnerProjectile && params.inheritedProjectileSpec
    ? scaleProjectileActionSpec(
        params.inheritedProjectileSpec,
        getInheritedScale(
          params.summonAction.inheritedDamageScale,
          params.summonAction.inheritedPerActivePenalty,
          summons.length + 1
        )
      )
    : null

  summons.push(spawnSummonActor({
    scene: params.context.scene,
    summonAction: params.summonAction,
    definitionId: params.summonAction.summonUnitId,
    x: spawnX,
    y: spawnY,
    nowMs: params.context.nowMs,
    id: `summon-${params.context.nowMs}-${summons.length}`,
    ownerId: params.context.ownerId,
    attackIntervalMs: params.attackIntervalMs,
    targetingRange: params.targetingRange,
    inheritedProjectileSpec: scaledProjectileSpec,
  }))

  return {
    summons,
    summoned: true,
  }
}

export function updateDeployableAttacks(params: {
  scene: Phaser.Scene
  nowMs: number
  deployables: DeployableActor[]
  projectiles: ProjectileActor[]
  findNearestMonster: (x: number, y: number, range: number) => MonsterActor | null
}): { projectiles: ProjectileActor[]; status: string | null } {
  let projectiles = params.projectiles
  let status: string | null = null

  for (const deployable of params.deployables) {
    if (!deployable.runtime.inheritedProjectileSpec || deployable.runtime.attackIntervalMs <= 0) {
      continue
    }
    if (deployable.runtime.nextAttackAtMs > params.nowMs) {
      continue
    }

    const target = params.findNearestMonster(
      deployable.runtime.position.x,
      deployable.runtime.position.y,
      deployable.runtime.targetingRange
    )
    deployable.runtime.nextAttackAtMs = params.nowMs + deployable.runtime.attackIntervalMs
    if (!target) {
      continue
    }

    const launchResult = launchProjectileFromPosition({
      scene: params.scene,
      nowMs: params.nowMs,
      attackerId: deployable.runtime.ownerId,
      origin: deployable.runtime.position,
      target: target.controller.getMapPosition(),
      attackSpec: deployable.runtime.inheritedProjectileSpec,
      projectiles,
      successStatus: `${deployable.runtime.definitionId} fired`,
    })
    projectiles = launchResult.projectiles
    if (launchResult.launched) {
      status = launchResult.status
    }
  }

  return { projectiles, status }
}

export function updateSummonActions(params: {
  scene: Phaser.Scene
  nowMs: number
  deltaMs: number
  summons: SummonActor[]
  projectiles: ProjectileActor[]
  ownerPosition: Phaser.Math.Vector2
  findNearestTarget: (x: number, y: number, range: number) => Phaser.Math.Vector2 | null
}): { summons: SummonActor[]; projectiles: ProjectileActor[]; status: string | null } {
  const summonResult = updateSummonActors({
    summons: params.summons,
    nowMs: params.nowMs,
    deltaMs: params.deltaMs,
    ownerPosition: params.ownerPosition,
    findNearestTarget: params.findNearestTarget,
  })

  let projectiles = params.projectiles
  let status: string | null = null

  for (const request of summonResult.projectileRequests) {
    const launchResult = launchProjectileFromPosition({
      scene: params.scene,
      nowMs: params.nowMs,
      attackerId: request.attackerId,
      origin: request.origin,
      target: request.target,
      attackSpec: request.attackSpec,
      projectiles,
      successStatus: 'summon fired',
    })
    projectiles = launchResult.projectiles
    if (launchResult.launched) {
      status = launchResult.status
    }
  }

  return {
    summons: summonResult.survivors,
    projectiles,
    status,
  }
}

function getInheritedScale(
  baseScale: number | undefined,
  penalty: number | undefined,
  nextCount: number
): number {
  const resolvedBaseScale = baseScale ?? 1
  const resolvedPenalty = penalty ?? 0
  return Math.max(0.2, resolvedBaseScale * (1 - resolvedPenalty * (nextCount - 1)))
}
