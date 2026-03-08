import * as Phaser from 'phaser'
import type { PlayerCharacter } from '../characters/PlayerCharacter'
import type { CharacterController } from '../characters/CharacterController'
import { updateCharacterMovement } from '../characters/CharacterMovementRuntime'
import type { GameWorldRuntime } from '../world/GameWorldRuntime'
import type { MonsterActor } from '../world/MonsterActors'
import type { BSPDungeon } from '../map/BSPDungeon'
import type { ProjectileActionSpec } from './ActionSpecs'
import type { ProjectileTarget } from './ProjectileRuntime'
import type { ProjectileLifecycleRuntime } from './ProjectileLifecycleRuntime'
import {
  deployFacingAction,
  executeActionBundle as executeRuntimeActionBundle,
  launchProjectileFromPosition as launchRuntimeProjectileFromPosition,
} from './ActionExecutionRuntime'
import { buildEquippedActionBundle } from './EquippedActionBundleRules'
import { buildDeployActionSpec, DEPLOY_ACTION_IDS } from './DeployActionBuilder'
import { canOccupy, findPathToTile } from '../navigation/NavigationRules'
import { cellCenter } from '../iso'
import { PROJECTILE_DEFINITION_IDS } from './ProjectileDefinitions'

const MONSTER_AGGRO_RANGE = 6.5
const MONSTER_ATTACK_RANGE = 4.75
const MONSTER_ATTACK_INTERVAL_MS = 1400
const MONSTER_CHASE_REPATH_MS = 300
const MONSTER_PATH_BUDGET = 48
const MONSTER_WANDER_REPATH_MS = 900

