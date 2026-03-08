import * as Phaser from 'phaser'
import type { CharacterController } from '../characters/CharacterController'
import type { PlayerCharacter } from '../characters/PlayerCharacter'
import type { EffectRuntimeSceneState } from './EffectRuntimeSceneBridge'
import {
  resolveDebugDamageSurvival,
  resolveRespawnSurvival,
  resolveTrapSurvival,
} from './SceneSurvivalFlow'
import type { Trap } from '../world/WorldObjects'

export interface PlayerSurvivalRuntimeCallbacks {
  isDead: () => boolean
  getSpawnTile: () => { x: number; y: number }
  getFloorIndex: () => number
  getDungeonSize: () => { width: number; height: number }
  getTrapAt: (tileX: number, tileY: number) => Trap | undefined
  getNowMs: () => number
  getEffectNowMs: () => number
  syncPlayerState: () => void
  saveProgress: () => void
  setInteractionStatus: (status: string) => void
}

export class PlayerSurvivalRuntime {
  constructor(
    private readonly playerCharacter: PlayerCharacter,
    private readonly playerController: CharacterController,
    private readonly effectRuntimeSceneState: EffectRuntimeSceneState,
    private readonly callbacks: PlayerSurvivalRuntimeCallbacks
  ) {}

  tryTriggerTrap(params: {
    trapRearmMs: number
    trapDamageAmount: number
    poisonDamagePerSecond: number
  }): void {
    const current = this.playerController.getMapPosition()
    const dungeonSize = this.callbacks.getDungeonSize()
    const tileX = Phaser.Math.Clamp(Math.floor(current.x), 0, dungeonSize.width - 1)
    const tileY = Phaser.Math.Clamp(Math.floor(current.y), 0, dungeonSize.height - 1)
    const result = resolveTrapSurvival({
      trap: this.callbacks.getTrapAt(tileX, tileY),
      nowMs: this.callbacks.getNowMs(),
      trapRearmMs: params.trapRearmMs,
      trapDamageAmount: params.trapDamageAmount,
      poisonDamagePerSecond: params.poisonDamagePerSecond,
      health: this.playerCharacter.getHealth(),
      poisoned: this.playerCharacter.isPoisoned(),
      guardActive: this.playerCharacter.isGuardActive(this.callbacks.getEffectNowMs()),
      effectRuntimeSceneState: this.effectRuntimeSceneState,
    })
    if (!result.triggered) {
      return
    }

    this.playerCharacter.setHealth(result.health)
    this.playerCharacter.setPoisoned(result.poisoned)
    this.callbacks.syncPlayerState()
    this.callbacks.setInteractionStatus(result.status)
    this.callbacks.saveProgress()
  }

  tryApplyDebugDamage(debugDamageKey: Phaser.Input.Keyboard.Key, damageAmount: number, blocked: boolean): void {
    if (blocked || !Phaser.Input.Keyboard.JustDown(debugDamageKey)) {
      return
    }

    const result = resolveDebugDamageSurvival(this.playerCharacter.getHealth(), damageAmount)
    this.playerCharacter.setHealth(result.health)
    this.callbacks.setInteractionStatus(result.status)
    this.callbacks.syncPlayerState()
    this.callbacks.saveProgress()
  }

  tryRespawn(respawnKey: Phaser.Input.Keyboard.Key, respawnHealthRatio: number): void {
    if (!this.callbacks.isDead() || !Phaser.Input.Keyboard.JustDown(respawnKey)) {
      return
    }

    const result = resolveRespawnSurvival({
      spawnTile: this.callbacks.getSpawnTile(),
      maxHealth: this.playerCharacter.getMaxHealth(),
      respawnHealthRatio,
      floorIndex: this.callbacks.getFloorIndex(),
      effectRuntimeSceneState: this.effectRuntimeSceneState,
    })
    this.playerController.clearDestination()
    this.playerController.setMapPosition(result.spawn.x, result.spawn.y)
    this.playerController.commitMapPosition(result.spawn.x, result.spawn.y)
    this.playerCharacter.setHealth(result.health)
    this.playerCharacter.setPoisoned(result.poisoned)
    this.playerCharacter.setGuardBuffRemainingMs(result.guardBuffRemainingMs, this.callbacks.getEffectNowMs())
    this.callbacks.setInteractionStatus(result.status)
    this.callbacks.syncPlayerState()
    this.callbacks.saveProgress()
  }
}
