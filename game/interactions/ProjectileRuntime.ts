import * as Phaser from 'phaser'
import type { Character } from '../characters/Character'
import type { AreaHitResult, CharacterController } from '../characters/CharacterController'
import { canCharacterAttackCharacter } from './CombatTargetRules'
import type { ProjectileActionSpec, ProjectileLifecycleEvent } from './ActionSpecs'
import type { ProjectileDefinitionId } from './ProjectileDefinitions'

export interface ProjectileRuntimeState {
  id: string
  definitionId: ProjectileDefinitionId
  attackSpec: ProjectileActionSpec
  attackerId: string
  position: Phaser.Math.Vector2
  direction: Phaser.Math.Vector2
  speed: number
  radius: number
  maxRange: number
  traveledDistance: number
  piercesTargets: boolean
  maxHits: number
  hitTargetIds: string[]
}

export interface ProjectileTarget {
  id: string
  character: Character
  controller: CharacterController
}

export interface ProjectileImpact {
  projectileId: string
  attackerId: string
  definitionId: ProjectileDefinitionId
  targetId: string
  hit: AreaHitResult
  position: Phaser.Math.Vector2
  direction: Phaser.Math.Vector2
  events: ProjectileLifecycleEvent[]
}

export interface ProjectileExpiration {
  projectileId: string
  attackerId: string
  definitionId: ProjectileDefinitionId
  position: Phaser.Math.Vector2
  direction: Phaser.Math.Vector2
  reason: 'range' | 'wall' | 'hits'
  events: ProjectileLifecycleEvent[]
}

export interface ProjectileStepResult {
  nextState: ProjectileRuntimeState
  impacts: ProjectileImpact[]
  expirations: ProjectileExpiration[]
  expired: boolean
  expiredReason: 'range' | 'wall' | 'hits'
}

export function createProjectileRuntimeState(params: {
  id: string
  attackerId: string
  originX: number
  originY: number
  targetX: number
  targetY: number
  definitionId: ProjectileDefinitionId
  speed: number
  radius: number
  maxRange: number
  attackSpec: ProjectileActionSpec
  piercesTargets?: boolean
  maxHits?: number
}): ProjectileRuntimeState | null {
  const direction = new Phaser.Math.Vector2(params.targetX - params.originX, params.targetY - params.originY)
  if (direction.lengthSq() === 0) {
    return null
  }

  direction.normalize()

  return {
    id: params.id,
    definitionId: params.definitionId,
    attackSpec: params.attackSpec,
    attackerId: params.attackerId,
    position: new Phaser.Math.Vector2(params.originX, params.originY),
    direction,
    speed: params.speed,
    radius: params.radius,
    maxRange: params.maxRange,
    traveledDistance: 0,
    piercesTargets: params.piercesTargets ?? false,
    maxHits: Math.max(1, params.maxHits ?? 1),
    hitTargetIds: [],
  }
}

export function stepProjectileRuntime(params: {
  projectile: ProjectileRuntimeState
  deltaMs: number
  targets: ProjectileTarget[]
  canTraverse: (x: number, y: number, radius: number) => boolean
}): ProjectileStepResult {
  const attacker = params.targets.find(target => target.id === params.projectile.attackerId)
  if (!attacker) {
    throw new Error(`Projectile attacker not found: ${params.projectile.attackerId}`)
  }

  const stepDistance = Math.max(0, (params.projectile.speed * params.deltaMs) / 1000)
  const nextPosition = params.projectile.position.clone().add(
    params.projectile.direction.clone().scale(stepDistance)
  )
  const nextState: ProjectileRuntimeState = {
    ...params.projectile,
    position: nextPosition,
    traveledDistance: params.projectile.traveledDistance + stepDistance,
    hitTargetIds: [...params.projectile.hitTargetIds],
  }

  if (!params.canTraverse(nextPosition.x, nextPosition.y, params.projectile.radius)) {
    return {
      nextState,
      impacts: [],
      expirations: [
        {
          projectileId: params.projectile.id,
          attackerId: params.projectile.attackerId,
          definitionId: params.projectile.definitionId,
          position: nextPosition.clone(),
          direction: params.projectile.direction.clone(),
          reason: 'wall',
          events: [...params.projectile.attackSpec.onExpireEvents],
        },
      ],
      expired: true,
      expiredReason: 'wall',
    }
  }

  const impacts: ProjectileImpact[] = []
  const availableTargets = params.targets
    .filter(target => target.id !== params.projectile.attackerId)
    .filter(target => !nextState.hitTargetIds.includes(target.id))
    .filter(target => canCharacterAttackCharacter(attacker.character, target.character))
    .map(target => ({
      target,
      hit: target.controller.evaluateAreaHit(nextPosition.x, nextPosition.y, params.projectile.radius),
    }))
    .filter(candidate => candidate.hit.hit)
    .sort((left, right) => left.hit.distanceFromCenter - right.hit.distanceFromCenter)

  for (const candidate of availableTargets) {
    nextState.hitTargetIds.push(candidate.target.id)
    impacts.push({
      projectileId: params.projectile.id,
      attackerId: params.projectile.attackerId,
      definitionId: params.projectile.definitionId,
      targetId: candidate.target.id,
      hit: candidate.hit,
      position: nextPosition.clone(),
      direction: params.projectile.direction.clone(),
      events: [...params.projectile.attackSpec.onHitEvents],
    })

    if (!params.projectile.piercesTargets || nextState.hitTargetIds.length >= params.projectile.maxHits) {
      return {
        nextState,
        impacts,
        expirations: [
          {
            projectileId: params.projectile.id,
            attackerId: params.projectile.attackerId,
            definitionId: params.projectile.definitionId,
            position: nextPosition.clone(),
            direction: params.projectile.direction.clone(),
            reason: 'hits',
            events: [...params.projectile.attackSpec.onExpireEvents],
          },
        ],
        expired: true,
        expiredReason: 'hits',
      }
    }
  }

  if (nextState.traveledDistance >= nextState.maxRange) {
    return {
      nextState,
      impacts,
      expirations: [
        {
          projectileId: params.projectile.id,
          attackerId: params.projectile.attackerId,
          definitionId: params.projectile.definitionId,
          position: nextPosition.clone(),
          direction: params.projectile.direction.clone(),
          reason: 'range',
          events: [...params.projectile.attackSpec.onExpireEvents],
        },
      ],
      expired: true,
      expiredReason: 'range',
    }
  }

  return {
    nextState,
    impacts,
    expirations: [],
    expired: false,
    expiredReason: 'range',
  }
}
