import * as Phaser from 'phaser'
import type { CharacterController } from '../characters/CharacterController'
import type { PlayerCharacter } from '../characters/PlayerCharacter'
import { applyDebuffToCharacter } from './CharacterDebuffRuntime'
import { canCharacterAttackCharacter } from './CombatTargetRules'
import { getProjectileDefinition } from './ProjectileDefinitions'
import { resolveProjectileAreaDamageHits } from './ProjectileAreaDamageRules'
import { upsertEffectDebuff } from './EffectDebuffRules'
import type { ProjectileActionSpec, ProjectileLifecycleEvent } from './ActionSpecs'
import type { ProjectileExpiration, ProjectileImpact } from './ProjectileRuntime'
import type { EffectRuntimeSceneState } from './EffectRuntimeSceneBridge'
import type { GameWorldRuntime } from '../world/GameWorldRuntime'

export interface ProjectileLifecycleResult {
  removedMonster: boolean
  shouldSyncPlayerRuntime: boolean
}

export class ProjectileLifecycleRuntime {
  constructor(
    private readonly world: GameWorldRuntime,
    private readonly player: {
      id: string
      character: PlayerCharacter
      controller: CharacterController
    },
    private readonly effectRuntimeSceneState: EffectRuntimeSceneState
  ) {}

  applyLifecycle(params: {
    impacts: ProjectileImpact[]
    expirations: ProjectileExpiration[]
    nowMs: number
    setInteractionStatus: (status: string) => void
    launchProjectileFromPosition: (
      attackerId: string,
      origin: Phaser.Math.Vector2,
      target: Phaser.Math.Vector2,
      attackSpec: ProjectileActionSpec,
      successStatus: string
    ) => void
  }): ProjectileLifecycleResult {
    let removedMonster = false
    let shouldSyncPlayerRuntime = false

    for (const impact of params.impacts) {
      for (const event of impact.events) {
        const result = this.applyLifecycleEvent({
          attackerId: impact.attackerId,
          primaryTargetId: impact.targetId,
          origin: impact.position,
          direction: impact.direction,
          hitDistance: impact.hit.distanceFromCenter,
          event,
          nowMs: params.nowMs,
          setInteractionStatus: params.setInteractionStatus,
          launchProjectileFromPosition: params.launchProjectileFromPosition,
        })
        removedMonster = removedMonster || result.removedMonster
        shouldSyncPlayerRuntime = shouldSyncPlayerRuntime || result.shouldSyncPlayerRuntime
      }
    }

    for (const expiration of params.expirations) {
      for (const event of expiration.events) {
        const result = this.applyLifecycleEvent({
          attackerId: expiration.attackerId,
          primaryTargetId: null,
          origin: expiration.position,
          direction: expiration.direction,
          event,
          nowMs: params.nowMs,
          setInteractionStatus: params.setInteractionStatus,
          launchProjectileFromPosition: params.launchProjectileFromPosition,
        })
        removedMonster = removedMonster || result.removedMonster
        shouldSyncPlayerRuntime = shouldSyncPlayerRuntime || result.shouldSyncPlayerRuntime
      }
    }

    if (removedMonster) {
      this.world.removeDeadMonsters()
    }

    return {
      removedMonster,
      shouldSyncPlayerRuntime,
    }
  }

  private applyLifecycleEvent(params: {
    attackerId: string | null
    primaryTargetId: string | null
    origin: Phaser.Math.Vector2
    direction: Phaser.Math.Vector2
    event: ProjectileLifecycleEvent
    nowMs: number
    setInteractionStatus: (status: string) => void
    launchProjectileFromPosition: (
      attackerId: string,
      origin: Phaser.Math.Vector2,
      target: Phaser.Math.Vector2,
      attackSpec: ProjectileActionSpec,
      successStatus: string
    ) => void
    hitDistance?: number
  }): ProjectileLifecycleResult {
    if (params.event.type === 'direct_damage') {
      return this.applyProjectileDamageToTarget(
        params.primaryTargetId,
        params.event.amount,
        params.hitDistance,
        params.setInteractionStatus
      )
    }

    if (params.event.type === 'apply_debuff') {
      return this.applyProjectileDebuffToTarget(
        params.primaryTargetId,
        params.event.debuff,
        params.nowMs
      )
    }

    if (params.event.type === 'area_damage') {
      return this.applyProjectileAreaDamage({
        attackerId: params.attackerId,
        primaryTargetId: params.primaryTargetId,
        origin: params.origin,
        event: params.event,
        setInteractionStatus: params.setInteractionStatus,
      })
    }

    if (params.event.type === 'spawn_projectile') {
      this.spawnProjectileLifecycleEventProjectiles({
        attackerId: params.attackerId ?? this.player.id,
        origin: params.origin,
        direction: params.direction,
        event: params.event,
        launchProjectileFromPosition: params.launchProjectileFromPosition,
      })
    }

    return {
      removedMonster: false,
      shouldSyncPlayerRuntime: false,
    }
  }

