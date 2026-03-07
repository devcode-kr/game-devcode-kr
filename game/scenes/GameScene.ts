import * as Phaser from 'phaser'
import { Player } from '../entities/Player'
import { BSPDungeon, TileType } from '../map/BSPDungeon'
import {
  cellCenter,
  HALF_TILE_HEIGHT,
  HALF_TILE_WIDTH,
  screenToWorld,
  TILE_HEIGHT,
  TILE_WIDTH,
  worldToScreen,
} from '../iso'

const POOL_SIZE = 1000
const PLAYER_RADIUS = 0.24

export class GameScene extends Phaser.Scene {
  private player!: Player
  private dungeon!: BSPDungeon
  private tilePool: Phaser.GameObjects.Image[] = []
  private inputVector = new Phaser.Math.Vector2()
  private hoverMarker!: Phaser.GameObjects.Ellipse
  private hudText!: Phaser.GameObjects.Text
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    this.cameras.main.setBackgroundColor(0x111111)

    this.dungeon = new BSPDungeon(80, 80)
    this.dungeon.generate()

    this.bakeDiamonds()

    for (let i = 0; i < POOL_SIZE; i++) {
      this.tilePool.push(this.add.image(-9999, -9999, 'tile-a').setDepth(1))
    }

    this.player = new Player(this)
    const start = this.dungeon.getStartPosition()
    const spawn = cellCenter(start.x, start.y)
    this.player.setMapPosition(spawn.x, spawn.y)

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

    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
    this.cursors = this.input.keyboard!.createCursorKeys()

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) {
        return
      }

      const targetCell = this.pointerToTile(pointer.x, pointer.y)
      if (!targetCell || !this.dungeon.isWalkable(targetCell.x, targetCell.y)) {
        this.player.clearDestination()
        return
      }

      const destination = cellCenter(targetCell.x, targetCell.y)
      this.player.setDestination(destination.x, destination.y)
    })

    this.drawDungeon(false)
  }

  update(_time: number, delta: number) {
    const input = this.readInputVector()
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
        this.player.clearDestination()
      }
    }

    this.player.commitMapPosition(nextX, nextY)
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

    const destination = this.player.getDestination()
    this.hudText.setText([
      'Movement Phase 1',
      'WASD / Arrows: manual move',
      'LMB: straight click move',
      `mode: ${this.player.getMovementMode()}`,
      `animation: ${this.player.getAnimationState()}`,
      `tile: ${Math.floor(playerWorld.x)}, ${Math.floor(playerWorld.y)}`,
      `world: ${playerWorld.x.toFixed(2)}, ${playerWorld.y.toFixed(2)}`,
      `destination: ${destination ? `${destination.x.toFixed(2)}, ${destination.y.toFixed(2)}` : 'none'}`,
    ])
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

  private sampleWalkable(x: number, y: number): boolean {
    return this.dungeon.isWalkable(Math.floor(x), Math.floor(y))
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
}
