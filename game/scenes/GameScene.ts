import * as Phaser from 'phaser'
import { Player } from '../entities/Player'

let worldX = 0
let worldY = 0

const VANISH_Y_RATIO = 0.3
const TILE_W = 96
const TILE_H = 48

export class GameScene extends Phaser.Scene {
  private player!: Player
  private playerShadow!: Phaser.GameObjects.Ellipse
  private skyImage!: Phaser.GameObjects.Image
  private groundTile!: Phaser.GameObjects.TileSprite
  private gridGraphics!: Phaser.GameObjects.Graphics

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale
    const vanishY = height * VANISH_Y_RATIO
    const groundH = height - vanishY

    // 하늘
    this.skyImage = this.add.image(width / 2, vanishY / 2, 'sky')
    this.skyImage.setDisplaySize(width, vanishY)
    this.skyImage.setDepth(0)

    // 바닥 텍스처 (ground.png 타일링)
    this.groundTile = this.add.tileSprite(
      width / 2,
      vanishY + groundH / 2,
      width,
      groundH,
      'ground'
    )
    this.groundTile.setDepth(1)

    // 마름모 격자선 오버레이
    this.gridGraphics = this.add.graphics()
    this.gridGraphics.setDepth(2)

    // 지평선 글로우
    const glow = this.add.graphics()
    glow.fillStyle(0x1a2a4a, 0.5)
    glow.fillRect(0, vanishY - 6, width, 12)
    glow.setDepth(4)

    // 플레이어 그림자
    this.playerShadow = this.add.ellipse(width / 2, height / 2 + 10, 28, 10, 0x000000, 0.5)
    this.playerShadow.setDepth(9998)

    // 플레이어
    this.player = new Player(this, width / 2, height / 2)

    this.drawIsoGrid()
  }

  private drawIsoGrid() {
    const { width, height } = this.scale
    const vanishY = height * VANISH_Y_RATIO
    const halfW = TILE_W / 2
    const halfH = TILE_H / 2

    const g = this.gridGraphics
    g.clear()
    g.lineStyle(1, 0xaabbaa, 0.3)

    const rangeCol = Math.ceil(width / halfW) + 6
    const rangeRow = Math.ceil((height - vanishY) / halfH) + 6

    const tileOffX = worldX / halfW
    const tileOffY = worldY / halfH
    const startCol = Math.floor((tileOffX - tileOffY) / 2) - 2
    const startRow = Math.floor((tileOffX + tileOffY) / 2) - 2

    for (let row = startRow; row < startRow + rangeRow; row++) {
      for (let col = startCol; col < startCol + rangeCol; col++) {
        const sx = (col - row) * halfW - worldX + width / 2
        const sy = (col + row) * halfH - worldY + vanishY + halfH * 2

        if (sy + halfH <= vanishY) continue
        if (sy - halfH > height) continue

        g.beginPath()
        g.moveTo(sx,          sy - halfH)
        g.lineTo(sx + halfW,  sy)
        g.lineTo(sx,          sy + halfH)
        g.lineTo(sx - halfW,  sy)
        g.closePath()
        g.strokePath()
      }
    }
  }

  update(_time: number, delta: number) {
    const { width, height } = this.scale
    const { vx, vy } = this.player.update(delta)
    worldX += vx
    worldY += vy

    // 텍스처 스크롤
    this.groundTile.setTilePosition(worldX, worldY)

    // 격자선 다시 그리기
    this.drawIsoGrid()

    const normalized = (height / 2) / height
    const scale = 0.5 + normalized * 0.8
    this.player.setScale(scale)
    this.playerShadow.setPosition(width / 2, height / 2 + 14 * scale)
    this.playerShadow.setScale(scale)
  }
}
