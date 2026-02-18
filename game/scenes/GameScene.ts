import * as Phaser from 'phaser'
import { Player } from '../entities/Player'

let worldX = 0
let worldY = 0

const GRID_SIZE = 80
const GRID_COLS = 30
const GRID_ROWS = 30

export class GameScene extends Phaser.Scene {
  private player!: Player
  private gridGraphics!: Phaser.GameObjects.Graphics
  private playerShadow!: Phaser.GameObjects.Ellipse
  private skyImage!: Phaser.GameObjects.Image
  private groundTile!: Phaser.GameObjects.TileSprite

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale
    const vanishY = height * 0.3

    // 하늘 이미지 (소실점 위쪽)
    this.skyImage = this.add.image(width / 2, vanishY / 2, 'sky')
    this.skyImage.setDisplaySize(width, vanishY)
    this.skyImage.setDepth(0)

    // 바닥 타일 (소실점 아래쪽)
    const groundH = height - vanishY
    this.groundTile = this.add.tileSprite(
      width / 2,
      vanishY + groundH / 2,
      width, groundH,
      'ground'
    )
    this.groundTile.setDepth(1)

    // 원근 격자선 레이어 (텍스처 위에 오버레이)
    this.gridGraphics = this.add.graphics()
    this.gridGraphics.setDepth(2)

    // 플레이어 그림자
    this.playerShadow = this.add.ellipse(width / 2, height / 2 + 10, 28, 10, 0x000000, 0.5)
    this.playerShadow.setDepth(9998)

    // 플레이어
    this.player = new Player(this, width / 2, height / 2)

    this.drawGrid()
  }

  update(_time: number, delta: number) {
    const { width, height } = this.scale
    const { vx, vy } = this.player.update(delta)
    worldX += vx
    worldY += vy

    // 바닥 타일 스크롤 (원근 감안해 0.4 배율)
    this.groundTile.setTilePosition(worldX * 0.4, worldY * 0.4)

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
    const vanishY = height * 0.3

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

        // 소실점 위는 그리지 않음
        if (sy < vanishY) continue

        const tw = tileW * perspScale
        const th = tileH * perspScale

        // 격자선만 (바닥 텍스처가 배경)
        const alpha = 0.08 + t * 0.15
        g.lineStyle(1, 0x6677bb, alpha)
        g.strokeRect(sx - tw / 2, sy - th / 2, tw, th)
      }
    }

    // 지평선 글로우
    g.fillStyle(0x2a3a7a, 0.25)
    g.fillRect(0, vanishY - 4, width, 8)
  }
}