export class SceneCombatRuntime {
  private readonly monsterNextAttackAtMs = new Map<string, number>()

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly playerCharacter: PlayerCharacter,
    private readonly playerController: CharacterController,
    private readonly worldRuntime: GameWorldRuntime,
    private readonly projectileLifecycleRuntime: ProjectileLifecycleRuntime,
    private readonly getDungeon: () => BSPDungeon,
    private readonly callbacks: {
      getNowMs: () => number
      getEffectNowMs: () => number
      setInteractionStatus: (status: string) => void
      syncPlayerState: () => void
    }
  ) {}

  updateMonsterCombat(params: {
    deltaMs: number
    canMonsterOccupy: (monster: MonsterActor, x: number, y: number) => boolean
  }): void {
    const playerPosition = this.playerController.getMapPosition()
    const nowMs = this.callbacks.getNowMs()

    for (const monster of this.worldRuntime.getMonsters()) {
      const position = monster.controller.getMapPosition()
      const distanceToPlayer = Phaser.Math.Distance.Between(
        position.x,
        position.y,
        playerPosition.x,
        playerPosition.y
      )

      monster.decisionCooldownMs -= params.deltaMs

      if (distanceToPlayer <= MONSTER_AGGRO_RANGE) {
        this.updateAggroMonster(monster, playerPosition, distanceToPlayer, nowMs)
      } else {
        this.updateIdleMonster(monster, nowMs)
      }

      const movement = updateCharacterMovement({
        character: monster.character,
        mover: monster.controller,
        deltaMs: params.deltaMs,
        inputDirection: new Phaser.Math.Vector2(),
        canOccupy: (x, y) => params.canMonsterOccupy(monster, x, y),
      })

      if (movement.blockedClickMove) {
        monster.controller.clearDestination()
      }
    }
  }

  fireEquippedAttack(successStatus: string): void {
    const attackBundle = this.getCombinedEquippedAttackBundle()
    if (!attackBundle) {
      this.callbacks.setInteractionStatus('no weapon equipped')
      return
    }

    const result = executeRuntimeActionBundle({
      context: this.buildFacingActionContext(),
      actionBundle: attackBundle,
      collections: this.worldRuntime.getActionExecutionCollections(),
      successStatus,
      summonAttackIntervalMs: 1250,
      summonTargetingRange: 6.5,
    })
    this.worldRuntime.applyActionExecutionCollections(result)
    this.callbacks.setInteractionStatus(result.status)
  }

  updateProjectiles(deltaMs: number): void {
    if (this.worldRuntime.getProjectiles().length === 0) {
      return
    }

    const result = this.worldRuntime.updateProjectiles({
      deltaMs,
      targets: this.buildProjectileTargets(),
      canTraverse: (x, y, radius) => canOccupy(this.getDungeon(), x, y, radius),
    })

    if (result.impacts.length === 0 && result.expirations.length === 0) {
      return
    }

    const lifecycleResult = this.projectileLifecycleRuntime.applyLifecycle({
      impacts: result.impacts,
      expirations: result.expirations,
      nowMs: this.callbacks.getEffectNowMs(),
      setInteractionStatus: status => {
        this.callbacks.setInteractionStatus(status)
      },
      launchProjectileFromPosition: (
        attackerId,
        origin,
        target,
        attackSpec,
        successStatus
      ) => {
        this.launchProjectileFromPosition(attackerId, origin, target, attackSpec, successStatus)
      },
    })
    if (lifecycleResult.shouldSyncPlayerRuntime) {
      this.callbacks.syncPlayerState()
    }
  }

  deployDebugTotem(): void {
    const deployAction = buildDeployActionSpec(DEPLOY_ACTION_IDS.debugTotem)
    const result = deployFacingAction({
      context: this.buildFacingActionContext(),
      deployAction,
      deployables: this.worldRuntime.getDeployables(),
    })
    this.worldRuntime.applyActionExecutionCollections({
      deployables: result.deployables,
      summons: this.worldRuntime.getSummons(),
      projectiles: this.worldRuntime.getProjectiles(),
    })
    this.callbacks.setInteractionStatus(
      result.deployed
        ? `deployed ${deployAction.deployableId}`
        : 'deploy failed: blocked cell'
    )
  }

  private updateAggroMonster(
    monster: MonsterActor,
    playerPosition: Phaser.Math.Vector2,
    distanceToPlayer: number,
    nowMs: number
  ): void {
    const face = playerPosition.clone().subtract(monster.controller.getMapPosition())
    if (face.lengthSq() > 0) {
      monster.controller.setFacing(face.x, face.y)
    }

    if (distanceToPlayer <= MONSTER_ATTACK_RANGE) {
      monster.controller.clearDestination()
      if ((this.monsterNextAttackAtMs.get(monster.id) ?? 0) <= nowMs) {
        this.monsterNextAttackAtMs.set(monster.id, nowMs + MONSTER_ATTACK_INTERVAL_MS)
        this.launchProjectileFromPosition(
          monster.id,
          monster.controller.getMapPosition().clone(),
          playerPosition.clone(),
          buildMonsterProjectileAttackSpec(),
          `${monster.character.displayName} fired`
        )
      }
      monster.decisionCooldownMs = MONSTER_CHASE_REPATH_MS
      return
    }

    if (monster.decisionCooldownMs > 0 && monster.controller.hasDestination()) {
      return
    }

    const chasePath = findPathToTile({
      dungeon: this.getDungeon(),
      current: monster.controller.getMapPosition(),
      targetCell: {
        x: Phaser.Math.Clamp(Math.floor(playerPosition.x), 0, this.getDungeon().width - 1),
        y: Phaser.Math.Clamp(Math.floor(playerPosition.y), 0, this.getDungeon().height - 1),
      },
      playerRadius: monster.controller.getBodyRadius(),
      maxVisitedNodes: MONSTER_PATH_BUDGET,
      isCellBlocked: (x, y) => !this.canMonsterOccupyCell(monster, x, y),
    })
    if (chasePath.path && chasePath.path.length > 1) {
      monster.controller.setPath(chasePath.path.slice(1).map(node => cellCenter(node.x, node.y)))
    } else {
      monster.controller.setDestination(playerPosition.x, playerPosition.y)
    }
    monster.decisionCooldownMs = MONSTER_CHASE_REPATH_MS
  }

  private updateIdleMonster(monster: MonsterActor, nowMs: number): void {
    if (!monster.controller.hasDestination() && monster.decisionCooldownMs <= 0) {
      assignRandomMonsterDestination(monster, this.getDungeon(), (candidate, x, y) =>
        this.canMonsterOccupyWorld(candidate, x, y)
      )
      monster.decisionCooldownMs = MONSTER_WANDER_REPATH_MS + Phaser.Math.Between(0, 500)
    }

    if ((this.monsterNextAttackAtMs.get(monster.id) ?? 0) < nowMs - MONSTER_ATTACK_INTERVAL_MS) {
      this.monsterNextAttackAtMs.delete(monster.id)
    }
  }

  private canMonsterOccupyCell(monster: MonsterActor, tileX: number, tileY: number): boolean {
    const world = cellCenter(tileX, tileY)
    return this.canMonsterOccupyWorld(monster, world.x, world.y)
  }

  private canMonsterOccupyWorld(monster: MonsterActor, x: number, y: number): boolean {
    const monsterPosition = monster.controller.getMapPosition()
    const playerPosition = this.playerController.getMapPosition()
    if (!canOccupy(this.getDungeon(), x, y, monster.controller.getBodyRadius())) {
      return false
    }
    if (
      Phaser.Math.Distance.Between(x, y, playerPosition.x, playerPosition.y) <
      monster.controller.getBodyRadius() + this.playerController.getBodyRadius()
    ) {
      return false
    }

    return this.worldRuntime.getMonsters().every(candidate => {
      if (candidate.id === monster.id) {
        return true
      }

      const candidatePosition = candidate.controller.getMapPosition()
      return Phaser.Math.Distance.Between(x, y, candidatePosition.x, candidatePosition.y) >=
        monster.controller.getBodyRadius() + candidate.controller.getBodyRadius()
    }) && Phaser.Math.Distance.Between(x, y, monsterPosition.x, monsterPosition.y) >= 0
  }

  private getCombinedEquippedAttackBundle() {
    return buildEquippedActionBundle(
      this.playerCharacter.getInventory(),
      this.playerCharacter.getEquipmentLoadout()
    )
  }

  private buildFacingActionContext() {
    return {
      scene: this.scene,
      dungeon: this.getDungeon(),
      nowMs: this.callbacks.getNowMs(),
      ownerId: this.playerCharacter.id,
      origin: this.playerController.getMapPosition(),
      facing: this.playerController.getFacing(),
    }
  }

  private buildProjectileTargets(): ProjectileTarget[] {
    return this.worldRuntime.buildProjectileTargets({
      id: this.playerCharacter.id,
      character: this.playerCharacter,
      controller: this.playerController,
    })
  }

  private launchProjectileFromPosition(
    attackerId: string,
    origin: Phaser.Math.Vector2,
    target: Phaser.Math.Vector2,
    attackSpec: ProjectileActionSpec,
    successStatus: string
  ): void {
    const result = launchRuntimeProjectileFromPosition({
      scene: this.scene,
      nowMs: this.callbacks.getNowMs(),
      attackerId,
      origin,
      target,
      attackSpec,
      projectiles: this.worldRuntime.getProjectiles(),
      successStatus,
    })
    this.worldRuntime.applyActionExecutionCollections({
      deployables: this.worldRuntime.getDeployables(),
      summons: this.worldRuntime.getSummons(),
      projectiles: result.projectiles,
    })
    if (result.launched) {
      this.callbacks.setInteractionStatus(result.status)
    }
  }
}

