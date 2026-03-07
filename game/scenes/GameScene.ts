import * as Phaser from 'phaser'
import { Player } from '../entities/Player'
import {
  addItemInstance,
  countItemsByDefinition,
  createEmptyInventory,
  createItemInstance,
  getInventoryStackViews,
  removeSingleItemByDefinition,
  type InventoryState,
} from '../items/Inventory'
import { BSPDungeon, TileType } from '../map/BSPDungeon'
import { getItemDefinition } from '../items/ItemCatalog'
import {
  resolveNpcDialogue,
  type DialogueScript,
  type NpcProfile,
} from '../npc/NpcDialogue'
import { findAStarPath } from '../pathfinding/AStar'
import {
  createLocalStorageProgressStore,
  type AchievementState,
  type JourneyLog,
  type ProgressSnapshot,
  type ProgressStore,
} from '../progress/ProgressStore'
import {
  cellCenter,
  HALF_TILE_HEIGHT,
  HALF_TILE_WIDTH,
  type IsoPoint,
  screenToWorld,
  TILE_HEIGHT,
  TILE_WIDTH,
  worldToScreen,
} from '../iso'

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

type InteractableKind = 'chest' | 'locked-chest' | 'stairs' | 'npc'

interface Interactable {
  id: string
  kind: InteractableKind
  tileX: number
  tileY: number
  image: Phaser.GameObjects.Image
  used: boolean
  reward?: ChestReward
  dialogue?: DialogueScript
  npcProfile?: NpcProfile
}

type ChestRewardKind = 'gold' | 'potion' | 'key'

interface ChestReward {
  kind: ChestRewardKind
  amount: number
}