  private applyProjectileDamageToTarget(
    targetId: string | null,
    amount: number,
    hitDistance: number | undefined,
    setInteractionStatus: (status: string) => void
  ): ProjectileLifecycleResult {
    if (!targetId) {
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    if (targetId === this.player.id) {
      this.player.character.setHealth(this.player.character.getHealth() - amount)
      setInteractionStatus(`player hit for ${amount}${typeof hitDistance === 'number' ? ` at ${hitDistance.toFixed(2)}` : ''}`)
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    const monster = this.world.findMonsterById(targetId)
    if (!monster) {
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    monster.character.setHealth(monster.character.getHealth() - amount)
    setInteractionStatus(
      `${monster.character.displayName} hit for ${amount}${typeof hitDistance === 'number' ? ` at ${hitDistance.toFixed(2)}` : ''}`
    )
    if (monster.character.isDead()) {
      monster.entity.destroy()
      return {
        removedMonster: true,
        shouldSyncPlayerRuntime: false,
      }
    }

    return {
      removedMonster: false,
      shouldSyncPlayerRuntime: false,
    }
  }

  private applyProjectileDebuffToTarget(
    targetId: string | null,
    debuff: Extract<ProjectileLifecycleEvent, { type: 'apply_debuff' }>['debuff'],
    nowMs: number
  ): ProjectileLifecycleResult {
    if (!targetId) {
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    if (targetId === this.player.id) {
      this.effectRuntimeSceneState.activeDebuffs = upsertEffectDebuff({
        debuffs: this.effectRuntimeSceneState.activeDebuffs,
        id: debuff.id,
        displayName: debuff.displayName,
        durationMs: debuff.durationMs,
        nowMs,
        statModifiers: debuff.statModifiers,
        damagePerSecond: debuff.damagePerSecond,
        blocksHealthRegen: debuff.blocksHealthRegen,
        guardMitigatesDamage: debuff.guardMitigatesDamage,
      })
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: true,
      }
    }

    const monster = this.world.findMonsterById(targetId)
    if (!monster) {
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    applyDebuffToCharacter({
      character: monster.character,
      nowMs,
      debuff,
    })
    monster.controller.syncMoveSpeedFromCharacter()
    return {
      removedMonster: false,
      shouldSyncPlayerRuntime: false,
    }
  }

  private applyProjectileAreaDamage(params: {
    attackerId: string | null
    primaryTargetId: string | null
    origin: Phaser.Math.Vector2
    event: Extract<ProjectileLifecycleEvent, { type: 'area_damage' }>
    setInteractionStatus: (status: string) => void
  }): ProjectileLifecycleResult {
    if (!params.attackerId) {
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    const targets = this.world.buildProjectileTargets(this.player)
    const attacker = targets.find(target => target.id === params.attackerId)
    if (!attacker) {
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    let removedMonster = false
    let shouldSyncPlayerRuntime = false
    const candidates: { targetId: string; distanceFromCenter: number }[] = []

    for (const target of targets) {
      if (!params.event.includeAttacker && target.id === params.attackerId) {
        continue
      }
      if (!params.event.includePrimaryTarget && params.primaryTargetId === target.id) {
        continue
      }
      if (
        target.id !== params.attackerId &&
        !canCharacterAttackCharacter(attacker.character, target.character)
      ) {
        continue
      }

      const hit = target.controller.evaluateAreaHit(params.origin.x, params.origin.y, params.event.radius)
      if (!hit.hit) {
        continue
      }

      candidates.push({
        targetId: target.id,
        distanceFromCenter: hit.distanceFromCenter,
      })
    }

    const resolvedHits = resolveProjectileAreaDamageHits({
      event: params.event,
      candidates,
    })

    for (const hit of resolvedHits) {
      const result = this.applyProjectileDamageToTarget(
        hit.targetId,
        hit.damage,
        hit.distanceFromCenter,
        params.setInteractionStatus
      )
      removedMonster = removedMonster || result.removedMonster
      shouldSyncPlayerRuntime = shouldSyncPlayerRuntime || result.shouldSyncPlayerRuntime
    }

    return {
      removedMonster,
      shouldSyncPlayerRuntime,
    }
  }

  private spawnProjectileLifecycleEventProjectiles(params: {
    attackerId: string
    origin: Phaser.Math.Vector2
    direction: Phaser.Math.Vector2
    event: Extract<ProjectileLifecycleEvent, { type: 'spawn_projectile' }>
    launchProjectileFromPosition: (
      attackerId: string,
      origin: Phaser.Math.Vector2,
      target: Phaser.Math.Vector2,
      attackSpec: ProjectileActionSpec,
      successStatus: string
    ) => void
  }): void {
    const count = Math.max(1, params.event.count ?? 1)
    const spreadDegrees = params.event.spreadDegrees ?? 0
    const baseOffsetDegrees = params.event.angleOffsetDegrees ?? 0

    for (let index = 0; index < count; index++) {
      const t = count === 1 ? 0.5 : index / (count - 1)
      const offsetDegrees = baseOffsetDegrees + ((t - 0.5) * spreadDegrees)
      const direction = params.direction.clone().rotate(Phaser.Math.DegToRad(offsetDegrees))
      const projectileDefinition = getProjectileDefinition(params.event.projectile.definitionId)
      const target = params.origin.clone().add(direction.scale(projectileDefinition.maxRange))
      params.launchProjectileFromPosition(
        params.attackerId,
        params.origin,
        target,
        params.event.projectile,
        'spawned projectile'
      )
    }
  }
}
