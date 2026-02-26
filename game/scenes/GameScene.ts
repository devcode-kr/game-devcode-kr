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
  private floorPool: Phaser.GameObjects.Image[] = []
  private wallPool: Phaser.GameObjects.Image[] = []
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

    this.cameras.main.setBackgroundColor('#1a1a2e')

    // BSP 던전 생성
    this.generateDungeon()

    // 새 타일 텍스처 베이크 (마름모 클리핑)
    this.bakeTileTextures()

    // Image 풀 생성
    for (let i = 0; i < POOL_SIZE; i++) {
      this.floorPool.push(this.add.image(-9999, -9999, 'floor-light').setDepth(1))
    }
    for (let i = 0; i < 500; i++) {
      this.wallPool.push(this.add.image(-9999, -9999, 'wall').setDepth(100))
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

  private bakeTileTextures() {
    // 기존 텍스처 제거
    const keys = ['floor-light', 'floor-dark', 'wall']
    for (const key of keys) {
      if (this.textures.exists(key)) this.textures.remove(key)
    }

    // 바닥 타일 (밝은 버전)
    this.createDiamondTexture('floor-light', 'floor-stone', 0)
    // 바닥 타일 (어두운 버전)
    this.createDiamondTexture('floor-dark', 'floor-stone-dark', 0)
    // 벽 타일
    this.createDiamondTexture('wall', 'wall-stone', 0)
  }

  private createDiamondTexture(key: string, sourceKey: string, darken: number) {
    const halfW = TILE_W / 2
    const halfH = TILE_H / 2
    const sourceImg = this.textures.get(sourceKey).getSourceImage() as HTMLImageElement

    const ct = this.textures.createCanvas(key, TILE_W, TILE_H)
    if (!ct) return

    const ctx = ct.context

    // 마름모 클리핑
    ctx.beginPath()
    ctx.moveTo(halfW, 0)
    ctx.lineTo(TILE_W, halfH)
    ctx.lineTo(halfW, TILE_H)
    ctx.lineTo(0, halfH)
    ctx.closePath()
    ctx.clip()

    // 이미지 그리기
    ctx.drawImage(sourceImg, 0, 0, TILE_W, TILE_H)

    // 어둡게 처리 (선택적)
    if (darken > 0) {
      ctx.fillStyle = `rgba(0,0,0,${darken})`
      ctx.fillRect(0, 0, TILE_W, TILE_H)
    }

    ct.refresh()
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
      return dist > 5
    })

    for (let i = 0; i < count && i < validRooms.length; i++) {
      const room = validRooms[i % validRooms.length]
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

  private drawDungeon() {
    const { width, height } = this.scale
    const halfW = TILE_W / 2
    const halfH = TILE_H / 2

    const grid = this.dungeon.getGrid()
    let floorIdx = 0
    let wallIdx = 0

    // First pass: render floor tiles
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

        if (floorIdx < this.floorPool.length) {
          const image = this.floorPool[floorIdx++]
          image.setPosition(sx, sy)
          // 체커보드 패턴: FLOOR와 CORRIDOR 다른 텍스처
          if (tile === TileType.CORRIDOR) {
            image.setTexture('floor-dark')
          } else {
            image.setTexture((gx + gy) % 2 === 0 ? 'floor-light' : 'floor-dark')
          }
        }
      }
    }

    // Hide unused floor tiles
    for (; floorIdx < this.floorPool.length; floorIdx++) {
      this.floorPool[floorIdx].setPosition(-9999, -9999)
    }

    // Second pass: render wall tiles (edges of walkable areas)
    for (let gy = 0; gy < this.dungeon.height; gy++) {
      for (let gx = 0; gx < this.dungeon.width; gx++) {
        const tile = grid[gy][gx]
        if (tile !== TileType.WALL) continue

        // 벽 옆에 바닥이 있는 경우만 렌더링 (가장자리 벽)
        const hasAdjacentFloor = (
          (gy > 0 && grid[gy - 1][gx] !== TileType.WALL) ||
          (gy < this.dungeon.height - 1 && grid[gy + 1][gx] !== TileType.WALL) ||
          (gx > 0 && grid[gy][gx - 1] !== TileType.WALL) ||
          (gx < this.dungeon.width - 1 && grid[gy][gx + 1] !== TileType.WALL)
        )
        if (!hasAdjacentFloor) continue

        const tw = gx * TILE_W
        const th = gy * TILE_H

        const sx = tw - worldX + width / 2
        const sy = th - worldY + height / 2

        if (sx + halfW < 0 || sx - halfW > width) continue
        if (sy + halfH < 0 || sy - halfH > height) continue

        if (wallIdx < this.wallPool.length) {
          const image = this.wallPool[wallIdx++]
          image.setPosition(sx, sy)
          image.setTexture('wall')
        }
      }
    }

    // Hide unused wall tiles
    for (; wallIdx < this.wallPool.length; wallIdx++) {
      this.wallPool[wallIdx].setPosition(-9999, -9999)
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

    // Update enemies position
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
