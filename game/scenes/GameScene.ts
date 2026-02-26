import * as Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Portal } from '../entities/Portal'
import { Enemy } from '../entities/Enemy'
import { BSPDungeon, TileType, Room } from '../map/BSPDungeon'

let worldX = 0
let worldY = 0

const TILE_W = 96
const TILE_H = 48
const POOL_SIZE = 1000

export class GameScene extends Phaser.Scene {
  private player!: Player
  private playerShadow!: Phaser.GameObjects.Ellipse
  private dungeon!: BSPDungeon
  private tilePool: Phaser.GameObjects.Image[] = []
  private portal!: Portal
  private enemies: Enemy[] = []
  private onPlayerMove?: (x: number, y: number) => void

  constructor() {
    super({ key: 'GameScene' })
  }

  setOnPlayerMove(callback: (x: number, y: number) => void) {
    this.onPlayerMove = callback
  }

  getDungeon(): BSPDungeon | null {
    return this.dungeon
  }

  create() {
    const { width, height } = this.scale

    this.cameras.main.setBackgroundColor(0x111111)

    // BSP 던전 생성
    this.generateDungeon()

    // 마름모 타일 텍스처 베이크
    this.bakeDiamonds()

    // Image 풀 생성
    for (let i = 0; i < POOL_SIZE; i++) {
      this.tilePool.push(this.add.image(-9999, -9999, 'tile-a').setDepth(1))
    }

    // 플레이어 그림자
    this.playerShadow = this.add.ellipse(width / 2, height / 2 + 10, 28, 10, 0x000000, 0.5)
    this.playerShadow.setDepth(9998)

    // 플레이어를 던전 시작 위치에 배치
    const startPos = this.dungeon.getStartPosition()
    worldX = startPos.x * TILE_W
    worldY = startPos.y * TILE_H

    this.player = new Player(this, width / 2, height / 2)

    // 포털 생성 (마지막 방)
    this.spawnPortal()

    // 적 생성
    this.spawnEnemies(5)

    this.drawDungeon()
  }

  private generateDungeon() {
    this.dungeon = new BSPDungeon(80, 80)
    this.dungeon.generate()
    console.log('Dungeon generated with', this.dungeon.getRooms().length, 'rooms')
  }

  private spawnPortal() {
    const rooms = this.dungeon.getRooms()
    if (rooms.length === 0) return

    // 마지막 방에 포털 생성
    const lastRoom = rooms[rooms.length - 1]
    const px = lastRoom.centerX * TILE_W
    const py = lastRoom.centerY * TILE_H

    const { width, height } = this.scale
    const sx = px - worldX + width / 2
    const sy = py - worldY + height / 2

    this.portal = new Portal(this, sx, sy)
  }

  private spawnEnemies(count: number) {
    const rooms = this.dungeon.getRooms()
    const startPos = this.dungeon.getStartPosition()

    // 시작 방 제외하고 적 생성
    const validRooms = rooms.filter((r) => {
      const dist = Math.sqrt(
        Math.pow(r.centerX - startPos.x, 2) + Math.pow(r.centerY - startPos.y, 2)
      )
      return dist > 5 // 5타일 이상 떨어진 방
    })

    for (let i = 0; i < count && i < validRooms.length; i++) {
      const room = validRooms[i % validRooms.length]
      // 방 난수 위치
      const ex = (room.x + 1 + Math.random() * (room.width - 2)) * TILE_W
      const ey = (room.y + 1 + Math.random() * (room.height - 2)) * TILE_H

      const enemy = new Enemy(this, ex, ey, this.dungeon, TILE_W, TILE_H)
      this.enemies.push(enemy)
    }
  }

  private regenerateDungeon() {
    // Clean up
    this.enemies.forEach((e) => e.destroy())
    this.enemies = []
    if (this.portal) this.portal.destroy()

    // Generate new
    this.generateDungeon()
    const startPos = this.dungeon.getStartPosition()
    worldX = startPos.x * TILE_W
    worldY = startPos.y * TILE_H

    this.spawnPortal()
    this.spawnEnemies(5 + Math.floor(Math.random() * 3))
  }

