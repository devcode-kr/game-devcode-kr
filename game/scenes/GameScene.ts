import * as Phaser from 'phaser'
import { CharacterController } from '../characters/CharacterController'
import { Player } from '../entities/Player'
import { PlayerCharacter } from '../characters/PlayerCharacter'
import {
  isCharacterMovementArrived,
  updateCharacterMovement,
} from '../characters/CharacterMovementRuntime'
import {
  getStackPrimaryItemInstanceId,
  getStackIdByItemInstanceId,
  moveInventoryStack,
  removeSingleItemByDefinition,
  transferInventoryStack,
} from '../items/Inventory'
import type { ActionBundle } from '../interactions/ActionBundleRules'
import {
  assignItemToEquipmentTarget,
  buildAutomaticEquipmentLoadout,
  clearEquipmentTarget,
  type EquipmentSlotTarget,
  getEquipmentTargetInstanceId,
  getEquipmentStatBonuses,
  isCharacterEquipmentLoadoutEmpty,
  reconcileCharacterEquipmentLoadout,
} from '../items/CharacterEquipmentLoadout'
import {
  addInventoryItems,
  getInventorySummaryText as summarizeInventory,
  getItemCountAcrossInventories,
} from '../items/InventoryUtils'
import {
  getActiveItemBuffStatBonuses,
  restoreActiveItemBuffs,
  serializeActiveItemBuffs,
} from '../items/ItemStatRules'
import {
  restoreItemCooldowns,
  serializeItemCooldowns,
} from '../items/ItemCooldownRules'
import {
  canOccupy,
  canOccupyCell,
  computeVisibleTiles,
  findPathToTile,
  getPathSearchBudget,
  pointerToTile,
} from '../navigation/NavigationRules'
import {
  advanceDialogue,
  getDialoguePanelState,
  type ActiveDialogue,
} from '../interactions/DialogueFlow'
import {
  getNearbyInteractionStatus,
  resolveSceneInteraction,
} from '../interactions/SceneInteractionFlow'
import {
  isDead,
} from '../interactions/SurvivalRules'
import { runInventoryItemUseFlow } from '../interactions/InventoryItemUseFlow'
import { applyDebuffToCharacter } from '../interactions/CharacterDebuffRuntime'
import { canCharacterAttackCharacter } from '../interactions/CombatTargetRules'
import type {
  ProjectileActionSpec,
  ProjectileLifecycleEvent,
} from '../interactions/ActionSpecs'
import { buildDeployActionSpec, DEPLOY_ACTION_IDS } from '../interactions/DeployActionBuilder'
import {
  deployFacingAction,
  executeActionBundle as executeRuntimeActionBundle,
  launchProjectileFromPosition as launchRuntimeProjectileFromPosition,
  updateDeployableAttacks as updateRuntimeDeployableAttacks,
  updateSummonActions,
} from '../interactions/ActionExecutionRuntime'
import { buildEquippedActionBundle } from '../interactions/EquippedActionBundleRules'
import { getProjectileDefinition } from '../interactions/ProjectileDefinitions'
import type { ProjectileExpiration, ProjectileImpact, ProjectileTarget } from '../interactions/ProjectileRuntime'
import { EffectRuntimeClient } from '../interactions/EffectRuntimeClient'
import {
  restoreEffectRuntimeCollections,
} from '../interactions/EffectRuntimeMutations'
import {
  resolveDebugDamageSurvival,
  resolveRespawnSurvival,
  resolveTrapSurvival,
} from '../interactions/SceneSurvivalFlow'
import { type EffectRuntimeState } from '../interactions/EffectRuntimeProtocol'
import {
  applyEffectRuntimeWorkerState,
  areEffectRuntimeStatesEqual,
  buildEffectRuntimeState,
  createInitialEffectRuntimeSceneState,
  getActiveDebuffStatModifiers,
  getItemCooldownSummaryText,
} from '../interactions/EffectRuntimeSceneBridge'
import {
  restoreEffectDebuffs,
  serializeEffectDebuffs,
  upsertEffectDebuff,
} from '../interactions/EffectDebuffRules'
import { resolveProjectileAreaDamageHits } from '../interactions/ProjectileAreaDamageRules'
import { BSPDungeon, TileType } from '../map/BSPDungeon'
import {
  createLocalStorageProgressStore,
  type AchievementState,
  type JourneyLog,
  type ProgressSnapshot,
  type ProgressStore,
} from '../progress/ProgressStore'
import {
  applyGameSceneProgressSnapshot,
  createGameSceneProgressSnapshot,
} from '../progress/GameSceneProgress'
import {
  markEnteredDungeon,
  markReachedFloor,
} from '../progress/ProgressionRules'
import {
  cellCenter,
  HALF_TILE_HEIGHT,
  HALF_TILE_WIDTH,
  type IsoPoint,
  TILE_HEIGHT,
  TILE_WIDTH,
  worldToScreen,
} from '../iso'
import { DialoguePanel } from '../ui/DialoguePanel'
import { EffectHudManager } from '../ui/EffectHudManager'
import { bakeEffectIconTextures } from '../ui/EffectIconTextures'
import { FacingCaret } from '../ui/FacingCaret'
import { EquipmentPanel } from '../ui/EquipmentPanel'
import { buildGameSceneHudText } from '../ui/GameSceneHudText'
import { InventoryPanel } from '../ui/InventoryPanel'
import { type Interactable, type Trap } from '../world/WorldObjects'
import { createMonsterActors, destroyMonsterActors, drawMonsterActors, type MonsterActor, updateMonsterActors } from '../world/MonsterActors'
import {
  destroyDeployableActors,
  drawDeployableActors,
  type DeployableActor,
  updateDeployableActors,
} from '../world/DeployableActors'
import {
  destroySummonActors,
  drawSummonActors,
  type SummonActor,
} from '../world/SummonActors'
import {
  destroyProjectileActors,
  drawProjectileActors,
  type ProjectileActor,
  updateProjectileActors,
} from '../world/ProjectileActors'
import {
  bakeWorldTextures,
  findNearbyInteractable,
} from '../world/WorldBuilder'
import { generateFloorState } from '../world/FloorFlow'
import { TEST_BELT_ITEM_DEFINITION_IDS, TEST_SHAPE_ITEM_DEFINITION_IDS } from '../items/ItemCatalog'

const POOL_SIZE = 1000
const PLAYER_BODY_RADIUS = 0.24
const MONSTER_BODY_RADIUS = 0.24
const PATH_SEARCH_BUDGET_MULTIPLIER = 1.5
const MIN_PATH_SEARCH_BUDGET = 8
const INTERACTION_RANGE = 1.1
const PROGRESS_STORAGE_KEY = 'game-devcode-kr/progress'
const INVENTORY_COLS = 6
const INVENTORY_ROWS = 8
const BELT_COLS = 5
const BELT_ROWS = 1
const DEBUG_DAMAGE_AMOUNT = 25
const TRAP_DAMAGE_AMOUNT = 20
const TRAP_REARM_MS = 1600
const RESPAWN_HEALTH_RATIO = 0.5
const EFFECT_TICK_MS = 100
const POISON_DOT_DAMAGE_PER_SECOND = 3
const SUMMON_ATTACK_INTERVAL_MS = 1250
const SUMMON_TARGETING_RANGE = 6.5

