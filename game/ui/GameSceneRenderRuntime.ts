import * as Phaser from 'phaser'
import { worldToScreen } from '../iso'
import { pointerToTile } from '../navigation/NavigationRules'
import type { Player } from '../entities/Player'
import type { PlayerCharacter } from '../characters/PlayerCharacter'
import type { CharacterController } from '../characters/CharacterController'
import type { EffectRuntimeSceneState } from '../interactions/EffectRuntimeSceneBridge'
import { getItemCooldownSummaryText } from '../interactions/EffectRuntimeSceneBridge'
import type { DialoguePanel } from './DialoguePanel'
import type { EffectHudManager } from './EffectHudManager'
import type { FacingCaret } from './FacingCaret'
import type { GameWorldRuntime } from '../world/GameWorldRuntime'
import type { GameSceneWorldRenderer } from '../world/GameSceneWorldRenderer'
import type { GameSceneHudRuntime } from './GameSceneHudRuntime'
import type { BSPDungeon, TileType } from '../map/BSPDungeon'
import type { Interactable, Trap } from '../world/WorldObjects'
import type { SceneInventoryRuntime } from '../items/SceneInventoryRuntime'

export interface GameSceneRenderRuntimeParams {
  scene: Phaser.Scene
  dungeon: BSPDungeon
  tilePool: Phaser.GameObjects.Image[]
  pathGraphics: Phaser.GameObjects.Graphics
  hoverMarker: Phaser.GameObjects.Ellipse
  hudText: Phaser.GameObjects.Text
  player: Player
  playerCharacter: PlayerCharacter
  playerController: CharacterController
  worldRuntime: GameWorldRuntime
  worldRenderer: GameSceneWorldRenderer
  hudRuntime: GameSceneHudRuntime
  effectHud: EffectHudManager
  facingCaret: FacingCaret
  dialoguePanel: DialoguePanel
  inventoryRuntime: SceneInventoryRuntime
  effectRuntimeSceneState: EffectRuntimeSceneState
  interactables: Interactable[]
  traps: Trap[]
  floorIndex: number
  gold: number
  visibleTilesCount: number
  pathStatus: string
  interactionStatus: string
  journeyChapter: string
  achievementsText: string
  potionCount: number
  keyCount: number
  inventorySummary: string
  isMoving: boolean
  showDebugHud: boolean
  searchBudget: number
  searchBudgetMultiplier: number
  nowMs: number
  effectNowMs: number
  dialoguePanelState: unknown
  getTileTexture: (tile: TileType, gx: number, gy: number) => string
  nearbyInteractable: Interactable | null
  isDead: boolean
}