  private bakeDiamonds() {
    const halfW = TILE_W / 2
    const halfH = TILE_H / 2
    const groundImg = this.textures.get('ground').getSourceImage() as HTMLImageElement

    const variants: { key: string; darken: number }[] = [
      { key: 'tile-a', darken: 0 },
      { key: 'tile-b', darken: 0.25 },
    ]

    for (const { key, darken } of variants) {
      if (this.textures.exists(key)) this.textures.remove(key)

      const ct = this.textures.createCanvas(key, TILE_W, TILE_H)

      if (ct) {
        const ctx = ct.context

        ctx.beginPath()
        ctx.moveTo(halfW, 0)
        ctx.lineTo(TILE_W, halfH)
        ctx.lineTo(halfW, TILE_H)
        ctx.lineTo(0, halfH)
        ctx.closePath()
        ctx.clip()

        ctx.drawImage(groundImg, 0, 0, TILE_W, TILE_H)

        if (darken > 0) {
          ctx.fillStyle = `rgba(0,0,0,${darken})`
          ctx.fillRect(0, 0, TILE_W, TILE_H)
        }

        ctx.beginPath()
        ctx.moveTo(halfW, 1)
        ctx.lineTo(TILE_W - 1, halfH)
        ctx.lineTo(halfW, TILE_H - 1)
        ctx.lineTo(1, halfH)
        ctx.closePath()
        ctx.strokeStyle = 'rgba(180,210,180,0.4)'
        ctx.lineWidth = 1
        ctx.stroke()

        ct.refresh()
      } else {
        const g = this.add.graphics()
        const color = darken > 0 ? 0x2e4a2e : 0x3a5c3a
        g.fillStyle(color, 1)
        g.lineStyle(1, 0xaabbaa, 0.6)
        g.beginPath()
        g.moveTo(halfW, 0)
        g.lineTo(TILE_W, halfH)
        g.lineTo(halfW, TILE_H)
        g.lineTo(0, halfH)
        g.closePath()
        g.fillPath()
        g.strokePath()
        g.generateTexture(key, TILE_W, TILE_H)
        g.destroy()
      }
    }
  }

  private drawDungeon() {
    const { width, height } = this.scale
    const halfW = TILE_W / 2
    const halfH = TILE_H / 2

    const grid = this.dungeon.getGrid()
    let poolIdx = 0

    for (let gy = 0; gy < this.dungeon.height; gy++) {
      for (let gx = 0; gx < this.dungeon.width; gx++) {
        const tile = grid[gy][gx]
        if (tile === TileType.WALL) continue

        const tw = gx * TILE_W
        const th = gy * TILE_H

        const sx = tw - worldX + width / 2
        const sy = th - worldY + height / 2

        if (sx + halfW < 0 || sx - halfW > width) continue
        if (sy + halfH < 0 || sy - halfH > height) continue

        if (poolIdx < this.tilePool.length) {
          const image = this.tilePool[poolIdx++]
          image.setPosition(sx, sy)
          image.setTexture((gx + gy) % 2 === 0 ? 'tile-a' : 'tile-b')
        }
      }
    }

    for (; poolIdx < this.tilePool.length; poolIdx++) {
      this.tilePool[poolIdx].setPosition(-9999, -9999)
    }

    // Update portal position
    if (this.portal) {
      const rooms = this.dungeon.getRooms()
      if (rooms.length > 0) {
        const lastRoom = rooms[rooms.length - 1]
        const px = lastRoom.centerX * TILE_W
        const py = lastRoom.centerY * TILE_H
        this.portal.x = px - worldX + width / 2
        this.portal.y = py - worldY + height / 2
      }
    }

    // Update enemies position (relative to camera)
    this.enemies.forEach((enemy) => {
      const pos = enemy.getPosition()
      enemy.x = pos.x - worldX + width / 2
      enemy.y = pos.y - worldY + height / 2
    })
  }

  private checkCollision(newX: number, newY: number): boolean {
    const gx = Math.floor(newX / TILE_W)
    const gy = Math.floor(newY / TILE_H)
    return this.dungeon.isWalkable(gx, gy)
  }

  update(_time: number, delta: number) {
    const { width, height } = this.scale
    const { vx, vy } = this.player.update(delta)

    const newX = worldX + vx
    const newY = worldY + vy

    if (this.checkCollision(newX, worldY)) {
      worldX = newX
    }
    if (this.checkCollision(worldX, newY)) {
      worldY = newY
    }

    // Notify minimap
    if (this.onPlayerMove) {
      this.onPlayerMove(worldX, worldY)
    }

    // Check portal collision
    if (this.portal) {
      const playerScreenX = width / 2
      const playerScreenY = height / 2
      if (this.portal.checkCollision(playerScreenX, playerScreenY)) {
        console.log('Portal touched! Generating new dungeon...')
        this.regenerateDungeon()
        return
      }
      this.portal.update(_time)
    }

    // Update enemies
    const playerWorldX = worldX + width / 2
    const playerWorldY = worldY + height / 2
    this.enemies.forEach((enemy) => {
      enemy.update(delta, playerWorldX, playerWorldY)
    })

    this.drawDungeon()

    this.player.setScale(1.0)
    this.playerShadow.setPosition(width / 2, height / 2 + 14)
  }
}