function buildMonsterProjectileAttackSpec(): ProjectileActionSpec {
  return {
    deliveryType: 'projectile',
    definitionId: PROJECTILE_DEFINITION_IDS.debugBolt,
    onHitEvents: [
      {
        type: 'direct_damage',
        amount: 8,
      },
    ],
    onExpireEvents: [],
  }
}

function assignRandomMonsterDestination(
  monster: MonsterActor,
  dungeon: BSPDungeon,
  canOccupy: (monster: MonsterActor, x: number, y: number) => boolean
): void {
  const current = monster.controller.getMapPosition()
  const tileX = Math.floor(current.x)
  const tileY = Math.floor(current.y)
  const candidates = [
    { x: tileX - 1, y: tileY },
    { x: tileX + 1, y: tileY },
    { x: tileX, y: tileY - 1 },
    { x: tileX, y: tileY + 1 },
  ].filter(candidate => {
    if (!dungeon.isWalkable(candidate.x, candidate.y)) {
      return false
    }

    const center = cellCenter(candidate.x, candidate.y)
    return canOccupy(monster, center.x, center.y)
  })

  if (candidates.length === 0) {
    return
  }

  const target = Phaser.Math.RND.pick(candidates)
  const center = cellCenter(target.x, target.y)
  monster.controller.setDestination(center.x, center.y)
}