interface Trap {
  id: string
  tileX: number
  tileY: number
  image: Phaser.GameObjects.Image
  lastTriggeredAt: number
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`
}

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
  private dialogueBox!: Phaser.GameObjects.Rectangle
  private dialogueText!: Phaser.GameObjects.Text
  private pathStatus = 'idle'
  private interactionStatus = 'none'
  private floorIndex = 1
  private gold = 0
  private health = DEFAULT_MAX_HEALTH
  private maxHealth = DEFAULT_MAX_HEALTH
  private spawnTile = { x: 0, y: 0 }
  private inventory: InventoryState = createEmptyInventory(INVENTORY_COLS, INVENTORY_ROWS)
  private activeDialogue: { interactableId: string; script: DialogueScript; lineIndex: number } | null = null
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

    this.dialogueBox = this.add.rectangle(0, 0, 0, 0, 0x020617, 0.9)
    this.dialogueBox.setOrigin(0)
    this.dialogueBox.setStrokeStyle(2, 0xcbd5e1, 0.9)
    this.dialogueBox.setDepth(10001)
    this.dialogueBox.setScrollFactor(0)
    this.dialogueBox.setVisible(false)

    this.dialogueText = this.add.text(0, 0, '', {
      color: '#e2e8f0',
      fontSize: '18px',
      fontFamily: 'monospace',
      wordWrap: { width: 0 },
      lineSpacing: 6,
    })
    this.dialogueText.setDepth(10002)
    this.dialogueText.setScrollFactor(0)
    this.dialogueText.setVisible(false)

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

    this.loadProgress()
    this.generateFloor(true)

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.activeDialogue) {
        return
      }

      if (pointer.button !== 0) {
        return
      }

      const targetCell = this.pointerToTile(pointer.x, pointer.y)
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

    this.bakeInteractableTexture('interactable-chest', 0x8b5a2b, 0xfacc15)
    this.bakeInteractableTexture('interactable-locked-chest', 0x5b3a1e, 0x93c5fd)
    this.bakeInteractableTexture('interactable-stairs', 0x94a3b8, 0xe2e8f0)
    this.bakeInteractableTexture('interactable-npc', 0x0f766e, 0x99f6e4)
    this.bakeInteractableTexture('trap-spike', 0x7f1d1d, 0xfca5a5)
  }

  private bakeInteractableTexture(key: string, fill: number, stroke: number): void {
    if (this.textures.exists(key)) {
      this.textures.remove(key)
    }

    const graphics = this.make.graphics({ x: 0, y: 0 }, false)
    graphics.fillStyle(fill, 1)
    graphics.lineStyle(2, stroke, 0.95)
    graphics.fillRoundedRect(8, 8, 32, 22, 6)
    graphics.strokeRoundedRect(8, 8, 32, 22, 6)
    graphics.generateTexture(key, 48, 40)
    graphics.destroy()
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

    const hovered = this.pointerToTile(this.input.activePointer.x, this.input.activePointer.y)
    if (hovered && this.dungeon.isWalkable(hovered.x, hovered.y)) {
      const marker = worldToScreen(cellCenter(hovered.x, hovered.y))
      this.hoverMarker.setVisible(true)
      this.hoverMarker.setPosition(
        marker.x - playerScreen.x + width / 2,
        marker.y - playerScreen.y + height / 2
      )
    } else {
      this.hoverMarker.setVisible(false)
    }

    this.player.syncScreenPosition(width / 2, height / 2 - 18, isMoving || this.player.hasDestination(), this.game.loop.delta)
    this.drawDialogueUi(width, height)

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

  private drawDialogueUi(width: number, height: number): void {
    if (!this.activeDialogue) {
      this.dialogueBox.setVisible(false)
      this.dialogueText.setVisible(false)
      return
    }

    const padding = 20
    const boxWidth = Math.min(640, width - 32)
    const boxHeight = 132
    const x = 16
    const y = height - boxHeight - 16
    const line = this.activeDialogue.script.lines[this.activeDialogue.lineIndex] ?? ''

    this.dialogueBox.setVisible(true)
    this.dialogueBox.setPosition(x, y)
    this.dialogueBox.setSize(boxWidth, boxHeight)

    this.dialogueText.setVisible(true)
    this.dialogueText.setPosition(x + padding, y + padding)
    this.dialogueText.setWordWrapWidth(boxWidth - padding * 2)
    this.dialogueText.setText([
      this.activeDialogue.script.speaker,
      '',
      line,
      '',
      '[E] next',
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
    return this.sampleWalkable(x, y) &&
      this.sampleWalkable(x + PLAYER_RADIUS, y) &&
      this.sampleWalkable(x - PLAYER_RADIUS, y) &&
      this.sampleWalkable(x, y + PLAYER_RADIUS) &&
      this.sampleWalkable(x, y - PLAYER_RADIUS)
  }

  private canOccupyCell(x: number, y: number): boolean {
    const center = cellCenter(x, y)
    return this.canOccupy(center.x, center.y)
  }

  private sampleWalkable(x: number, y: number): boolean {
    return this.dungeon.isWalkable(Math.floor(x), Math.floor(y))
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
    const current = this.player.getMapPosition()
    const startTile = {
      x: Phaser.Math.Clamp(Math.floor(current.x), 0, this.dungeon.width - 1),
      y: Phaser.Math.Clamp(Math.floor(current.y), 0, this.dungeon.height - 1),
    }

    return findAStarPath(startTile, targetCell, {
      width: this.dungeon.width,
      height: this.dungeon.height,
      isWalkable: (x, y) => this.canOccupyCell(x, y),
      maxVisitedNodes: this.getPathSearchBudget(),
    })
  }

  private getPathSearchBudget(): number {
    return Math.max(
      Math.ceil(this.visibleTiles.size * PATH_SEARCH_BUDGET_MULTIPLIER),
      MIN_PATH_SEARCH_BUDGET
    )
  }

  private refreshVisibility(): void {
    const current = this.player.getMapPosition()
    const originX = Phaser.Math.Clamp(Math.floor(current.x), 0, this.dungeon.width - 1)
    const originY = Phaser.Math.Clamp(Math.floor(current.y), 0, this.dungeon.height - 1)
    const visibleTiles = new Set<string>()

    for (let y = originY - VISIBILITY_RADIUS; y <= originY + VISIBILITY_RADIUS; y++) {
      for (let x = originX - VISIBILITY_RADIUS; x <= originX + VISIBILITY_RADIUS; x++) {
        if (x < 0 || x >= this.dungeon.width || y < 0 || y >= this.dungeon.height) {
          continue
        }

        const distance = Phaser.Math.Distance.Between(originX, originY, x, y)
        if (distance > VISIBILITY_RADIUS) {
          continue
        }

        if (this.hasLineOfSight(originX, originY, x, y)) {
          visibleTiles.add(tileKey(x, y))
        }
      }
    }

    visibleTiles.add(tileKey(originX, originY))
    this.visibleTiles = visibleTiles
  }

  private hasLineOfSight(fromX: number, fromY: number, toX: number, toY: number): boolean {
    let x = fromX
    let y = fromY
    const dx = Math.abs(toX - fromX)
    const dy = Math.abs(toY - fromY)
    const stepX = fromX < toX ? 1 : -1
    const stepY = fromY < toY ? 1 : -1
    let error = dx - dy

    while (x !== toX || y !== toY) {
      if (!(x === fromX && y === fromY) && !this.dungeon.isWalkable(x, y)) {
        return false
      }

      const doubledError = error * 2
      if (doubledError > -dy) {
        error -= dy
        x += stepX
      }
      if (doubledError < dx) {
        error += dx
        y += stepY
      }
    }

    return this.dungeon.isWalkable(toX, toY)
  }

  private pointerToTile(screenX: number, screenY: number): { x: number; y: number } | null {
    const { width, height } = this.scale
    const playerWorld = this.player.getMapPosition()
    const localWorld = screenToWorld({
      x: screenX - width / 2,
      y: screenY - height / 2,
    })

    const tileX = Math.floor(playerWorld.x + localWorld.x)
    const tileY = Math.floor(playerWorld.y + localWorld.y)

    if (tileX < 0 || tileX >= this.dungeon.width || tileY < 0 || tileY >= this.dungeon.height) {
      return null
    }

    return { x: tileX, y: tileY }
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
    this.dungeon = new BSPDungeon(80, 80)
    this.dungeon.generate()

    const start = this.dungeon.getStartPosition()
    this.spawnTile = { x: start.x, y: start.y }
    const spawn = cellCenter(start.x, start.y)
    this.player.clearDestination()
    this.player.setMapPosition(spawn.x, spawn.y)
    this.rebuildInteractables(start.x, start.y)
    this.refreshVisibility()

    if (resetFloorIndex) {
      if (this.floorIndex <= 1) {
        this.floorIndex = 1
        this.journeyLog.steps.enteredDungeon = true
        this.journeyLog.currentChapter = 'Entered the dungeon'
        this.achievements.counters.floorsReached = 1
      }

      this.saveProgress()
      this.interactionStatus = `entered floor ${this.floorIndex}`
      return
    }

    this.floorIndex += 1
    this.journeyLog.steps.reachedNextFloor = true
    this.journeyLog.currentChapter = `Reached floor ${this.floorIndex}`
    this.achievements.counters.floorsReached = Math.max(this.achievements.counters.floorsReached, this.floorIndex)
    this.unlockAchievement('first-descent', this.achievements.counters.floorsReached >= 2, 'First Descent')
    this.saveProgress()
    this.interactionStatus = `entered floor ${this.floorIndex}`
  }

  private rebuildInteractables(startX: number, startY: number): void {
    for (const interactable of this.interactables) {
      interactable.image.destroy()
    }
    for (const trap of this.traps) {
      trap.image.destroy()
    }

    this.interactables = []
    this.traps = []
    const rooms = this.dungeon.getRooms()
    const candidateRooms = rooms.filter(room => !(room.centerX === startX && room.centerY === startY))

    const stairRoom = candidateRooms[candidateRooms.length - 1]
    if (stairRoom) {
      this.interactables.push(this.createInteractable('stairs', stairRoom.centerX, stairRoom.centerY))
    }

    for (let index = 0; index < Math.min(2, candidateRooms.length - 1); index++) {
      const room = candidateRooms[index]
      this.interactables.push(this.createInteractable(index === 0 ? 'chest' : 'locked-chest', room.centerX, room.centerY))
    }

    const firstChest = this.interactables.find(interactable => interactable.kind === 'chest')
    if (firstChest) {
      firstChest.reward = { kind: 'key', amount: 1 }
    }

    const npcRoom = candidateRooms.find(room =>
      !this.interactables.some(interactable => interactable.tileX === room.centerX && interactable.tileY === room.centerY)
    )
    if (npcRoom) {
      this.interactables.push(this.createInteractable('npc', npcRoom.centerX, npcRoom.centerY))
    }

    this.rebuildTraps(startX, startY)
  }

  private createInteractable(kind: InteractableKind, tileX: number, tileY: number): Interactable {
    const key = kind === 'chest'
      ? 'interactable-chest'
      : kind === 'locked-chest'
        ? 'interactable-locked-chest'
      : kind === 'stairs'
        ? 'interactable-stairs'
        : 'interactable-npc'
    return {
      id: `${kind}-${tileX}-${tileY}`,
      kind,
      tileX,
      tileY,
      image: this.add.image(-9999, -9999, key),
      used: false,
      reward: kind === 'chest' || kind === 'locked-chest' ? this.rollChestReward() : undefined,
      dialogue: undefined,
      npcProfile: kind === 'npc'
        ? {
            speaker: 'Caretaker',
          }
        : undefined,
    }
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
        removeSingleItemByDefinition(this.inventory, 'utility_key')
        this.journeyLog.steps.openedLockedChest = true
        this.journeyLog.currentChapter = 'Opened a locked chest'
        this.achievements.counters.lockedChestsOpened += 1
        this.unlockAchievement('lockbreaker', this.achievements.counters.lockedChestsOpened >= 1, 'Lockbreaker')
      }

      interactable.used = true
      this.achievements.counters.chestsOpened += 1
      this.unlockAchievement('first-loot', this.achievements.counters.chestsOpened >= 1, 'First Loot')
      this.unlockAchievement('treasure-hunter', this.achievements.counters.chestsOpened >= 3, 'Treasure Hunter')
      this.applyChestReward(interactable.reward, interactable.kind === 'locked-chest')
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

    if (this.health >= this.maxHealth) {
      this.interactionStatus = 'health already full'
      return
    }

    const removedItem = removeSingleItemByDefinition(this.inventory, 'potion_minor')
    if (!removedItem) {
      this.interactionStatus = 'no potion to use'
      return
    }

    const potionDefinition = getItemDefinition('potion_minor')
    const healAmount = potionDefinition.healAmount ?? 0
    const previousHealth = this.health
    this.health = Math.min(this.maxHealth, this.health + healAmount)
    const healed = this.health - previousHealth

    this.interactionStatus = `used ${potionDefinition.name}: +${healed} health`
    this.saveProgress()
  }

  private tryTriggerTrap(): void {
    if (this.health <= 0) {
      return
    }

    const current = this.player.getMapPosition()
    const tileX = Phaser.Math.Clamp(Math.floor(current.x), 0, this.dungeon.width - 1)
    const tileY = Phaser.Math.Clamp(Math.floor(current.y), 0, this.dungeon.height - 1)
    const trap = this.traps.find(candidate => candidate.tileX === tileX && candidate.tileY === tileY)
    if (!trap) {
      return
    }

    if (this.time.now - trap.lastTriggeredAt < TRAP_REARM_MS) {
      return
    }

    trap.lastTriggeredAt = this.time.now
    this.health = Math.max(0, this.health - TRAP_DAMAGE_AMOUNT)
    this.interactionStatus = this.isDead()
      ? `triggered trap: -${TRAP_DAMAGE_AMOUNT} health, died`
      : `triggered trap: -${TRAP_DAMAGE_AMOUNT} health`
    this.saveProgress()
  }

  private tryApplyDebugDamage(): void {
    if (this.activeDialogue || !Phaser.Input.Keyboard.JustDown(this.debugDamageKey)) {
      return
    }

    if (this.health <= 0) {
      this.interactionStatus = 'already at 0 health'
      return
    }

    this.health = Math.max(0, this.health - DEBUG_DAMAGE_AMOUNT)
    this.interactionStatus = this.isDead()
      ? `took ${DEBUG_DAMAGE_AMOUNT} damage and died`
      : `took ${DEBUG_DAMAGE_AMOUNT} damage`
    this.saveProgress()
  }

  private tryRespawn(): void {
    if (!this.isDead() || !Phaser.Input.Keyboard.JustDown(this.respawnKey)) {
      return
    }

    const spawn = cellCenter(this.spawnTile.x, this.spawnTile.y)
    this.player.clearDestination()
    this.player.setMapPosition(spawn.x, spawn.y)
    this.player.commitMapPosition(spawn.x, spawn.y)
    this.health = Math.max(1, Math.floor(this.maxHealth * RESPAWN_HEALTH_RATIO))
    this.interactionStatus = `respawned on floor ${this.floorIndex}`
    this.saveProgress()
  }

  private getNearbyInteractable(): Interactable | null {
    const current = this.player.getMapPosition()
    let nearest: Interactable | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const interactable of this.interactables) {
      const center = cellCenter(interactable.tileX, interactable.tileY)
      const distance = Phaser.Math.Distance.Between(current.x, current.y, center.x, center.y)
      if (distance > INTERACTION_RANGE || distance >= nearestDistance) {
        continue
      }

      nearest = interactable
      nearestDistance = distance
    }

    return nearest
  }

  private startDialogue(interactable: Interactable): void {
    const profile = interactable.npcProfile
    if (!profile) {
      this.interactionStatus = 'npc has nothing to say'
      return
    }

    const dialogue = resolveNpcDialogue(profile, {
      journeyLog: this.journeyLog,
      achievements: this.achievements,
    })
    if (!dialogue) {
      this.interactionStatus = 'npc has nothing to say'
      return
    }

    this.player.clearDestination()
    this.activeDialogue = {
      interactableId: interactable.id,
      script: dialogue,
      lineIndex: 0,
    }
    this.journeyLog.steps.talkedToNpc = true
    this.journeyLog.currentChapter = `Spoke with ${dialogue.speaker}`
    this.achievements.counters.npcTalks += 1
    this.unlockAchievement('first-conversation', this.achievements.counters.npcTalks >= 1, 'First Conversation')
    this.saveProgress()
    this.interactionStatus = `talking to ${dialogue.speaker}`
  }

  private advanceDialogue(): void {
    if (!this.activeDialogue) {
      return
    }

    const nextIndex = this.activeDialogue.lineIndex + 1
    if (nextIndex >= this.activeDialogue.script.lines.length) {
      this.interactionStatus = `finished talking to ${this.activeDialogue.script.speaker}`
      this.activeDialogue = null
      return
    }

    this.activeDialogue = {
      ...this.activeDialogue,
      lineIndex: nextIndex,
    }
  }

  private rollChestReward(): ChestReward {
    const roll = Math.random()
    if (roll < 0.55) {
      return {
        kind: 'gold',
        amount: Phaser.Math.Between(8, 22),
      }
    }

    if (roll < 0.85) {
      return {
        kind: 'potion',
        amount: 1,
      }
    }

    return {
      kind: 'key',
      amount: 1,
    }
  }

  private applyChestReward(reward?: ChestReward, wasLocked: boolean = false): void {
    if (!reward) {
      this.interactionStatus = wasLocked ? 'unlocked chest: empty' : 'opened empty chest'
      return
    }

    if (reward.kind === 'gold') {
      this.gold += reward.amount
      this.interactionStatus = `${wasLocked ? 'unlocked chest' : 'opened chest'}: +${reward.amount} gold`
      return
    }

    const itemDefinitionId = reward.kind === 'potion' ? 'potion_minor' : 'utility_key'
    const addedCount = this.addInventoryItemBatch(itemDefinitionId, reward.amount)
    const itemName = getItemDefinition(itemDefinitionId).name

    if (reward.kind === 'key' && addedCount > 0) {
      this.journeyLog.steps.foundKey = true
      this.journeyLog.currentChapter = 'Found a key'
      this.achievements.counters.keysCollected += addedCount
      this.unlockAchievement('key-bearer', this.achievements.counters.keysCollected >= 1, 'Key Bearer')
    }

    if (addedCount === 0) {
      this.interactionStatus = `inventory full: could not store ${itemName}`
      return
    }

    const storedSuffix = addedCount < reward.amount ? ` (${addedCount}/${reward.amount} stored)` : ''
    this.interactionStatus = `${wasLocked ? 'unlocked chest' : 'opened chest'}: +${addedCount} ${itemName}${storedSuffix}`
  }

  private unlockAchievement(_id: string, condition: boolean, label: string): void {
    if (!condition || this.achievements.unlocked.includes(label)) {
      return
    }

    this.achievements.unlocked.push(label)
    if (this.interactionStatus === 'none') {
      this.interactionStatus = `achievement unlocked: ${label}`
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
    return {
      floorIndex: this.floorIndex,
      gold: this.gold,
      health: this.health,
      maxHealth: this.maxHealth,
      inventory: this.inventory,
      journeyLog: this.journeyLog,
      achievements: this.achievements,
    }
  }

  private applyProgressSnapshot(snapshot: ProgressSnapshot): void {
    this.floorIndex = snapshot.floorIndex
    this.gold = snapshot.gold
    this.health = snapshot.health ?? DEFAULT_MAX_HEALTH
    this.maxHealth = snapshot.maxHealth ?? DEFAULT_MAX_HEALTH
    this.inventory = snapshot.inventory ?? this.createInventoryFromLegacySnapshot(snapshot)
    this.journeyLog = snapshot.journeyLog
    this.achievements = snapshot.achievements
  }

  private createInventoryFromLegacySnapshot(snapshot: ProgressSnapshot): InventoryState {
    const inventory = createEmptyInventory(INVENTORY_COLS, INVENTORY_ROWS)
    const legacyKeys = snapshot.keys ?? 0
    const legacyPotions = snapshot.potions ?? 0

    for (let index = 0; index < legacyKeys; index++) {
      addItemInstance(inventory, createItemInstance('utility_key'))
    }

    for (let index = 0; index < legacyPotions; index++) {
      addItemInstance(inventory, createItemInstance('potion_minor'))
    }

    return inventory
  }

  private addInventoryItemBatch(itemDefinitionId: string, amount: number): number {
    let addedCount = 0

    for (let index = 0; index < amount; index++) {
      const added = addItemInstance(this.inventory, createItemInstance(itemDefinitionId))
      if (!added) {
        break
      }

      addedCount += 1
    }

    return addedCount
  }

  private getItemCount(itemDefinitionId: string): number {
    return countItemsByDefinition(this.inventory, itemDefinitionId)
  }

  private getInventorySummaryText(): string {
    const stacks = getInventoryStackViews(this.inventory)
    if (stacks.length === 0) {
      return 'empty'
    }

    return stacks
      .slice(0, 3)
      .map(stack => `${stack.name} ${stack.count}/${stack.maxStack} @${stack.x},${stack.y}`)
      .join(' | ')
  }

  private isDead(): boolean {
    return this.health <= 0
  }

  private rebuildTraps(startX: number, startY: number): void {
    const rooms = this.dungeon.getRooms()
    const candidates = rooms
      .flatMap(room => [
        { x: room.centerX - 1, y: room.centerY },
        { x: room.centerX + 1, y: room.centerY },
      ])
      .filter(candidate => {
        if (!this.dungeon.isWalkable(candidate.x, candidate.y)) {
          return false
        }

        if ((candidate.x === startX && candidate.y === startY) || this.isOccupiedTile(candidate.x, candidate.y)) {
          return false
        }

        return true
      })

    for (const candidate of candidates.slice(0, 3)) {
      this.traps.push({
        id: `trap-${candidate.x}-${candidate.y}`,
        tileX: candidate.x,
        tileY: candidate.y,
        image: this.add.image(-9999, -9999, 'trap-spike'),
        lastTriggeredAt: -TRAP_REARM_MS,
      })
    }
  }

  private isOccupiedTile(tileX: number, tileY: number): boolean {
    return this.interactables.some(interactable => interactable.tileX === tileX && interactable.tileY === tileY)
  }
}
