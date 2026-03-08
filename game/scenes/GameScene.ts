import * as Phaser from 'phaser'
import { Player } from '../entities/Player'
import { PlayerCharacter } from '../characters/PlayerCharacter'
import {
  createEmptyInventory,
  moveInventoryStack,
  removeSingleItemByDefinition,
  transferInventoryStack,
  type InventoryState,
} from '../items/Inventory'
import {
  addInventoryItems,
  getInventorySummaryText,
  getItemCountAcrossInventories,
} from '../items/InventoryUtils'
import {
  getActiveItemBuffStatBonuses,
  getInventoryEquipmentStatBonuses,
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
import { openChest } from '../interactions/ChestInteractions'
import {
  advanceDialogue,
  getDialoguePanelState,
  startNpcDialogue,
  type ActiveDialogue,
} from '../interactions/DialogueFlow'
import {
  applyDebugDamage,
  getRespawnHealth,
  getRespawnPosition,
  triggerTrap,
} from '../interactions/SurvivalRules'
import { runInventoryItemUseFlow } from '../interactions/InventoryItemUseFlow'
import { EffectRuntimeClient } from '../interactions/EffectRuntimeClient'
import {
  applyTrapRuntimeEffects,
  clearEffectRuntimeDebuffs,
  restoreEffectRuntimeCollections,
} from '../interactions/EffectRuntimeMutations'
import { type EffectRuntimeState } from '../interactions/EffectRuntimeProtocol'
import {
  applyEffectRuntimeWorkerState,
  areEffectRuntimeStatesEqual,
  buildEffectRuntimeState,
  createEffectRuntimeProgressData,
  createInitialEffectRuntimeSceneState,
  DEFAULT_POISON_DAMAGE_PER_SECOND,
  getActiveBuffSummaryText,
  getActiveDebuffSummaryText,
  getItemCooldownSummaryText,
} from '../interactions/EffectRuntimeSceneBridge'
import {
  restoreTimedModifiers,
  serializeTimedModifiers,
} from '../interactions/TimedModifierRules'
import { BSPDungeon, TileType } from '../map/BSPDungeon'
import {
  createLocalStorageProgressStore,
  type AchievementState,
  type JourneyLog,
  type ProgressSnapshot,
  type ProgressStore,
} from '../progress/ProgressStore'
import {
  applyProgressSnapshot as applyStoredProgressSnapshot,
  createProgressSnapshot as createStoredProgressSnapshot,
} from '../progress/ProgressPersistence'
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
import { InventoryPanel } from '../ui/InventoryPanel'
import { type Interactable, type Trap } from '../world/WorldObjects'
import {
  bakeWorldTextures,
  findNearbyInteractable,
} from '../world/WorldBuilder'
import { generateFloorState } from '../world/FloorFlow'
import { TEST_BELT_ITEM_DEFINITION_IDS, TEST_SHAPE_ITEM_DEFINITION_IDS } from '../items/ItemCatalog'
import { getItemDefinition } from '../items/ItemCatalog'

const POOL_SIZE = 1000
const PLAYER_RADIUS = 0.24
const VISIBILITY_RADIUS = 12
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

export class GameScene extends Phaser.Scene {
  private player!: Player
  private readonly playerCharacter = new PlayerCharacter()
  private dungeon!: BSPDungeon
  private tilePool: Phaser.GameObjects.Image[] = []
  private pathGraphics!: Phaser.GameObjects.Graphics
  private inputVector = new Phaser.Math.Vector2()
  private visibleTiles = new Set<string>()
  private interactables: Interactable[] = []
  private traps: Trap[] = []
  private hoverMarker!: Phaser.GameObjects.Ellipse
  private hudText!: Phaser.GameObjects.Text
  private dialoguePanel!: DialoguePanel
  private inventoryPanel!: InventoryPanel
  private pathStatus = 'idle'
  private interactionStatus = 'none'
  private floorIndex = 1
  private gold = 0
  private spawnTile = { x: 0, y: 0 }
  private inventory: InventoryState = createEmptyInventory(INVENTORY_COLS, INVENTORY_ROWS)
  private beltInventory: InventoryState = createEmptyInventory(BELT_COLS, BELT_ROWS)
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

    for (let i = 0; i < POOL_SIZE; i++) {
      this.tilePool.push(this.add.image(-9999, -9999, 'tile-a').setDepth(1))
    }

    this.pathGraphics = this.add.graphics()
    this.pathGraphics.setDepth(9996)

    this.player = new Player(this)

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

    this.dialoguePanel = new DialoguePanel(this)
    this.inventoryPanel = new InventoryPanel(this)

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
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.inventoryPanel.isOpen()) {
        const inventoryClick = this.inventoryPanel.handlePointerDown(
          pointer.x,
          pointer.y,
          pointer.button,
          this.scale.width,
          this.inventory,
          this.beltInventory
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
        playerWorld: this.player.getMapPosition(),
        dungeon: this.dungeon,
      })
      if (!targetCell) {
        this.player.clearDestination()
        this.pathStatus = 'path failed: out of bounds'
        return
      }

      if (!this.canOccupyCell(targetCell.x, targetCell.y)) {
        this.player.clearDestination()
        this.pathStatus = 'path failed: blocked target'
        return
      }

      this.applyPathToTile(targetCell, 'path ready')
    })

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.inventoryPanel.isOpen()) {
        return
      }

      const inventoryClick = this.inventoryPanel.handlePointerUp(
        pointer.x,
        pointer.y,
        this.scale.width,
        this.inventory,
        this.beltInventory
      )
      if (!inventoryClick.requestedMove) {
        return
      }

      const sourceInventory = inventoryClick.requestedMove.sourceInventoryKind === 'belt'
        ? this.beltInventory
        : this.inventory
      const targetInventory = inventoryClick.requestedMove.targetInventoryKind === 'belt'
        ? this.beltInventory
        : this.inventory
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
    const input = this.activeDialogue || this.isDead() ? new Phaser.Math.Vector2() : this.readInputVector()
    const movement = this.player.step(delta, input)
    const current = this.player.getMapPosition()
    let nextX = current.x
    let nextY = current.y

    if (movement.velocity.lengthSq() > 0) {
      if (this.canOccupy(movement.nextPosition.x, current.y)) {
        nextX = movement.nextPosition.x
      }
      if (this.canOccupy(nextX, movement.nextPosition.y)) {
        nextY = movement.nextPosition.y
      }

      if (nextX === current.x && nextY === current.y && movement.mode === 'click-move') {
        const repathed = this.repathToActiveGoal()
        if (!repathed) {
          this.player.clearDestination()
          this.pathStatus = 'path failed: repath unavailable'
        }
      }
    }

    this.player.commitMapPosition(nextX, nextY)
    this.effectRuntimeClient?.advance(delta)
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
    } else if (movement.mode === 'click-move' && !this.player.hasDestination()) {
      this.pathStatus = 'arrived'
    }

    this.drawDungeon(movement.velocity.lengthSq() > 0)
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
    const playerWorld = this.player.getMapPosition()
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

    this.player.syncScreenPosition(width / 2, height / 2 - 18, isMoving || this.player.hasDestination(), this.game.loop.delta)
    this.dialoguePanel.render(width, height, getDialoguePanelState(this.activeDialogue))
    this.inventoryPanel.render(width, this.inventory, this.beltInventory, {
      x: this.input.activePointer.x,
      y: this.input.activePointer.y,
    })

    const destination = this.player.getDestination()
    const finalDestination = this.player.getFinalDestination()
    const inventorySummary = this.getInventorySummaryText()
    const activeBuffSummary = getActiveBuffSummaryText({
      sceneState: this.effectRuntimeSceneState,
      getItemLabel: itemDefinitionId => getItemDefinition(itemDefinitionId).name,
    })
    const activeDebuffSummary = getActiveDebuffSummaryText({
      sceneState: this.effectRuntimeSceneState,
      poisonDamagePerSecond: DEFAULT_POISON_DAMAGE_PER_SECOND,
    })
    const cooldownSummary = getItemCooldownSummaryText(this.effectRuntimeSceneState)
    this.hudText.setText([
      'Movement Phase 1',
      'WASD / Arrows: manual move',
      'LMB: A* click move',
      'E: interact',
      'Q: use potion',
      'H: debug damage',
      'R: respawn',
      'I: inventory',
      'T: add test shapes',
      `floor: ${this.floorIndex}`,
      `mode: ${this.player.getMovementMode()}`,
      `animation: ${this.player.getAnimationState()}`,
      `tile: ${Math.floor(playerWorld.x)}, ${Math.floor(playerWorld.y)}`,
      `world: ${playerWorld.x.toFixed(2)}, ${playerWorld.y.toFixed(2)}`,
      `path length: ${this.player.getPathLength()}`,
      `destination: ${destination ? `${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}` : 'none'}`,
      `goal: ${finalDestination ? `${finalDestination.x.toFixed(2)}, ${finalDestination.y.toFixed(2)}` : 'none'}`,
      `visible tiles: ${this.visibleTiles.size}`,
      `search budget: ${this.getPathSearchBudget()} (${PATH_SEARCH_BUDGET_MULTIPLIER.toFixed(1)}x)`,
      `path status: ${this.pathStatus}`,
      `interaction: ${this.interactionStatus}`,
      `job: ${this.playerCharacter.getJob().label}`,
      `health: ${this.playerCharacter.getHealth()}/${this.playerCharacter.getMaxHealth()}`,
      `mana: ${this.playerCharacter.getMana()}/${this.playerCharacter.getMaxMana()}`,
      `regen(hp/mp): ${this.playerCharacter.getHealthRegen().toFixed(1)}/${this.playerCharacter.getManaRegen().toFixed(1)}`,
      `atk(melee/ranged): ${this.playerCharacter.getMeleeAttack()}/${this.playerCharacter.getRangedAttack()}`,
      `matk(melee/ranged): ${this.playerCharacter.getMeleeMagicAttack()}/${this.playerCharacter.getRangedMagicAttack()}`,
      `def/move: ${this.playerCharacter.getDefense()}/${this.playerCharacter.getMoveSpeed().toFixed(2)}`,
      `atk spd/magic spd: ${this.playerCharacter.getAttackSpeed().toFixed(2)}/${this.playerCharacter.getMagicAttackSpeed().toFixed(2)}`,
      `full defense: ${(this.playerCharacter.getFullDefenseChance() * 100).toFixed(1)}%`,
      `buffs: ${activeBuffSummary}`,
      `debuffs: ${activeDebuffSummary}`,
      `cooldowns: ${cooldownSummary}`,
      `poisoned: ${this.playerCharacter.isPoisoned() ? 'yes' : 'no'}`,
      `guard: ${this.getGuardStatusText()}`,
      `life state: ${this.isDead() ? 'dead' : 'alive'}`,
      `gold: ${this.gold}  potions: ${this.getItemCount('potion_minor')}  keys: ${this.getItemCount('utility_key')}`,
      `inventory: ${inventorySummary}`,
      `journey: ${this.journeyLog.currentChapter}`,
      `achievements: ${this.achievements.unlocked.length > 0 ? this.achievements.unlocked.join(', ') : 'none'}`,
    ])
  }

  private drawPath(
    playerWorld: IsoPoint,
    playerScreen: IsoPoint,
    width: number,
    height: number
  ) {
    const points = this.player.getPathPoints()
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
    return canOccupy(this.dungeon, x, y, PLAYER_RADIUS)
  }

  private canOccupyCell(x: number, y: number): boolean {
    return canOccupyCell(this.dungeon, x, y, PLAYER_RADIUS)
  }

  private applyPathToTile(targetCell: { x: number; y: number }, successStatus: string): boolean {
    const result = this.findPathToTile(targetCell)
    if (!result.path) {
      this.player.clearDestination()
      this.pathStatus = result.exhaustedSearchBudget
        ? `path failed: search budget exceeded (${result.visitedNodes})`
        : 'path failed: no route'
      return false
    }

    if (result.path.length <= 1) {
      this.player.clearDestination()
      this.pathStatus = 'already at target'
      return false
    }

    this.player.setPath(result.path.slice(1).map(node => cellCenter(node.x, node.y)))
    this.pathStatus = `${successStatus} (${result.path.length - 1} nodes / budget ${this.getPathSearchBudget()})`
    return true
  }

  private repathToActiveGoal(): boolean {
    const goal = this.player.getFinalDestination()
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
      current: this.player.getMapPosition(),
      targetCell,
      playerRadius: PLAYER_RADIUS,
      maxVisitedNodes: this.getPathSearchBudget(),
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
    this.visibleTiles = computeVisibleTiles(this.dungeon, this.player.getMapPosition(), VISIBILITY_RADIUS)
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
    this.player.clearDestination()
    this.player.setMapPosition(floor.spawnPosition.x, floor.spawnPosition.y)
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
      const nearby = this.getNearbyInteractable()
      this.interactionStatus = nearby
        ? `press E: ${nearby.kind}${nearby.used ? ' (used)' : ''}`
        : 'none'
      return
    }

    const interactable = this.getNearbyInteractable()
    if (!interactable) {
      this.interactionStatus = 'nothing to interact with'
      return
    }

    if (interactable.kind === 'chest' || interactable.kind === 'locked-chest') {
      if (interactable.used) {
        this.interactionStatus = 'chest already opened'
        return
      }

      if (interactable.kind === 'locked-chest' && this.getItemCount('utility_key') <= 0) {
        this.interactionStatus = 'locked chest: need key'
        return
      }

      if (interactable.kind === 'locked-chest') {
        // Handled by chest interaction rules.
      }

      const result = openChest({
        interactable,
        inventories: [this.beltInventory, this.inventory],
        journeyLog: this.journeyLog,
        achievements: this.achievements,
        consumeKey: () => {
          const removedFromBelt = removeSingleItemByDefinition(this.beltInventory, 'utility_key')
          if (!removedFromBelt) {
            removeSingleItemByDefinition(this.inventory, 'utility_key')
          }
        },
      })
      this.gold += result.goldDelta
      this.applyUnlockedAchievements(result.unlocked)
      this.interactionStatus = result.status
      this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
      this.syncEffectRuntimeState()
      this.saveProgress()
      return
    }

    if (interactable.kind === 'npc') {
      this.startDialogue(interactable)
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

  private tryTriggerTrap(): void {
    const current = this.player.getMapPosition()
    const tileX = Phaser.Math.Clamp(Math.floor(current.x), 0, this.dungeon.width - 1)
    const tileY = Phaser.Math.Clamp(Math.floor(current.y), 0, this.dungeon.height - 1)
    const result = triggerTrap({
      trap: this.traps.find(candidate => candidate.tileX === tileX && candidate.tileY === tileY),
      now: this.time.now,
      trapRearmMs: TRAP_REARM_MS,
      trapDamageAmount: TRAP_DAMAGE_AMOUNT,
      health: this.playerCharacter.getHealth(),
      poisoned: this.playerCharacter.isPoisoned(),
      guardActive: this.playerCharacter.isGuardActive(this.getEffectRuntimeNowMs()),
    })
    if (!result.triggered) {
      return
    }

    this.playerCharacter.setHealth(result.health)
    this.playerCharacter.setPoisoned(result.poisoned)
    applyTrapRuntimeEffects({
      sceneState: this.effectRuntimeSceneState,
      nowMs: this.getEffectRuntimeNowMs(),
      poisonedDurationMs: result.poisonedDurationMs,
      slowDurationMs: result.slowDurationMs,
      slowStatModifiers: result.slowStatModifiers,
    })
    this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
    this.interactionStatus = result.status
    this.syncEffectRuntimeState()
    this.saveProgress()
  }

  private tryApplyDebugDamage(): void {
    if (this.activeDialogue || !Phaser.Input.Keyboard.JustDown(this.debugDamageKey)) {
      return
    }

    const result = applyDebugDamage(this.playerCharacter.getHealth(), DEBUG_DAMAGE_AMOUNT)
    this.playerCharacter.setHealth(result.health)
    this.interactionStatus = result.status
    this.syncEffectRuntimeState()
    this.saveProgress()
  }

  private tryRespawn(): void {
    if (!this.isDead() || !Phaser.Input.Keyboard.JustDown(this.respawnKey)) {
      return
    }

    const spawn = getRespawnPosition(this.spawnTile)
    this.player.clearDestination()
    this.player.setMapPosition(spawn.x, spawn.y)
    this.player.commitMapPosition(spawn.x, spawn.y)
    this.playerCharacter.setHealth(
      getRespawnHealth(this.playerCharacter.getMaxHealth(), RESPAWN_HEALTH_RATIO)
    )
    this.playerCharacter.setPoisoned(false)
    this.playerCharacter.setGuardBuffRemainingMs(0, this.getEffectRuntimeNowMs())
    clearEffectRuntimeDebuffs(this.effectRuntimeSceneState)
    this.interactionStatus = `respawned on floor ${this.floorIndex}`
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

    const result = addInventoryItems(this.inventory, TEST_SHAPE_ITEM_DEFINITION_IDS)
    const beltResult = addInventoryItems(this.beltInventory, TEST_BELT_ITEM_DEFINITION_IDS)
    this.interactionStatus =
      `added shapes ${result.addedCount}, belt consumables ${beltResult.addedCount}` +
      ((result.failedItemDefinitionIds.length + beltResult.failedItemDefinitionIds.length) > 0
        ? `, failed ${result.failedItemDefinitionIds.length + beltResult.failedItemDefinitionIds.length}`
        : '')
    if (result.addedCount > 0 || beltResult.addedCount > 0) {
      this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
      this.syncEffectRuntimeState()
      this.saveProgress()
    }
  }

  private getNearbyInteractable(): Interactable | null {
    return findNearbyInteractable(this.interactables, this.player.getMapPosition(), INTERACTION_RANGE)
  }

  private startDialogue(interactable: Interactable): void {
    const result = startNpcDialogue(interactable, this.journeyLog, this.achievements)
    if (!result.dialogue) {
      this.interactionStatus = result.status
      return
    }

    this.player.clearDestination()
    this.activeDialogue = result.dialogue
    this.applyUnlockedAchievements(result.unlocked)
    this.saveProgress()
    this.interactionStatus = result.status
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
    const effectNowMs = this.getEffectRuntimeNowMs()

    return createStoredProgressSnapshot({
      floorIndex: this.floorIndex,
      gold: this.gold,
      jobId: this.playerCharacter.getJobId(),
      health: this.playerCharacter.getHealth(),
      maxHealth: this.playerCharacter.getMaxHealth(),
      mana: this.playerCharacter.getMana(),
      maxMana: this.playerCharacter.getMaxMana(),
      poisoned: this.playerCharacter.isPoisoned(),
      guardBuffRemainingMs: this.playerCharacter.getGuardBuffRemainingMs(effectNowMs),
      ...createEffectRuntimeProgressData(this.effectRuntimeSceneState, {
        activeItemBuffs: serializeActiveItemBuffs,
        itemCooldowns: serializeItemCooldowns,
        timedModifiers: serializeTimedModifiers,
      }),
      inventory: this.inventory,
      beltInventory: this.beltInventory,
      journeyLog: this.journeyLog,
      achievements: this.achievements,
    })
  }

  private applyProgressSnapshot(snapshot: ProgressSnapshot): void {
    const loaded = applyStoredProgressSnapshot(snapshot, {
      defaultHealth: this.playerCharacter.getMaxHealth(),
      defaultMana: this.playerCharacter.getMaxMana(),
      inventoryCols: INVENTORY_COLS,
      inventoryRows: INVENTORY_ROWS,
      beltCols: BELT_COLS,
      beltRows: BELT_ROWS,
    })

    this.floorIndex = loaded.runtime.floorIndex
    this.gold = loaded.runtime.gold
    restoreEffectRuntimeCollections({
      sceneState: this.effectRuntimeSceneState,
      nowMs: this.time.now,
      poisonedRemainingMs: loaded.runtime.poisonedRemainingMs,
      restoreActiveItemBuffs: nowMs => restoreActiveItemBuffs(loaded.runtime.activeItemBuffs, nowMs),
      restoreItemCooldowns: nowMs => restoreItemCooldowns(loaded.runtime.itemCooldowns, nowMs),
      restoreTimedModifiers: nowMs => restoreTimedModifiers(loaded.runtime.timedModifiers, nowMs),
    })
    this.playerCharacter.applyRuntimeSnapshot({
      jobId: loaded.runtime.jobId,
      health: loaded.runtime.health,
      mana: loaded.runtime.mana,
      poisoned: loaded.runtime.poisoned,
      guardBuffRemainingMs: loaded.runtime.guardBuffRemainingMs,
    }, this.time.now)
    this.inventory = loaded.runtime.inventory
    this.beltInventory = loaded.runtime.beltInventory
    this.journeyLog = loaded.journeyLog
    this.achievements = loaded.achievements
    this.refreshCharacterStatSources(this.getEffectRuntimeNowMs())
    this.syncEffectRuntimeState()
  }

  private getItemCount(itemDefinitionId: string): number {
    return getItemCountAcrossInventories([this.beltInventory, this.inventory], itemDefinitionId)
  }

  private getInventorySummaryText(): string {
    return [
      `belt: ${getInventorySummaryText(this.beltInventory)}`,
      `bag: ${getInventorySummaryText(this.inventory)}`,
    ].join(' | ')
  }

  private isDead(): boolean {
    return this.playerCharacter.isDead()
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
      beltInventory: this.beltInventory,
      inventory: this.inventory,
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

  private getGuardStatusText(): string {
    const remainingMs = this.playerCharacter.getGuardBuffRemainingMs(this.getEffectRuntimeNowMs())
    if (remainingMs <= 0) {
      return 'off'
    }

    return `${(remainingMs / 1000).toFixed(1)}s`
  }

  private refreshCharacterStatSources(nowMs: number): void {
    this.playerCharacter.setEquipmentBonuses(getInventoryEquipmentStatBonuses(this.inventory))
    this.playerCharacter.setPotionBonuses(
      getActiveItemBuffStatBonuses(this.effectRuntimeSceneState.activeItemBuffs, nowMs)
    )
    this.playerCharacter.setTemporaryBonuses(
      this.effectRuntimeSceneState.timedModifiers.map(modifier => modifier.modifiers)
    )
    if (this.player) {
      this.player.setMoveSpeed(this.playerCharacter.getMoveSpeed())
    }
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
        poisonDamagePerSecond: DEFAULT_POISON_DAMAGE_PER_SECOND,
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
        poisonDamagePerSecond: DEFAULT_POISON_DAMAGE_PER_SECOND,
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
      poisonDamagePerSecond: DEFAULT_POISON_DAMAGE_PER_SECOND,
    })
    if (!areEffectRuntimeStatesEqual(state, reconciledState)) {
      const nextRevision = this.effectRuntimeClient?.syncState(reconciledState)
      if (nextRevision) {
        this.latestEffectRuntimeSyncRevision = nextRevision
      }
    }
  }
}
