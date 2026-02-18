import * as Phaser from 'phaser'
import { Player } from '../entities/Player'

let worldX = 0
let worldY = 0

const GRID_SIZE = 80
const GRID_COLS = 30
const GRID_ROWS = 30
const NUM_STRIPS = 48      // 수평 스트립 수 (많을수록 부드러운 원근)
const VANISH_Y_RATIO = 0.3

export class GameScene extends Phaser.Scene {
  private player!: Player
  private gridGraphics!: Phaser.GameObjects.Graphics
  private playerShadow!: Phaser.GameObjects.Ellipse
  private skyImage!: Phaser.GameObjects.Image
  private groundStrips: Phaser.GameObjects.TileSprite[] = []

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale
    const vanishY = height * VANISH_Y_RATIO

    // 하늘 이미지
    this.skyImage = this.add.image(width / 2, vanishY / 2, 'sky')
    this.skyImage.setDisplaySize(width, vanishY)
    this.skyImage.setDepth(0)

    // 원근 바닥: 수평 스트립으로 분할
    this.createGroundStrips(width, height, vanishY)

    // 격자선 오버레이
    this.gridGraphics = this.add.graphics()
    this.gridGraphics.setDepth(3)

    // 지평선 글로우
    const glow = this.add.graphics()
    glow.fillStyle(0x2a3a7a, 0.25)
    glow.fillRect(0, vanishY - 4, width, 8)
    glow.setDepth(4)

    // 플레이어 그림자
    this.playerShadow = this.add.ellipse(width / 2, height / 2 + 10, 28, 10, 0x000000, 0.5)
    this.playerShadow.setDepth(9998)

    // 플레이어
    this.player = new Player(this, width / 2, height / 2)

    this.drawGrid()
  }

  private createGroundStrips(width: number, height: number, vanishY: number) {
    const groundH = height - vanishY

    for (let i = 0; i < NUM_STRIPS; i++) {
      const t0 = i / NUM_STRIPS
      const t1 = (i + 1) / NUM_STRIPS

      // 원근: 제곱 easing으로 위쪽 압축
      const y0 = vanishY + groundH * Math.pow(t0, 1.8)
      const y1 = vanishY + groundH * Math.pow(t1, 1.8)
      const stripH = Math.max(1, y1 - y0)
      const centerY = y0 + stripH / 2

      // 원근 스케일: 위(0.05) → 아래(1.0)
      const perspScale = 0.05 + t0 * 0.95

      // 스트립 너비: 원근에 따라 좁아짐
      const stripW = width * perspScale + 2

      const strip = this.add.tileSprite(
        width / 2,
        centerY,
        stripW,
        stripH,
        'ground'
      )

      // 텍스처 스케일: 멀수록 텍스처도 작게
      strip.setTileScale(perspScale * 0.5, perspScale * 0.3)
      strip.setDepth(2)
      this.groundStrips.push(strip)
    }
  }

  update(_time: number, delta: number) {
    const { width, height } = this.scale
    const { vx, vy } = this.player.update(delta)
    worldX += vx
    worldY += vy

    // 스트립별 스크롤 (깊이에 비례)
    this.groundStrips.forEach((strip, i) => {
      const t = i / NUM_STRIPS
      const perspScale = 0.05 + t * 0.95
      strip.setTilePosition(
        worldX * perspScale * 0.5,
        worldY * perspScale * 0.3
      )
    })

    const normalized = (height / 2) / height
    const scale = 0.5 + normalized * 0.8
    this.player.setScale(scale)
    this.playerShadow.setPosition(width / 2, height / 2 + 14 * scale)
    this.playerShadow.setScale(scale)

    this.drawGrid()
  }

  private drawGrid() {
    const { width, height } = this.scale
    const g = this.gridGraphics
    g.clear()

    const vanishX = width / 2
    const vanishY = height * VANISH_Y_RATIO

    const tileW = GRID_SIZE
    const tileH = GRID_SIZE * 0.5

    const startCol = Math.floor(worldX / tileW) - 6
    const startRow = Math.floor(worldY / tileH) - 2
    const endCol = startCol + GRID_COLS + 10
    const endRow = startRow + GRID_ROWS

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const wx = col * tileW - worldX
        const wy = row * tileH - worldY

        const screenY = wy + height / 2
        const t = Phaser.Math.Clamp(screenY / height, 0, 1)
        const perspScale = 0.3 + t * 0.7

        const sx = vanishX + (wx - width / 2) * perspScale + (width / 2 - vanishX) * (1 - perspScale)
        const sy = vanishY + (screenY - vanishY) * perspScale

        if (sy < vanishY) continue

        const tw = tileW * perspScale
        const th = tileH * perspScale

        const alpha = 0.06 + t * 0.1
        g.lineStyle(1, 0x6677bb, alpha)
        g.strokeRect(sx - tw / 2, sy - th / 2, tw, th)
      }
    }
  }
}