export class GameSceneRenderRuntime {
  render(params: GameSceneRenderRuntimeParams): void {
    const { width, height } = params.scene.scale
    const playerWorld = params.playerController.getMapPosition()
    const playerScreen = worldToScreen(playerWorld)

    params.worldRenderer.drawTiles({
      dungeon: params.dungeon,
      tilePool: params.tilePool,
      playerScreen,
      width,
      height,
      getTileTexture: params.getTileTexture,
    })
    params.worldRenderer.drawTraps({
      traps: params.traps,
      nowMs: params.nowMs,
      trapRearmMs: 1600,
      playerScreen,
      width,
      height,
    })
    params.worldRenderer.drawInteractables({
      interactables: params.interactables,
      nearbyInteractableId: params.nearbyInteractable?.id ?? null,
      playerScreen,
      width,
      height,
    })
    params.worldRuntime.draw({
      playerScreen,
      width,
      height,
      deltaMs: params.scene.game.loop.delta,
      nowMs: params.nowMs,
    })
    params.worldRenderer.drawPath({
      pathGraphics: params.pathGraphics,
      playerWorld,
      pathPoints: params.playerController.getPathPoints(),
      playerScreen,
      width,
      height,
    })

    const hoveredTile = pointerToTile({
      screenX: params.scene.input.activePointer.x,
      screenY: params.scene.input.activePointer.y,
      viewportWidth: width,
      viewportHeight: height,
      playerWorld,
      dungeon: params.dungeon,
    })
    params.worldRenderer.drawHoverMarker({
      hoverMarker: params.hoverMarker,
      hoveredTile,
      dungeon: params.dungeon,
      playerScreen,
      width,
      height,
    })

    params.player.syncScreenPosition(
      width / 2,
      height / 2 - 18,
      params.isMoving || params.playerController.hasDestination(),
      params.scene.game.loop.delta
    )
    const facing = params.playerController.getFacing()
    params.facingCaret.render(width / 2, height / 2 - 18, facing.x, facing.y)
    params.dialoguePanel.render(width, height, params.dialoguePanelState as never)
    params.inventoryRuntime.render(width, {
      x: params.scene.input.activePointer.x,
      y: params.scene.input.activePointer.y,
    })

    const destination = params.playerController.getDestination()
    const finalDestination = params.playerController.getFinalDestination()
    const cooldownSummary = getItemCooldownSummaryText(params.effectRuntimeSceneState)
    params.hudText.setVisible(params.showDebugHud)
    if (params.showDebugHud) {
      params.hudRuntime.renderHudText(params.hudText, {
        floorIndex: params.floorIndex,
        movementMode: params.playerController.getMovementMode(),
        animationState: params.player.getAnimationState(),
        facingText: params.playerController.getFacingLabel(),
        tileX: Math.floor(playerWorld.x),
        tileY: Math.floor(playerWorld.y),
        worldX: playerWorld.x,
        worldY: playerWorld.y,
        pathLength: params.playerController.getPathLength(),
        destinationText: destination ? `${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}` : 'none',
        goalText: finalDestination ? `${finalDestination.x.toFixed(2)}, ${finalDestination.y.toFixed(2)}` : 'none',
        visionRadius: params.playerCharacter.getVisionRadius(),
        visibleTiles: params.visibleTilesCount,
        searchBudget: params.searchBudget,
        searchBudgetMultiplier: params.searchBudgetMultiplier,
        pathStatus: params.pathStatus,
        interactionStatus: params.interactionStatus,
        jobLabel: params.playerCharacter.getJob().label,
        health: params.playerCharacter.getHealth(),
        maxHealth: params.playerCharacter.getMaxHealth(),
        mana: params.playerCharacter.getMana(),
        maxMana: params.playerCharacter.getMaxMana(),
        healthRegen: params.playerCharacter.getHealthRegen(),
        manaRegen: params.playerCharacter.getManaRegen(),
        meleeAttack: params.playerCharacter.getMeleeAttack(),
        rangedAttack: params.playerCharacter.getRangedAttack(),
        meleeMagicAttack: params.playerCharacter.getMeleeMagicAttack(),
        rangedMagicAttack: params.playerCharacter.getRangedMagicAttack(),
        defense: params.playerCharacter.getDefense(),
        moveSpeed: params.playerCharacter.getMoveSpeed(),
        attackSpeed: params.playerCharacter.getAttackSpeed(),
        magicAttackSpeed: params.playerCharacter.getMagicAttackSpeed(),
        fullDefenseChance: params.playerCharacter.getFullDefenseChance(),
        cooldownSummary,
        dead: params.isDead,
        gold: params.gold,
        potionCount: params.potionCount,
        keyCount: params.keyCount,
        inventorySummary: params.inventorySummary,
        journeyChapter: params.journeyChapter,
        achievementsText: params.achievementsText,
      })
    }
    params.effectHud.render(width, height, {
      x: params.scene.input.activePointer.x,
      y: params.scene.input.activePointer.y,
    }, {
      nowMs: params.effectNowMs,
      activeItemBuffs: params.effectRuntimeSceneState.activeItemBuffs,
      activeDebuffs: params.effectRuntimeSceneState.activeDebuffs,
      poisoned: params.playerCharacter.isPoisoned(),
      guardBuffRemainingMs: params.playerCharacter.getGuardBuffRemainingMs(params.effectNowMs),
      dead: params.isDead,
    })
  }
}
