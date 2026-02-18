import * as Phaser from 'phaser'
import { Player } from '../entities/Player'

let worldX = 0
let worldY = 0

const VANISH_Y_RATIO = 0.3
const TILE_W = 96   // 마름모 가로 폭
const TILE_H = 48   // 마름모 세로 높이 (절반으로 납작하게 = 2.5D 느낌)

export class GameScene extends Phaser.Scene {
  private player!: Player
  private playerShadow!: Phaser.GameObjects.Ellipse
  private skyImage!: Phaser.GameObjects.Image
  private floorGraphics!: Phaser.GameObjects.Graphics

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale
    const vanishY = height * VANISH_Y_RATIO

    // 하늘
    this.skyImage = this.add.image(width / 2, vanishY / 2, 'sky')
    this.skyImage.setDisplaySize(width, vanishY)
    this.skyImage.setDepth(0)

    // 마름모 바닥 그래픽
    this.floorGraphics = this.add.graphics()
    this.floorGraphics.setDepth(1)

    // 지평선 글로우
    const glow = this.add.graphics()
    glow.fillStyle(0x2a3a7a, 0.3)
    glow.fillRect(0, vanishY - 4, width, 8)
    glow.setDepth(4)

    // 플레이어 그림자
    this.playerShadow = this.add.ellipse(width / 2, height / 2 + 10, 28, 10, 0x000000, 0.5)
    this.playerShadow.setDepth(9998)

    // 플레이어
    this.player = new Player(this, width / 2, height / 2)

    this.drawIsoFloor()
  }

  private drawIsoFloor() {
    const { width, height } = this.scale
    const g = this.floorGraphics
    g.clear()

    const vanishY = height * VANISH_Y_RATIO
    const halfW = TILE_W / 2
    const halfH = TILE_H / 2

    // 화면을 채울 만큼 범위 계산
    const rangeCol = Math.ceil(width / halfW) + 6
    const rangeRow = Math.ceil((height - vanishY) / halfH) + 6

    // 월드 오프셋을 타일 좌표로 변환
    const tileOffX = worldX / halfW
    const tileOffY = worldY / halfH

    const startCol = Math.floor((tileOffX - tileOffY) / 2) - 2
    const startRow = Math.floor((tileOffX + tileOffY) / 2) - 2

    for (let row = startRow; row < startRow + rangeRow; row++) {
      for (let col = startCol; col < startCol + rangeCol; col++) {
        // 등각 투영: (col, row) → 화면 좌표
        const sx = (col - row) * halfW - worldX + width / 2
        const sy = (col + row) * halfH - worldY + vanishY + halfH * 2

        // 지평선 아래만 그림
        if (sy + halfH <= vanishY) continue
        if (sy - halfH > height) continue

        // 체커보드 색상
        const isDark = (col + row) % 2 === 0
        const fillColor = isDark ? 0x3a5c3a : 0x2e4a2e
        const lineColor = isDark ? 0x4a7a4a : 0x3a6a3a

        g.fillStyle(fillColor, 1)
        g.lineStyle(1, lineColor, 0.8)

        g.beginPath()
        g.moveTo(sx,           sy - halfH)  // 위
        g.lineTo(sx + halfW,   sy)           // 오른쪽
        g.lineTo(sx,           sy + halfH)  // 아래
        g.lineTo(sx - halfW,   sy)           // 왼쪽
        g.closePath()
        g.fillPath()
        g.strokePath()
      }
    }
  }

  update(_time: number, delta: number) {
    const { width, height } = this.scale
    const { vx, vy } = this.player.update(delta)
    worldX += vx
    worldY += vy

    this.drawIsoFloor()

    const normalized = (height / 2) / height
    const scale = 0.5 + normalized * 0.8
    this.player.setScale(scale)
    this.playerShadow.setPosition(width / 2, height / 2 + 14 * scale)
    this.playerShadow.setScale(scale)
  }
}
