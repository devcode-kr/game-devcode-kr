import * as Phaser from 'phaser'
import { Player } from '../entities/Player'
import {
  createEmptyInventory,
  removeSingleItemByDefinition,
  type InventoryState,
} from '../items/Inventory'
import {
  getInventoryItemCount,
  getInventorySummaryText,
} from '../items/InventoryUtils'
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
  isDead,
  triggerTrap,
  tryUsePotion,
} from '../interactions/SurvivalRules'
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

const POOL_SIZE = 1000
const PLAYER_RADIUS = 0.24
const VISIBILITY_RADIUS = 12
const PATH_SEARCH_BUDGET_MULTIPLIER = 1.5
const MIN_PATH_SEARCH_BUDGET = 8
const INTERACTION_RANGE = 1.1
const PROGRESS_STORAGE_KEY = 'game-devcode-kr/progress'
const INVENTORY_COLS = 6
const INVENTORY_ROWS = 8
const DEFAULT_MAX_HEALTH = 100
const DEBUG_DAMAGE_AMOUNT = 25
const TRAP_DAMAGE_AMOUNT = 20
const TRAP_REARM_MS = 1600
const RESPAWN_HEALTH_RATIO = 0.5

export class GameScene extends Phaser.Scene {
  private player!: Player
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
  private health = DEFAULT_MAX_HEALTH
  private maxHealth = DEFAULT_MAX_HEALTH
  private spawnTile = { x: 0, y: 0 }
  private inventory: InventoryState = createEmptyInventory(INVENTORY_COLS, INVENTORY_ROWS)
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

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    this.cameras.main.setBackgroundColor(0x111111)

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

    this.loadProgress()
    this.generateFloor(true)

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
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
    this.refreshVisibility()
    this.tryToggleInventory()
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
    this.inventoryPanel.render(width, this.inventory)

    const destination = this.player.getDestination()
    const finalDestination = this.player.getFinalDestination()
    const inventorySummary = this.getInventorySummaryText()
    this.hudText.setText([
      'Movement Phase 1',
      'WASD / Arrows: manual move',
      'LMB: A* click move',
      'E: interact',
      'Q: use potion',
      'H: debug damage',
      'R: respawn',
      'I: inventory',
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
      `health: ${this.health}/${this.maxHealth}`,
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
        inventory: this.inventory,
        journeyLog: this.journeyLog,
        achievements: this.achievements,
        consumeKey: () => {
          removeSingleItemByDefinition(this.inventory, 'utility_key')
        },
      })
      this.gold += result.goldDelta
      this.applyUnlockedAchievements(result.unlocked)
      this.interactionStatus = result.status
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

    const result = tryUsePotion({
      inventory: this.inventory,
      health: this.health,
      maxHealth: this.maxHealth,
    })
    this.health = result.health
    this.interactionStatus = result.status
    if (!result.used) {
      return
    }

    this.saveProgress()
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
      health: this.health,
    })
    if (!result.triggered) {
      return
    }

    this.health = result.health
    this.interactionStatus = result.status
    this.saveProgress()
  }

  private tryApplyDebugDamage(): void {
    if (this.activeDialogue || !Phaser.Input.Keyboard.JustDown(this.debugDamageKey)) {
      return
    }

    const result = applyDebugDamage(this.health, DEBUG_DAMAGE_AMOUNT)
    this.health = result.health
    this.interactionStatus = result.status
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
    this.health = getRespawnHealth(this.maxHealth, RESPAWN_HEALTH_RATIO)
    this.interactionStatus = `respawned on floor ${this.floorIndex}`
    this.saveProgress()
  }

  private tryToggleInventory(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
      return
    }

    this.inventoryPanel.toggle()
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
    return createStoredProgressSnapshot({
      floorIndex: this.floorIndex,
      gold: this.gold,
      health: this.health,
      maxHealth: this.maxHealth,
      inventory: this.inventory,
      journeyLog: this.journeyLog,
      achievements: this.achievements,
    })
  }

  private applyProgressSnapshot(snapshot: ProgressSnapshot): void {
    const loaded = applyStoredProgressSnapshot(snapshot, {
      defaultHealth: DEFAULT_MAX_HEALTH,
      inventoryCols: INVENTORY_COLS,
      inventoryRows: INVENTORY_ROWS,
    })

    this.floorIndex = loaded.runtime.floorIndex
    this.gold = loaded.runtime.gold
    this.health = loaded.runtime.health
    this.maxHealth = loaded.runtime.maxHealth
    this.inventory = loaded.runtime.inventory
    this.journeyLog = loaded.journeyLog
    this.achievements = loaded.achievements
  }

  private getItemCount(itemDefinitionId: string): number {
    return getInventoryItemCount(this.inventory, itemDefinitionId)
  }

  private getInventorySummaryText(): string {
    return getInventorySummaryText(this.inventory)
  }

  private isDead(): boolean {
    return isDead(this.health)
  }

  private applyUnlockedAchievements(labels: string[]): void {
    if (labels.length === 0 || this.interactionStatus !== 'none') {
      return
    }

    this.interactionStatus = `achievement unlocked: ${labels.join(', ')}`
  }
}