export class GameScene extends Phaser.Scene {
  private player!: Player
  private readonly playerCharacter = new PlayerCharacter({
    inventoryCols: INVENTORY_COLS,
    inventoryRows: INVENTORY_ROWS,
    beltCols: BELT_COLS,
    beltRows: BELT_ROWS,
  })
  private readonly playerController = new CharacterController(this.playerCharacter, PLAYER_BODY_RADIUS)
  private dungeon!: BSPDungeon
  private tilePool: Phaser.GameObjects.Image[] = []
  private pathGraphics!: Phaser.GameObjects.Graphics
  private inputVector = new Phaser.Math.Vector2()
  private visibleTiles = new Set<string>()
  private interactables: Interactable[] = []
  private traps: Trap[] = []
  private monsters: MonsterActor[] = []
  private deployables: DeployableActor[] = []
  private summons: SummonActor[] = []
  private projectiles: ProjectileActor[] = []
  private hoverMarker!: Phaser.GameObjects.Ellipse
  private hudText!: Phaser.GameObjects.Text
  private effectHud!: EffectHudManager
  private facingCaret!: FacingCaret
  private dialoguePanel!: DialoguePanel
  private inventoryPanel!: InventoryPanel
  private equipmentPanel!: EquipmentPanel
  private pathStatus = 'idle'
  private interactionStatus = 'none'
  private floorIndex = 1
  private gold = 0
  private spawnTile = { x: 0, y: 0 }
  private activeDialogue: ActiveDialogue | null = null
  private journeyLog: JourneyLog = {
    currentChapter: 'Entered the dungeon',
    steps: {
      enteredDungeon: false,
      talkedToNpc: false,
      foundKey: false,
      openedLockedChest: false,
      reachedNextFloor: false,
    },
  }
  private achievements: AchievementState = {
    counters: {
      npcTalks: 0,
      chestsOpened: 0,
      lockedChestsOpened: 0,
      keysCollected: 0,
      floorsReached: 1,
    },
    unlocked: [],
  }
  private readonly progressStore: ProgressStore = createLocalStorageProgressStore(PROGRESS_STORAGE_KEY)
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private interactKey!: Phaser.Input.Keyboard.Key
  private usePotionKey!: Phaser.Input.Keyboard.Key
  private debugDamageKey!: Phaser.Input.Keyboard.Key
  private fireProjectileKey!: Phaser.Input.Keyboard.Key
  private deployActionKey!: Phaser.Input.Keyboard.Key
  private attackModifierKey!: Phaser.Input.Keyboard.Key
  private respawnKey!: Phaser.Input.Keyboard.Key
  private inventoryKey!: Phaser.Input.Keyboard.Key
  private inventoryTestItemsKey!: Phaser.Input.Keyboard.Key
  private readonly effectRuntimeSceneState = createInitialEffectRuntimeSceneState(0)
  private effectRuntimeClient: EffectRuntimeClient | null = null
  private latestEffectRuntimeRevision = 0
  private latestEffectRuntimeSyncRevision = 0

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    this.cameras.main.setBackgroundColor(0x111111)
    this.effectRuntimeSceneState.nowMs = this.time.now

    this.bakeDiamonds()
    bakeEffectIconTextures(this)

    for (let i = 0; i < POOL_SIZE; i++) {
      this.tilePool.push(this.add.image(-9999, -9999, 'tile-a').setDepth(1))
    }

    this.pathGraphics = this.add.graphics()
    this.pathGraphics.setDepth(9996)

    this.player = new Player(this, this.playerController)

    this.hoverMarker = this.add.ellipse(0, 0, 28, 14)
    this.hoverMarker.setStrokeStyle(2, 0xf59e0b, 0.95)
    this.hoverMarker.setFillStyle(0x000000, 0)
    this.hoverMarker.setDepth(9997)

    this.hudText = this.add.text(16, 16, '', {
      color: '#f8fafc',
      fontSize: '14px',
      fontFamily: 'monospace',
      backgroundColor: '#00000066',
      padding: { x: 10, y: 8 },
    })
    this.hudText.setDepth(10000)
    this.hudText.setScrollFactor(0)

