import * as Phaser from 'phaser'
import type { PlayerCharacter } from '../characters/PlayerCharacter'
import type { CharacterController } from '../characters/CharacterController'
import type { GameWorldRuntime } from '../world/GameWorldRuntime'
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
import { canOccupy } from '../navigation/NavigationRules'

export class SceneCombatRuntime {
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
