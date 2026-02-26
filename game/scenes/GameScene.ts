import * as Phaser from 'phaser'
import { Player } from '../entities/Player'
import { BSPDungeon, TileType } from '../map/BSPDungeon'

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

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale

    this.cameras.main.setBackgroundColor(0x111111)

    // BSP 던전 생성
    this.dungeon = new BSPDungeon(80, 80)
    this.dungeon.generate()
    console.log('Dungeon generated with', this.dungeon.getRooms().length, 'rooms')

    // 마름모 타일 텍스처 베이크 (ground.png 클리핑 or 단색 폰백)
    this.bakeDiamonds()

    // Image 풀 생성 (던전용)
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

    this.drawDungeon()
  }

  /**
   * ground.png 를 마름모 shape 으로 클리핑해서 tile-a / tile-b 텍스처 베이크.
   * tile-b 는 약간 어둡게 처리해 체커보드 구분.
   * Canvas API 실패 시 단색 Graphics 폰백.
   */
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
        // ── Canvas: 마름모 클리핑 후 ground.png 텍스처 그리기 ──
        const ctx = ct.context

        ctx.beginPath()
        ctx.moveTo(halfW, 0)
        ctx.lineTo(TILE_W, halfH)
        ctx.lineTo(halfW, TILE_H)
        ctx.lineTo(0, halfH)
        ctx.closePath()
        ctx.clip()

        // ground.png 를 타일 크기에 맞게 스케일해서 붙여넣기
        ctx.drawImage(groundImg, 0, 0, TILE_W, TILE_H)

        // tile-b 는 어두운 오버레이로 체커보드 구분
        if (darken > 0) {
          ctx.fillStyle = `rgba(0,0,0,${darken})`
          ctx.fillRect(0, 0, TILE_W, TILE_H)
        }

        // 테두리선
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
        // ── 폰백: 단색 Graphics ──
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

        // 타일 월드 좌표
        const tw = gx * TILE_W
        const th = gy * TILE_H

        // 화면 좌표로 변환 (isometric)
        const sx = tw - worldX + width / 2
        const sy = th - worldY + height / 2

        // 화면 밖이면 스킵
        if (sx + halfW < 0 || sx - halfW > width) continue
        if (sy + halfH < 0 || sy - halfH > height) continue

        if (poolIdx < this.tilePool.length) {
          const image = this.tilePool[poolIdx++]
          image.setPosition(sx, sy)
          image.setTexture((gx + gy) % 2 === 0 ? 'tile-a' : 'tile-b')
        }
      }
    }

    // 사용하지 않는 풀 타일 숨김
    for (; poolIdx < this.tilePool.length; poolIdx++) {
      this.tilePool[poolIdx].setPosition(-9999, -9999)
    }
  }

  private checkCollision(newX: number, newY: number): boolean {
    // 월드 좌표를 그리드 좌표로 변환
    const gx = Math.floor(newX / TILE_W)
    const gy = Math.floor(newY / TILE_H)
    return this.dungeon.isWalkable(gx, gy)
  }

  update(_time: number, delta: number) {
    const { width, height } = this.scale
    const { vx, vy } = this.player.update(delta)

    // 충돌 검사
    const newX = worldX + vx
    const newY = worldY + vy

    // X축 이동 검사
    if (this.checkCollision(newX, worldY)) {
      worldX = newX
    }
    // Y축 이동 검사
    if (this.checkCollision(worldX, newY)) {
      worldY = newY
    }

    // 던전 타일 위치 갱신
    this.drawDungeon()

    this.player.setScale(1.0)
    this.playerShadow.setPosition(width / 2, height / 2 + 14)
  }
}