    this.effectHud = new EffectHudManager(this)
    this.facingCaret = new FacingCaret(this)
    this.dialoguePanel = new DialoguePanel(this)
    this.inventoryPanel = new InventoryPanel(this)
    this.equipmentPanel = new EquipmentPanel(this)

    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.usePotionKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q)
    this.debugDamageKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H)
    this.fireProjectileKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F)
    this.deployActionKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V)
    this.attackModifierKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
    this.respawnKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    this.inventoryKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I)
    this.inventoryTestItemsKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T)

    this.loadProgress()
    this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
    this.initializeEffectRuntimeWorker()
    this.generateFloor(true)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.effectRuntimeClient?.destroy()
      this.effectRuntimeClient = null
      this.effectHud.destroy()
      this.facingCaret.destroy()
      this.equipmentPanel.destroy()
      destroyDeployableActors(this.deployables)
      destroySummonActors(this.summons)
      destroyProjectileActors(this.projectiles)
      destroyMonsterActors(this.monsters)
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.inventoryPanel.isOpen()) {
        const equipmentClick = this.equipmentPanel.handlePointerDown(pointer.x, pointer.y)
        if (equipmentClick.target) {
          if (this.getSelectedInventoryItemInstanceId()) {
            this.applyEquipmentPanelSelection(equipmentClick.target)
          } else if (pointer.button === 0 && this.isEquipmentTargetFilled(equipmentClick.target)) {
            this.equipmentPanel.startDragging(equipmentClick.target)
          }
        }
        if (equipmentClick.consumed) {
          return
        }
      }

      if (this.inventoryPanel.isOpen()) {
        const inventoryClick = this.inventoryPanel.handlePointerDown(
          pointer.x,
          pointer.y,
          pointer.button,
          this.scale.width,
          this.playerCharacter.getInventory(),
          this.playerCharacter.getBeltInventory()
        )
        if (inventoryClick.requestedUseItemDefinitionId) {
          this.useInventoryItem(inventoryClick.requestedUseItemDefinitionId)
        }
        if (inventoryClick.consumed) {
          return
        }
      }

      if (this.activeDialogue) {
        return
      }

      if (pointer.button !== 0) {
        return
      }

      const targetCell = pointerToTile({
        screenX: pointer.x,
        screenY: pointer.y,
        viewportWidth: this.scale.width,
        viewportHeight: this.scale.height,
        playerWorld: this.playerController.getMapPosition(),
        dungeon: this.dungeon,
      })
      if (!targetCell) {
        this.playerController.clearDestination()
        this.pathStatus = 'path failed: out of bounds'
        return
      }

      if (this.attackModifierKey.isDown) {
        this.faceTowardCell(targetCell)
        const attackBundle = this.getCombinedEquippedAttackBundle()
        if (!attackBundle) {
          this.interactionStatus = 'no weapon equipped'
          return
        }

        const result = executeRuntimeActionBundle({
          context: this.buildFacingActionContext(),
          actionBundle: attackBundle,
          collections: this.getActionExecutionCollections(),
          successStatus: 'weapon attack fired',
          summonAttackIntervalMs: SUMMON_ATTACK_INTERVAL_MS,
          summonTargetingRange: SUMMON_TARGETING_RANGE,
        })
        this.applyActionExecutionCollections(result)
        this.interactionStatus = result.status
        return
      }

      if (!this.canOccupyCell(targetCell.x, targetCell.y)) {
        this.playerController.clearDestination()
        this.pathStatus = 'path failed: blocked target'
        return
      }

      this.applyPathToTile(targetCell, 'path ready')
    })

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.inventoryPanel.isOpen()) {
        return
      }

      const draggingEquipmentTarget = this.equipmentPanel.getDraggingTarget()
      if (draggingEquipmentTarget) {
        const handled = this.tryDropDraggedEquipmentIntoInventory(draggingEquipmentTarget, pointer.x, pointer.y)
        this.equipmentPanel.clearDragging()
        if (handled) {
          return
        }
      }

      if (this.inventoryPanel.getDraggingStackId()) {
        const equipmentDrop = this.equipmentPanel.handlePointerUp(pointer.x, pointer.y)
        if (equipmentDrop.target) {
          this.applyEquipmentPanelSelection(equipmentDrop.target)
          this.inventoryPanel.clearDragging()
          return
        }
      }

      const inventoryClick = this.inventoryPanel.handlePointerUp(
        pointer.x,
        pointer.y,
        this.scale.width,
        this.playerCharacter.getInventory(),
        this.playerCharacter.getBeltInventory()
      )
      if (!inventoryClick.requestedMove) {
        return
      }

      const sourceInventory = inventoryClick.requestedMove.sourceInventoryKind === 'belt'
        ? this.playerCharacter.getBeltInventory()
        : this.playerCharacter.getInventory()
      const targetInventory = inventoryClick.requestedMove.targetInventoryKind === 'belt'
        ? this.playerCharacter.getBeltInventory()
        : this.playerCharacter.getInventory()
      const moved = sourceInventory === targetInventory
        ? moveInventoryStack(
            targetInventory,
            inventoryClick.requestedMove.stackId,
            inventoryClick.requestedMove.x,
            inventoryClick.requestedMove.y
          )
        : transferInventoryStack(
            sourceInventory,
            targetInventory,
            inventoryClick.requestedMove.stackId,
            inventoryClick.requestedMove.x,
            inventoryClick.requestedMove.y
          )
      this.interactionStatus = moved
        ? `${inventoryClick.requestedMove.sourceInventoryKind} -> ${inventoryClick.requestedMove.targetInventoryKind} ${inventoryClick.requestedMove.x},${inventoryClick.requestedMove.y}`
        : 'cannot move item there'
      if (moved) {
        this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
        this.syncEffectRuntimeState()
        this.saveProgress()
      }
    })

    this.drawDungeon(false)
  }

  update(_time: number, delta: number) {
    const movementResult = updateCharacterMovement({
      character: this.playerCharacter,
      mover: this.playerController,
      deltaMs: delta,
      inputDirection: this.activeDialogue || this.isDead() ? new Phaser.Math.Vector2() : this.readInputVector(),
      canOccupy: (x, y) => this.canOccupy(x, y),
    })
    const { input, movement, isMoving, blockedClickMove } = movementResult

    if (blockedClickMove) {
      const repathed = this.repathToActiveGoal()
      if (!repathed) {
        this.playerController.clearDestination()
        this.pathStatus = 'path failed: repath unavailable'
      }
    }

    this.effectRuntimeClient?.advance(delta)
    updateMonsterActors({
      monsters: this.monsters,
      deltaMs: delta,
      dungeon: this.dungeon,
      canOccupy: (monster, x, y) => this.canMonsterOccupy(monster.id, x, y),
    })
    this.tryFireProjectile()
    this.tryDeployAction()
    this.deployables = updateDeployableActors(this.deployables, this.time.now)
    const deployableAttackResult = updateRuntimeDeployableAttacks({
      scene: this,
      nowMs: this.time.now,
      deployables: this.deployables,
      projectiles: this.projectiles,
      findNearestMonster: (x, y, range) => this.findNearestMonster(x, y, range),
    })
    this.projectiles = deployableAttackResult.projectiles
    if (deployableAttackResult.status) {
      this.interactionStatus = deployableAttackResult.status
    }
    const summonResult = updateSummonActions({
      scene: this,
      nowMs: this.time.now,
      deltaMs: delta,
      summons: this.summons,
      projectiles: this.projectiles,
      ownerPosition: this.playerController.getMapPosition(),
      findNearestTarget: (x, y, range) => {
        const monster = this.findNearestMonster(x, y, range)
        return monster?.controller.getMapPosition() ?? null
      },
    })
    this.summons = summonResult.summons
    this.projectiles = summonResult.projectiles
    if (summonResult.status) {
      this.interactionStatus = summonResult.status
    }
    this.updateProjectiles(delta)
    this.refreshVisibility()
    this.tryToggleInventory()
    this.tryAddInventoryTestItems()
    this.tryRespawn()
    this.tryTriggerTrap()
    this.tryApplyDebugDamage()
    this.tryUsePotion()
    this.tryInteract()

    if (input.lengthSq() > 0) {
      this.pathStatus = 'manual override'
    } else if (isCharacterMovementArrived(movement.mode, this.playerController.hasDestination())) {
      this.pathStatus = 'arrived'
    }

    this.drawDungeon(isMoving)
  }

  private bakeDiamonds() {
    const variants: Array<{ key: string; fill: number; stroke: number }> = [
      { key: 'tile-a', fill: 0x3a5c3a, stroke: 0xaabbaa },
      { key: 'tile-b', fill: 0x2e4a2e, stroke: 0x90aa90 },
      { key: 'tile-corridor', fill: 0x355767, stroke: 0x9eb9c3 },
    ]

    for (const variant of variants) {
      if (this.textures.exists(variant.key)) {
        this.textures.remove(variant.key)
      }

      const graphics = this.make.graphics({ x: 0, y: 0 }, false)
      graphics.fillStyle(variant.fill, 1)
      graphics.lineStyle(1, variant.stroke, 0.65)
      graphics.beginPath()
      graphics.moveTo(HALF_TILE_WIDTH, 0)
      graphics.lineTo(TILE_WIDTH, HALF_TILE_HEIGHT)
      graphics.lineTo(HALF_TILE_WIDTH, TILE_HEIGHT)
      graphics.lineTo(0, HALF_TILE_HEIGHT)
      graphics.closePath()
      graphics.fillPath()
      graphics.strokePath()
      graphics.generateTexture(variant.key, TILE_WIDTH, TILE_HEIGHT)
      graphics.destroy()
    }

    bakeWorldTextures(this)
  }

  private drawDungeon(isMoving: boolean) {
    const { width, height } = this.scale
    const playerWorld = this.playerController.getMapPosition()
    const playerScreen = worldToScreen(playerWorld)
    const grid = this.dungeon.getGrid()
    let poolIdx = 0

    for (let gy = 0; gy < this.dungeon.height; gy++) {
      for (let gx = 0; gx < this.dungeon.width; gx++) {
        const tile = grid[gy][gx]
        if (tile === TileType.WALL) continue

        const screen = worldToScreen(cellCenter(gx, gy))
        const sx = screen.x - playerScreen.x + width / 2
        const sy = screen.y - playerScreen.y + height / 2

        if (sx + HALF_TILE_WIDTH < 0 || sx - HALF_TILE_WIDTH > width) continue
        if (sy + HALF_TILE_HEIGHT < 0 || sy - HALF_TILE_HEIGHT > height) continue

        if (poolIdx < this.tilePool.length) {
          const image = this.tilePool[poolIdx++]
          image.setPosition(sx, sy)
          image.setDepth(100 + gx + gy)
          image.setTexture(this.getTileTexture(tile, gx, gy))
        }
      }
    }

    for (; poolIdx < this.tilePool.length; poolIdx++) {
      this.tilePool[poolIdx].setPosition(-9999, -9999)
    }

    this.drawTraps(playerScreen, width, height)
    this.drawInteractables(playerScreen, width, height)
    drawMonsterActors({
      monsters: this.monsters,
      playerScreen,
      width,
      height,
      deltaMs: this.game.loop.delta,
    })
    drawDeployableActors({
      deployables: this.deployables,
      playerScreen,
      width,
      height,
      nowMs: this.time.now,
    })
    drawSummonActors({
      summons: this.summons,
      playerScreen,
      width,
      height,
      nowMs: this.time.now,
    })
    drawProjectileActors({
      projectiles: this.projectiles,
      playerScreen,
      width,
      height,
    })
    this.drawPath(playerWorld, playerScreen, width, height)

    const hoveredTile = pointerToTile({
      screenX: this.input.activePointer.x,
      screenY: this.input.activePointer.y,
      viewportWidth: width,
      viewportHeight: height,
      playerWorld: playerWorld,
      dungeon: this.dungeon,
    })
    if (hoveredTile && this.dungeon.isWalkable(hoveredTile.x, hoveredTile.y)) {
      const marker = worldToScreen(cellCenter(hoveredTile.x, hoveredTile.y))
      this.hoverMarker.setVisible(true)
      this.hoverMarker.setPosition(
        marker.x - playerScreen.x + width / 2,
        marker.y - playerScreen.y + height / 2
      )
    } else {
      this.hoverMarker.setVisible(false)
    }

    this.player.syncScreenPosition(width / 2, height / 2 - 18, isMoving || this.playerController.hasDestination(), this.game.loop.delta)
    const facing = this.playerController.getFacing()
    this.facingCaret.render(width / 2, height / 2 - 18, facing.x, facing.y)
    this.dialoguePanel.render(width, height, getDialoguePanelState(this.activeDialogue))
    this.inventoryPanel.render(width, this.playerCharacter.getInventory(), this.playerCharacter.getBeltInventory(), {
      x: this.input.activePointer.x,
      y: this.input.activePointer.y,
    })
    this.equipmentPanel.render(
      width,
      this.playerCharacter.getEquipmentLoadout(),
      this.playerCharacter.getInventory(),
      this.inventoryPanel.isOpen(),
      {
        x: this.input.activePointer.x,
        y: this.input.activePointer.y,
      },
      this.getSelectedInventoryItemDefinitionId()
    )

    const destination = this.playerController.getDestination()
    const finalDestination = this.playerController.getFinalDestination()
    const inventorySummary = this.getInventorySummaryText()
    const cooldownSummary = getItemCooldownSummaryText(this.effectRuntimeSceneState)
    this.hudText.setText(buildGameSceneHudText({
      floorIndex: this.floorIndex,
      movementMode: this.playerController.getMovementMode(),
      animationState: this.player.getAnimationState(),
      facingText: this.playerController.getFacingLabel(),
      tileX: Math.floor(playerWorld.x),
      tileY: Math.floor(playerWorld.y),
      worldX: playerWorld.x,
      worldY: playerWorld.y,
      pathLength: this.playerController.getPathLength(),
      destinationText: destination ? `${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}` : 'none',
      goalText: finalDestination ? `${finalDestination.x.toFixed(2)}, ${finalDestination.y.toFixed(2)}` : 'none',
      visionRadius: this.playerCharacter.getVisionRadius(),
      visibleTiles: this.visibleTiles.size,
      searchBudget: this.getPathSearchBudget(),
      searchBudgetMultiplier: PATH_SEARCH_BUDGET_MULTIPLIER,
      pathStatus: this.pathStatus,
      interactionStatus: this.interactionStatus,
      jobLabel: this.playerCharacter.getJob().label,
      health: this.playerCharacter.getHealth(),
      maxHealth: this.playerCharacter.getMaxHealth(),
      mana: this.playerCharacter.getMana(),
      maxMana: this.playerCharacter.getMaxMana(),
      healthRegen: this.playerCharacter.getHealthRegen(),
      manaRegen: this.playerCharacter.getManaRegen(),
      meleeAttack: this.playerCharacter.getMeleeAttack(),
      rangedAttack: this.playerCharacter.getRangedAttack(),
      meleeMagicAttack: this.playerCharacter.getMeleeMagicAttack(),
      rangedMagicAttack: this.playerCharacter.getRangedMagicAttack(),
      defense: this.playerCharacter.getDefense(),
      moveSpeed: this.playerCharacter.getMoveSpeed(),
      attackSpeed: this.playerCharacter.getAttackSpeed(),
      magicAttackSpeed: this.playerCharacter.getMagicAttackSpeed(),
      fullDefenseChance: this.playerCharacter.getFullDefenseChance(),
      cooldownSummary,
      dead: this.isDead(),
      gold: this.gold,
      potionCount: this.getItemCount('potion_minor'),
      keyCount: this.getItemCount('utility_key'),
      inventorySummary,
      journeyChapter: this.journeyLog.currentChapter,
      achievementsText: this.achievements.unlocked.length > 0 ? this.achievements.unlocked.join(', ') : 'none',
    }))
    this.effectHud.render(width, height, {
      x: this.input.activePointer.x,
      y: this.input.activePointer.y,
    }, {
      nowMs: this.getEffectRuntimeNowMs(),
      activeItemBuffs: this.effectRuntimeSceneState.activeItemBuffs,
      activeDebuffs: this.effectRuntimeSceneState.activeDebuffs,
      poisoned: this.playerCharacter.isPoisoned(),
      guardBuffRemainingMs: this.playerCharacter.getGuardBuffRemainingMs(this.getEffectRuntimeNowMs()),
      dead: this.isDead(),
    })
  }

  private drawPath(
    playerWorld: IsoPoint,
    playerScreen: IsoPoint,
    width: number,
    height: number
  ) {
    const points = this.playerController.getPathPoints()
    this.pathGraphics.clear()

    if (points.length === 0) {
      return
    }

    const projected = [playerWorld, ...points].map(point => {
      const screen = worldToScreen(point)
      return new Phaser.Math.Vector2(
        screen.x - playerScreen.x + width / 2,
        screen.y - playerScreen.y + height / 2
      )
    })

    this.pathGraphics.lineStyle(2, 0xfbbf24, 0.9)
    this.pathGraphics.beginPath()
    this.pathGraphics.moveTo(projected[0].x, projected[0].y)

    for (let index = 1; index < projected.length; index++) {
      this.pathGraphics.lineTo(projected[index].x, projected[index].y)
    }

    this.pathGraphics.strokePath()

    for (let index = 1; index < projected.length; index++) {
      const point = projected[index]
      this.pathGraphics.fillStyle(index === projected.length - 1 ? 0xf97316 : 0xf8fafc, 0.95)
      this.pathGraphics.fillCircle(point.x, point.y, index === projected.length - 1 ? 5 : 4)
      this.pathGraphics.lineStyle(1, 0x111827, 0.8)
      this.pathGraphics.strokeCircle(point.x, point.y, index === projected.length - 1 ? 5 : 4)
    }
  }

  private readInputVector(): Phaser.Math.Vector2 {
    let screenX = 0
    let screenY = 0

    if (this.wasd.left.isDown || this.cursors.left.isDown) screenX -= 1
    if (this.wasd.right.isDown || this.cursors.right.isDown) screenX += 1
    if (this.wasd.up.isDown || this.cursors.up.isDown) screenY -= 1
    if (this.wasd.down.isDown || this.cursors.down.isDown) screenY += 1

    this.inputVector.set(screenX + screenY, screenY - screenX)

    if (this.inputVector.lengthSq() > 0) {
      this.inputVector.normalize()
    }

    return this.inputVector.clone()
  }

  private canOccupy(x: number, y: number): boolean {
    const radius = this.playerController.getBodyRadius()
    return canOccupy(this.dungeon, x, y, radius) &&
      !this.isBlockedByMonsterActors(x, y, radius)
  }

  private canOccupyCell(x: number, y: number): boolean {
    const radius = this.playerController.getBodyRadius()
    return canOccupyCell(this.dungeon, x, y, radius) &&
      !this.isBlockedByMonsterActors(cellCenter(x, y).x, cellCenter(x, y).y, radius)
  }

  private applyPathToTile(targetCell: { x: number; y: number }, successStatus: string): boolean {
    const result = this.findPathToTile(targetCell)
    if (!result.path) {
      this.playerController.clearDestination()
      this.pathStatus = result.exhaustedSearchBudget
        ? `path failed: search budget exceeded (${result.visitedNodes})`
        : 'path failed: no route'
      return false
    }

    if (result.path.length <= 1) {
      this.playerController.clearDestination()
      this.pathStatus = 'already at target'
      return false
    }

    this.playerController.setPath(result.path.slice(1).map(node => cellCenter(node.x, node.y)))
    this.pathStatus = `${successStatus} (${result.path.length - 1} nodes / budget ${this.getPathSearchBudget()})`
    return true
  }

  private repathToActiveGoal(): boolean {
    const goal = this.playerController.getFinalDestination()
    if (!goal) {
      return false
    }

    const goalTile = {
      x: Phaser.Math.Clamp(Math.floor(goal.x), 0, this.dungeon.width - 1),
      y: Phaser.Math.Clamp(Math.floor(goal.y), 0, this.dungeon.height - 1),
    }

    const repathed = this.applyPathToTile(goalTile, 'repath ready')
    if (repathed) {
      this.pathStatus = `${this.pathStatus} after blockage`
    }

    return repathed
  }

  private findPathToTile(targetCell: { x: number; y: number }) {
    return findPathToTile({
      dungeon: this.dungeon,
      current: this.playerController.getMapPosition(),
      targetCell,
      playerRadius: this.playerController.getBodyRadius(),
      maxVisitedNodes: this.getPathSearchBudget(),
      isCellBlocked: (x, y) =>
        this.isBlockedByMonsterActors(cellCenter(x, y).x, cellCenter(x, y).y, this.playerController.getBodyRadius()),
    })
  }

  private canMonsterOccupy(monsterId: string, x: number, y: number): boolean {
    return canOccupy(this.dungeon, x, y, MONSTER_BODY_RADIUS) &&
      !this.isBlockedByPlayerActor(x, y, MONSTER_BODY_RADIUS) &&
      !this.isBlockedByOtherMonsters(monsterId, x, y, MONSTER_BODY_RADIUS)
  }

  private isBlockedByPlayerActor(x: number, y: number, radius: number): boolean {
    const playerPosition = this.playerController.getMapPosition()
    return Phaser.Math.Distance.Between(x, y, playerPosition.x, playerPosition.y) <
      radius + this.playerController.getBodyRadius()
  }

  private isBlockedByMonsterActors(x: number, y: number, radius: number): boolean {
    return this.monsters.some(monster => {
      const position = monster.controller.getMapPosition()
      return Phaser.Math.Distance.Between(x, y, position.x, position.y) <
        radius + monster.controller.getBodyRadius()
    })
  }

  private isBlockedByOtherMonsters(monsterId: string, x: number, y: number, radius: number): boolean {
    return this.monsters.some(monster => {
      if (monster.id === monsterId) {
        return false
      }

      const position = monster.controller.getMapPosition()
      return Phaser.Math.Distance.Between(x, y, position.x, position.y) <
        radius + monster.controller.getBodyRadius()
    })
  }

  private getPathSearchBudget(): number {
    return getPathSearchBudget(
      this.visibleTiles.size,
      PATH_SEARCH_BUDGET_MULTIPLIER,
      MIN_PATH_SEARCH_BUDGET
    )
  }

  private refreshVisibility(): void {
    this.visibleTiles = computeVisibleTiles(
      this.dungeon,
      this.playerController.getMapPosition(),
      this.playerCharacter.getVisionRadius()
    )
  }

  private getTileTexture(tile: TileType, gx: number, gy: number): string {
    if (tile === TileType.CORRIDOR) {
      return 'tile-corridor'
    }

    return (gx + gy) % 2 === 0 ? 'tile-a' : 'tile-b'
  }

  private drawInteractables(playerScreen: IsoPoint, width: number, height: number): void {
    const nearby = this.getNearbyInteractable()

    for (const interactable of this.interactables) {
      const screen = worldToScreen(cellCenter(interactable.tileX, interactable.tileY))
      const sx = screen.x - playerScreen.x + width / 2
      const sy = screen.y - playerScreen.y + height / 2 - 18

      interactable.image.setVisible(true)
      interactable.image.setPosition(sx, sy)
      interactable.image.setDepth(500 + interactable.tileX + interactable.tileY)
      interactable.image.setAlpha(interactable.used ? 0.45 : 1)
      interactable.image.setScale(nearby?.id === interactable.id ? 1.08 : 1)
    }
  }

  private drawTraps(playerScreen: IsoPoint, width: number, height: number): void {
    for (const trap of this.traps) {
      const screen = worldToScreen(cellCenter(trap.tileX, trap.tileY))
      const sx = screen.x - playerScreen.x + width / 2
      const sy = screen.y - playerScreen.y + height / 2 - 6
      const cooldownProgress = Phaser.Math.Clamp(
        (this.time.now - trap.lastTriggeredAt) / TRAP_REARM_MS,
        0.25,
        1
      )

      trap.image.setVisible(true)
      trap.image.setPosition(sx, sy)
      trap.image.setDepth(210 + trap.tileX + trap.tileY)
      trap.image.setAlpha(cooldownProgress)
      trap.image.setScale(0.8 + cooldownProgress * 0.25)
    }
  }

  private generateFloor(resetFloorIndex: boolean): void {
    const floor = generateFloorState({
      scene: this,
      previousInteractables: this.interactables,
      previousTraps: this.traps,
      trapRearmMs: TRAP_REARM_MS,
      width: 80,
      height: 80,
    })

    this.dungeon = floor.dungeon
    this.spawnTile = floor.spawnTile
    this.interactables = floor.interactables
    this.traps = floor.traps
    destroyDeployableActors(this.deployables)
    this.deployables = []
    destroySummonActors(this.summons)
    this.summons = []
    destroyProjectileActors(this.projectiles)
    this.projectiles = []
    destroyMonsterActors(this.monsters)
    this.monsters = createMonsterActors(this, floor.monsterSpawns)
    this.playerController.clearDestination()
    this.playerController.setMapPosition(floor.spawnPosition.x, floor.spawnPosition.y)
    this.refreshVisibility()

    if (resetFloorIndex) {
      if (this.floorIndex <= 1) {
        this.floorIndex = 1
        markEnteredDungeon(this.journeyLog, this.achievements)
      }

      this.saveProgress()
      this.interactionStatus = `entered floor ${this.floorIndex}`
      return
    }

    this.floorIndex += 1
    this.applyUnlockedAchievements(markReachedFloor(this.journeyLog, this.achievements, this.floorIndex))
    this.saveProgress()
    this.interactionStatus = `entered floor ${this.floorIndex}`
  }

  private tryInteract(): void {
    if (this.isDead()) {
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.interactionStatus = 'cannot interact while dead'
      }
      return
    }

    if (this.activeDialogue) {
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.advanceDialogue()
      }
      return
    }

    if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.interactionStatus = getNearbyInteractionStatus(this.getNearbyInteractable())
      return
    }

    const result = resolveSceneInteraction({
      interactable: this.getNearbyInteractable(),
      inventories: [this.playerCharacter.getBeltInventory(), this.playerCharacter.getInventory()],
      journeyLog: this.journeyLog,
      achievements: this.achievements,
      consumeKey: () => {
        const removedFromBelt = removeSingleItemByDefinition(this.playerCharacter.getBeltInventory(), 'utility_key')
        if (!removedFromBelt) {
          removeSingleItemByDefinition(this.playerCharacter.getInventory(), 'utility_key')
        }
      },
    })

    if (result.kind === 'blocked') {
      this.interactionStatus = result.status
      return
    }

    if (result.kind === 'open-chest') {
      this.gold += result.goldDelta
      this.applyUnlockedAchievements(result.unlocked)
      this.interactionStatus = result.status
      this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
      this.syncEffectRuntimeState()
      this.saveProgress()
      return
    }

    if (result.kind === 'start-dialogue') {
      this.playerController.clearDestination()
      this.activeDialogue = result.dialogue
      this.applyUnlockedAchievements(result.unlocked)
      this.saveProgress()
      this.interactionStatus = result.status
      return
    }

    this.generateFloor(false)
  }

  private tryUsePotion(): void {
    if (this.activeDialogue || this.isDead() || !Phaser.Input.Keyboard.JustDown(this.usePotionKey)) {
      return
    }

    this.useInventoryItem('potion_minor')
  }

  private tryFireProjectile(): void {
    if (this.activeDialogue || this.isDead() || !Phaser.Input.Keyboard.JustDown(this.fireProjectileKey)) {
      return
    }

    const attackBundle = this.getCombinedEquippedAttackBundle()
    if (!attackBundle) {
      this.interactionStatus = 'no weapon equipped'
      return
    }

    const result = executeRuntimeActionBundle({
      context: this.buildFacingActionContext(),
      actionBundle: attackBundle,
      collections: this.getActionExecutionCollections(),
      successStatus: 'fired combined attack',
      summonAttackIntervalMs: SUMMON_ATTACK_INTERVAL_MS,
      summonTargetingRange: SUMMON_TARGETING_RANGE,
    })
    this.applyActionExecutionCollections(result)
    this.interactionStatus = result.status
  }
  private updateProjectiles(deltaMs: number): void {
    if (this.projectiles.length === 0) {
      return
    }

    const result = updateProjectileActors({
      projectiles: this.projectiles,
      deltaMs,
      targets: this.buildProjectileTargets(),
      canTraverse: (x, y, radius) => canOccupy(this.dungeon, x, y, radius),
    })
    this.projectiles = result.survivors

    if (result.impacts.length > 0 || result.expirations.length > 0) {
      this.applyProjectileLifecycle(result.impacts, result.expirations)
    }
  }

  private tryDeployAction(): void {
    if (this.activeDialogue || this.isDead() || !Phaser.Input.Keyboard.JustDown(this.deployActionKey)) {
      return
    }

    const deployAction = buildDeployActionSpec(DEPLOY_ACTION_IDS.debugTotem)
    const result = deployFacingAction({
      context: this.buildFacingActionContext(),
      deployAction,
      deployables: this.deployables,
    })
    this.deployables = result.deployables
    this.interactionStatus = result.deployed
      ? `deployed ${deployAction.deployableId}`
      : 'deploy failed: blocked cell'
  }

  private faceTowardCell(targetCell: { x: number; y: number }): void {
    const origin = this.playerController.getMapPosition()
    const target = cellCenter(targetCell.x, targetCell.y)
    const facing = new Phaser.Math.Vector2(target.x - origin.x, target.y - origin.y)
    if (facing.lengthSq() === 0) {
      return
    }

    this.playerController.setFacing(facing.x, facing.y)
    this.playerController.clearDestination()
  }

  private getCombinedEquippedAttackBundle(): ActionBundle | null {
    return buildEquippedActionBundle(
      this.playerCharacter.getInventory(),
      this.playerCharacter.getEquipmentLoadout()
    )
  }

  private buildFacingActionContext() {
    return {
      scene: this as Phaser.Scene,
      dungeon: this.dungeon,
      nowMs: this.time.now,
      ownerId: this.playerCharacter.id,
      origin: this.playerController.getMapPosition(),
      facing: this.playerController.getFacing(),
    }
  }

  private getActionExecutionCollections() {
    return {
      deployables: this.deployables,
      summons: this.summons,
      projectiles: this.projectiles,
    }
  }

  private applyActionExecutionCollections(collections: {
    deployables: DeployableActor[]
    summons: SummonActor[]
    projectiles: ProjectileActor[]
  }): void {
    this.deployables = collections.deployables
    this.summons = collections.summons
    this.projectiles = collections.projectiles
  }

  private findNearestMonster(x: number, y: number, range: number): MonsterActor | null {
    let nearest: MonsterActor | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const monster of this.monsters) {
      const position = monster.controller.getMapPosition()
      const distance = Phaser.Math.Distance.Between(x, y, position.x, position.y)
      if (distance > range || distance >= nearestDistance) {
        continue
      }

      nearest = monster
      nearestDistance = distance
    }

    return nearest
  }

  private launchProjectileFromPosition(
    attackerId: string,
    origin: Phaser.Math.Vector2,
    target: Phaser.Math.Vector2,
    attackSpec: ProjectileActionSpec,
    successStatus: string
  ): void {
    const result = launchRuntimeProjectileFromPosition({
      scene: this,
      nowMs: this.time.now,
      attackerId,
      origin,
      target,
      attackSpec,
      projectiles: this.projectiles,
      successStatus,
    })
    this.projectiles = result.projectiles
    if (result.launched) {
      this.interactionStatus = result.status
    }
  }

  private tryTriggerTrap(): void {
    const current = this.playerController.getMapPosition()
    const tileX = Phaser.Math.Clamp(Math.floor(current.x), 0, this.dungeon.width - 1)
    const tileY = Phaser.Math.Clamp(Math.floor(current.y), 0, this.dungeon.height - 1)
    const result = resolveTrapSurvival({
      trap: this.traps.find(candidate => candidate.tileX === tileX && candidate.tileY === tileY),
      nowMs: this.time.now,
      trapRearmMs: TRAP_REARM_MS,
      trapDamageAmount: TRAP_DAMAGE_AMOUNT,
      poisonDamagePerSecond: POISON_DOT_DAMAGE_PER_SECOND,
      health: this.playerCharacter.getHealth(),
      poisoned: this.playerCharacter.isPoisoned(),
      guardActive: this.playerCharacter.isGuardActive(this.getEffectRuntimeNowMs()),
      effectRuntimeSceneState: this.effectRuntimeSceneState,
    })
    if (!result.triggered) {
      return
    }

    this.playerCharacter.setHealth(result.health)
    this.playerCharacter.setPoisoned(result.poisoned)
    this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
    this.interactionStatus = result.status
    this.syncEffectRuntimeState()
    this.saveProgress()
  }

  private tryApplyDebugDamage(): void {
    if (this.activeDialogue || !Phaser.Input.Keyboard.JustDown(this.debugDamageKey)) {
      return
    }

    const result = resolveDebugDamageSurvival(this.playerCharacter.getHealth(), DEBUG_DAMAGE_AMOUNT)
    this.playerCharacter.setHealth(result.health)
    this.interactionStatus = result.status
    this.syncEffectRuntimeState()
    this.saveProgress()
  }

  private tryRespawn(): void {
    if (!this.isDead() || !Phaser.Input.Keyboard.JustDown(this.respawnKey)) {
      return
    }

    const result = resolveRespawnSurvival({
      spawnTile: this.spawnTile,
      maxHealth: this.playerCharacter.getMaxHealth(),
      respawnHealthRatio: RESPAWN_HEALTH_RATIO,
      floorIndex: this.floorIndex,
      effectRuntimeSceneState: this.effectRuntimeSceneState,
    })
    this.playerController.clearDestination()
    this.playerController.setMapPosition(result.spawn.x, result.spawn.y)
    this.playerController.commitMapPosition(result.spawn.x, result.spawn.y)
    this.playerCharacter.setHealth(result.health)
    this.playerCharacter.setPoisoned(result.poisoned)
    this.playerCharacter.setGuardBuffRemainingMs(result.guardBuffRemainingMs, this.getEffectRuntimeNowMs())
    this.interactionStatus = result.status
    this.syncEffectRuntimeState()
    this.saveProgress()
  }

  private tryToggleInventory(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
      return
    }

    this.inventoryPanel.toggle()
  }

  private tryAddInventoryTestItems(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.inventoryTestItemsKey)) {
      return
    }

    const result = addInventoryItems(this.playerCharacter.getInventory(), TEST_SHAPE_ITEM_DEFINITION_IDS)
    const beltResult = addInventoryItems(this.playerCharacter.getBeltInventory(), TEST_BELT_ITEM_DEFINITION_IDS)
    this.interactionStatus =
      `added shape items ${result.addedCount}, belt usable items ${beltResult.addedCount}` +
      ((result.failedItemDefinitionIds.length + beltResult.failedItemDefinitionIds.length) > 0
        ? `, failed ${result.failedItemDefinitionIds.length + beltResult.failedItemDefinitionIds.length}`
        : '')
    if (result.addedCount > 0 || beltResult.addedCount > 0) {
      this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
      this.syncEffectRuntimeState()
      this.saveProgress()
    }
  }

  private applyEquipmentPanelSelection(target: EquipmentSlotTarget): void {
    const selectedItemInstanceId = this.getSelectedInventoryItemInstanceId()
    const nextLoadout = selectedItemInstanceId
      ? (() => {
          return assignItemToEquipmentTarget({
            inventory: this.playerCharacter.getInventory(),
            loadout: this.playerCharacter.getEquipmentLoadout(),
            itemInstanceId: selectedItemInstanceId,
            target,
          })
        })()
      : clearEquipmentTarget(this.playerCharacter.getEquipmentLoadout(), target)

    if (!nextLoadout) {
      this.interactionStatus = 'cannot equip item there'
      return
    }

    this.playerCharacter.setEquipmentLoadout(nextLoadout)
    this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
    this.syncEffectRuntimeState()
    this.saveProgress()
    this.interactionStatus = selectedItemInstanceId ? 'equipment updated' : 'equipment cleared'
  }

  private tryDropDraggedEquipmentIntoInventory(
    target: EquipmentSlotTarget,
    screenX: number,
    screenY: number
  ): boolean {
    const inventory = this.playerCharacter.getInventory()
    const beltInventory = this.playerCharacter.getBeltInventory()
    const instanceId = getEquipmentTargetInstanceId(this.playerCharacter.getEquipmentLoadout(), target)
    if (!instanceId) {
      return false
    }

    const stackId = getStackIdByItemInstanceId(inventory, instanceId)
    if (!stackId) {
      return false
    }

    const dropCell = this.inventoryPanel.getDropCellAt(
      screenX,
      screenY,
      this.scale.width,
      inventory,
      beltInventory
    )
    if (dropCell?.inventoryKind === 'inventory') {
      const moved = moveInventoryStack(inventory, stackId, dropCell.x, dropCell.y)
      if (!moved) {
        this.interactionStatus = 'cannot place equipped item there'
        return true
      }
    } else {
      const equipmentDrop = this.equipmentPanel.handlePointerUp(screenX, screenY)
      if (!equipmentDrop.target) {
        return false
      }
    }

    this.playerCharacter.setEquipmentLoadout(clearEquipmentTarget(this.playerCharacter.getEquipmentLoadout(), target))
    this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
    this.syncEffectRuntimeState()
    this.saveProgress()
    this.interactionStatus = 'equipment removed'
    return true
  }

  private isEquipmentTargetFilled(target: EquipmentSlotTarget): boolean {
    return Boolean(getEquipmentTargetInstanceId(this.playerCharacter.getEquipmentLoadout(), target))
  }

  private getSelectedInventoryItemInstanceId(): string | null {
    const selectedStackId = this.inventoryPanel.getSelectedStackId()
    if (!selectedStackId) {
      return null
    }

    return getStackPrimaryItemInstanceId(this.playerCharacter.getInventory(), selectedStackId) ??
      getStackPrimaryItemInstanceId(this.playerCharacter.getBeltInventory(), selectedStackId)
  }

  private getSelectedInventoryItemDefinitionId(): string | null {
    const instanceId = this.getSelectedInventoryItemInstanceId()
    if (!instanceId) {
      return null
    }

    return this.playerCharacter.getInventory().itemInstances.find(item => item.instanceId === instanceId)?.itemDefinitionId ??
      this.playerCharacter.getBeltInventory().itemInstances.find(item => item.instanceId === instanceId)?.itemDefinitionId ??
      null
  }

  private buildProjectileTargets(): ProjectileTarget[] {
    return [
      {
        id: this.playerCharacter.id,
        character: this.playerCharacter,
        controller: this.playerController,
      },
      ...this.monsters.map(monster => ({
        id: monster.id,
        character: monster.character,
        controller: monster.controller,
      })),
    ]
  }

  private applyProjectileLifecycle(
    impacts: ProjectileImpact[],
    expirations: ProjectileExpiration[]
  ): void {
    let removedMonster = false
    let shouldSyncPlayerRuntime = false

    for (const impact of impacts) {
      for (const event of impact.events) {
        const result = this.applyProjectileLifecycleEvent({
          attackerId: impact.attackerId,
          primaryTargetId: impact.targetId,
          origin: impact.position,
          direction: impact.direction,
          hitDistance: impact.hit.distanceFromCenter,
          event,
        })
        removedMonster = removedMonster || result.removedMonster
        shouldSyncPlayerRuntime = shouldSyncPlayerRuntime || result.shouldSyncPlayerRuntime
      }
    }

    for (const expiration of expirations) {
      for (const event of expiration.events) {
        const result = this.applyProjectileLifecycleEvent({
          attackerId: expiration.attackerId,
          primaryTargetId: null,
          origin: expiration.position,
          direction: expiration.direction,
          event,
        })
        removedMonster = removedMonster || result.removedMonster
        shouldSyncPlayerRuntime = shouldSyncPlayerRuntime || result.shouldSyncPlayerRuntime
      }
    }

    if (removedMonster) {
      this.monsters = this.monsters.filter(monster => !monster.character.isDead())
    }

    if (shouldSyncPlayerRuntime) {
      this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
      this.syncEffectRuntimeState()
    }
  }

  private applyProjectileLifecycleEvent(params: {
    attackerId: string | null
    primaryTargetId: string | null
    origin: Phaser.Math.Vector2
    direction: Phaser.Math.Vector2
    event: ProjectileLifecycleEvent
    hitDistance?: number
  }): { removedMonster: boolean; shouldSyncPlayerRuntime: boolean } {
    if (params.event.type === 'direct_damage') {
      return this.applyProjectileDamageToTarget(
        params.primaryTargetId,
        params.event.amount,
        params.hitDistance
      )
    }

    if (params.event.type === 'apply_debuff') {
      return this.applyProjectileDebuffToTarget(params.primaryTargetId, params.event.debuff)
    }

    if (params.event.type === 'area_damage') {
      return this.applyProjectileAreaDamage({
        attackerId: params.attackerId,
        primaryTargetId: params.primaryTargetId,
        origin: params.origin,
        event: params.event,
      })
    }

    if (params.event.type === 'spawn_projectile') {
      this.spawnProjectileLifecycleEventProjectiles({
        origin: params.origin,
        direction: params.direction,
        attackerId: params.attackerId ?? this.playerCharacter.id,
        event: params.event,
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
    hitDistance?: number
  ): { removedMonster: boolean; shouldSyncPlayerRuntime: boolean } {
    if (!targetId) {
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    if (targetId === this.playerCharacter.id) {
      this.playerCharacter.setHealth(this.playerCharacter.getHealth() - amount)
      this.interactionStatus = `player hit for ${amount}${typeof hitDistance === 'number' ? ` at ${hitDistance.toFixed(2)}` : ''}`
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    const monster = this.monsters.find(candidate => candidate.id === targetId)
    if (!monster) {
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    monster.character.setHealth(monster.character.getHealth() - amount)
    this.interactionStatus =
      `${monster.character.displayName} hit for ${amount}${typeof hitDistance === 'number' ? ` at ${hitDistance.toFixed(2)}` : ''}`
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
    debuff: Extract<ProjectileLifecycleEvent, { type: 'apply_debuff' }>['debuff']
  ): { removedMonster: boolean; shouldSyncPlayerRuntime: boolean } {
    if (!targetId) {
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    if (targetId === this.playerCharacter.id) {
      this.effectRuntimeSceneState.activeDebuffs = upsertEffectDebuff({
        debuffs: this.effectRuntimeSceneState.activeDebuffs,
        id: debuff.id,
        displayName: debuff.displayName,
        durationMs: debuff.durationMs,
        nowMs: this.getEffectRuntimeNowMs(),
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

    const monster = this.monsters.find(candidate => candidate.id === targetId)
    if (!monster) {
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    applyDebuffToCharacter({
      character: monster.character,
      nowMs: this.getEffectRuntimeNowMs(),
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
  }): { removedMonster: boolean; shouldSyncPlayerRuntime: boolean } {
    if (!params.attackerId) {
      return {
        removedMonster: false,
        shouldSyncPlayerRuntime: false,
      }
    }

    const targets = this.buildProjectileTargets()
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
      const result = this.applyProjectileDamageToTarget(hit.targetId, hit.damage, hit.distanceFromCenter)
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
      this.launchProjectileFromPosition(
        params.attackerId,
        params.origin,
        target,
        params.event.projectile,
        'spawned projectile'
      )
    }
  }

  private getNearbyInteractable(): Interactable | null {
    return findNearbyInteractable(this.interactables, this.playerController.getMapPosition(), INTERACTION_RANGE)
  }
  private advanceDialogue(): void {
    if (!this.activeDialogue) {
      return
    }

    const result = advanceDialogue(this.activeDialogue)
    this.activeDialogue = result.dialogue
    if (result.status) {
      this.interactionStatus = result.status
    }
  }

  private loadProgress(): void {
    const snapshot = this.progressStore.load()
    if (!snapshot) {
      return
    }

    this.applyProgressSnapshot(snapshot)
  }

  private saveProgress(): void {
    this.progressStore.save(this.createProgressSnapshot())
  }

  private createProgressSnapshot(): ProgressSnapshot {
    return createGameSceneProgressSnapshot({
      floorIndex: this.floorIndex,
      gold: this.gold,
      jobId: this.playerCharacter.getJobId(),
      health: this.playerCharacter.getHealth(),
      maxHealth: this.playerCharacter.getMaxHealth(),
      mana: this.playerCharacter.getMana(),
      maxMana: this.playerCharacter.getMaxMana(),
      poisoned: this.playerCharacter.isPoisoned(),
      guardBuffRemainingMs: this.playerCharacter.getGuardBuffRemainingMs(this.getEffectRuntimeNowMs()),
      effectRuntimeSceneState: this.effectRuntimeSceneState,
      inventory: this.playerCharacter.getInventory(),
      beltInventory: this.playerCharacter.getBeltInventory(),
      journeyLog: this.journeyLog,
      achievements: this.achievements,
      serialize: {
        activeItemBuffs: serializeActiveItemBuffs,
        itemCooldowns: serializeItemCooldowns,
        activeDebuffs: serializeEffectDebuffs,
      },
    })
  }

  private applyProgressSnapshot(snapshot: ProgressSnapshot): void {
    const loaded = applyGameSceneProgressSnapshot({
      snapshot,
      defaultHealth: this.playerCharacter.getMaxHealth(),
      defaultMana: this.playerCharacter.getMaxMana(),
      inventoryCols: INVENTORY_COLS,
      inventoryRows: INVENTORY_ROWS,
      beltCols: BELT_COLS,
      beltRows: BELT_ROWS,
      nowMs: this.time.now,
      restore: {
        activeItemBuffs: restoreActiveItemBuffs,
        itemCooldowns: restoreItemCooldowns,
        activeDebuffs: restoreEffectDebuffs,
      },
    })

    this.floorIndex = loaded.floorIndex
    this.gold = loaded.gold
    restoreEffectRuntimeCollections({
      sceneState: this.effectRuntimeSceneState,
      nowMs: this.time.now,
      restoreActiveItemBuffs: () => loaded.effectRuntime.activeItemBuffs,
      restoreItemCooldowns: () => loaded.effectRuntime.itemCooldowns,
      restoreActiveDebuffs: () => loaded.effectRuntime.activeDebuffs,
    })
    this.playerCharacter.applyRuntimeSnapshot({
      jobId: loaded.jobId,
      health: loaded.health,
      mana: loaded.mana,
      poisoned: loaded.poisoned,
      guardBuffRemainingMs: loaded.guardBuffRemainingMs,
    }, this.time.now)
    this.playerCharacter.setInventoryStates(loaded.inventory, loaded.beltInventory)
    this.journeyLog = loaded.journeyLog
    this.achievements = loaded.achievements
    this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
    this.syncEffectRuntimeState()
  }

  private getItemCount(itemDefinitionId: string): number {
    return getItemCountAcrossInventories(
      [this.playerCharacter.getBeltInventory(), this.playerCharacter.getInventory()],
      itemDefinitionId
    )
  }

  private getInventorySummaryText(): string {
    return [
      `belt: ${summarizeInventory(this.playerCharacter.getBeltInventory())}`,
      `bag: ${summarizeInventory(this.playerCharacter.getInventory())}`,
    ].join(' | ')
  }

  private isDead(): boolean {
    return isDead(this.playerCharacter.getHealth())
  }

  private applyUnlockedAchievements(labels: string[]): void {
    if (labels.length === 0 || this.interactionStatus !== 'none') {
      return
    }

    this.interactionStatus = `achievement unlocked: ${labels.join(', ')}`
  }

  private useInventoryItem(itemDefinitionId: string): void {
    const effectNowMs = this.getEffectRuntimeNowMs()
    const result = runInventoryItemUseFlow({
      beltInventory: this.playerCharacter.getBeltInventory(),
      inventory: this.playerCharacter.getInventory(),
      itemDefinitionId,
      health: this.playerCharacter.getHealth(),
      maxHealth: this.playerCharacter.getMaxHealth(),
      mana: this.playerCharacter.getMana(),
      maxMana: this.playerCharacter.getMaxMana(),
      poisoned: this.playerCharacter.isPoisoned(),
      effectNowMs,
      effectRuntimeSceneState: this.effectRuntimeSceneState,
    })

    this.playerCharacter.setHealth(result.health)
    this.playerCharacter.setMana(result.mana)
    this.playerCharacter.setPoisoned(result.poisoned)
    this.playerCharacter.extendGuardBuff(result.guardDurationMs, effectNowMs)
    this.refreshCharacterStatSources(effectNowMs)
    this.interactionStatus = result.status
    if (!result.used) {
      return
    }

    this.syncEffectRuntimeState()
    this.saveProgress()
  }

  private refreshCharacterStatSources(nowMs: number): void {
    const currentLoadout = reconcileCharacterEquipmentLoadout(
      this.playerCharacter.getInventory(),
      this.playerCharacter.getEquipmentLoadout()
    )
    this.playerCharacter.setEquipmentLoadout(
      isCharacterEquipmentLoadoutEmpty(currentLoadout)
        ? buildAutomaticEquipmentLoadout(this.playerCharacter.getInventory())
        : currentLoadout
    )
    this.playerCharacter.setEquipmentBonuses(
      getEquipmentStatBonuses(this.playerCharacter.getInventory(), this.playerCharacter.getEquipmentLoadout())
    )
    this.playerCharacter.setPotionBonuses(
      getActiveItemBuffStatBonuses(this.effectRuntimeSceneState.activeItemBuffs, nowMs)
    )
    this.playerCharacter.setTemporaryBonuses(getActiveDebuffStatModifiers(this.effectRuntimeSceneState))
    this.playerCharacter.setActiveItemBuffs(this.effectRuntimeSceneState.activeItemBuffs)
    this.playerCharacter.setActiveDebuffs(this.effectRuntimeSceneState.activeDebuffs)
    this.playerController.syncMoveSpeedFromCharacter()
  }

  private getEffectRuntimeNowMs(): number {
    return this.effectRuntimeSceneState.nowMs
  }

  private initializeEffectRuntimeWorker(): void {
    this.effectRuntimeClient?.destroy()
    this.latestEffectRuntimeRevision = 0
    this.effectRuntimeClient = new EffectRuntimeClient({
      tickMs: EFFECT_TICK_MS,
      initialState: buildEffectRuntimeState({
        sceneState: this.effectRuntimeSceneState,
        health: this.playerCharacter.getHealth(),
        maxHealth: this.playerCharacter.getMaxHealth(),
        healthRegen: this.playerCharacter.getHealthRegen(),
        mana: this.playerCharacter.getMana(),
        maxMana: this.playerCharacter.getMaxMana(),
        manaRegen: this.playerCharacter.getManaRegen(),
        poisoned: this.playerCharacter.isPoisoned(),
        guardBuffRemainingMs: this.playerCharacter.getGuardBuffRemainingMs(this.getEffectRuntimeNowMs()),
      }),
      onState: (revision, state) => {
        this.handleEffectRuntimeState(revision, state)
      },
    })
    this.latestEffectRuntimeSyncRevision = this.effectRuntimeClient.getLatestRevision()
  }

  private syncEffectRuntimeState(): void {
    const revision = this.effectRuntimeClient?.syncState(
      buildEffectRuntimeState({
        sceneState: this.effectRuntimeSceneState,
        health: this.playerCharacter.getHealth(),
        maxHealth: this.playerCharacter.getMaxHealth(),
        healthRegen: this.playerCharacter.getHealthRegen(),
        mana: this.playerCharacter.getMana(),
        maxMana: this.playerCharacter.getMaxMana(),
        manaRegen: this.playerCharacter.getManaRegen(),
        poisoned: this.playerCharacter.isPoisoned(),
        guardBuffRemainingMs: this.playerCharacter.getGuardBuffRemainingMs(this.getEffectRuntimeNowMs()),
      })
    )
    if (revision) {
      this.latestEffectRuntimeSyncRevision = revision
    }
  }

  private handleEffectRuntimeState(revision: number, state: EffectRuntimeState): void {
    if (
      revision < this.latestEffectRuntimeRevision ||
      revision < this.latestEffectRuntimeSyncRevision
    ) {
      return
    }

    this.latestEffectRuntimeRevision = revision
    applyEffectRuntimeWorkerState(this.effectRuntimeSceneState, state)
    this.refreshCharacterStatSources(state.currentTimeMs)
    this.playerCharacter.setHealth(state.health)
    this.playerCharacter.setMana(state.mana)
    this.playerCharacter.setPoisoned(state.poisoned)
    this.playerCharacter.setGuardBuffRemainingMs(state.guardBuffRemainingMs, state.currentTimeMs)

    const reconciledState = buildEffectRuntimeState({
      sceneState: this.effectRuntimeSceneState,
      health: this.playerCharacter.getHealth(),
      maxHealth: this.playerCharacter.getMaxHealth(),
      healthRegen: this.playerCharacter.getHealthRegen(),
      mana: this.playerCharacter.getMana(),
      maxMana: this.playerCharacter.getMaxMana(),
      manaRegen: this.playerCharacter.getManaRegen(),
      poisoned: this.playerCharacter.isPoisoned(),
      guardBuffRemainingMs: this.playerCharacter.getGuardBuffRemainingMs(state.currentTimeMs),
    })
    if (!areEffectRuntimeStatesEqual(state, reconciledState)) {
      const nextRevision = this.effectRuntimeClient?.syncState(reconciledState)
      if (nextRevision) {
        this.latestEffectRuntimeSyncRevision = nextRevision
      }
    }
  }
}
