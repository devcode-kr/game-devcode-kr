import * as Phaser from 'phaser'
import { Player } from '../entities/Player'

const GRID_COLS = 16
const GRID_ROWS = 12

export class GameScene extends Phaser.Scene {
  private player!: Player

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale

    this.drawPerspectiveGrid(width, height)
    this.player = new Player(this, width / 2, height / 2)
  }

  update(_time: number, delta: number) {
    this.player.update(delta)
  }

  private drawPerspectiveGrid(width: number, height: number) {
    const g = this.add.graphics()

    // 배경
    g.fillStyle(0x1a1a2e)
    g.fillRect(0, 0, width, height)

    // 수평선 (원근감: 위쪽일수록 촘촘)
    for (let row = 0; row <= GRID_ROWS; row++) {
      const t = row / GRID_ROWS
      // 원근 보정: easing으로 위쪽 압축
      const easedT = Math.pow(t, 2)
      const y = easedT * height

      const alpha = 0.15 + t * 0.3
      g.lineStyle(1, 0x4444aa, alpha)
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(width, y)
      g.strokePath()
    }

    // 수직선 (원근감: 위쪽에서 소실점으로 수렴)
    const vanishX = width / 2
    for (let col = 0; col <= GRID_COLS; col++) {
      const t = col / GRID_COLS
      // 화면 하단에서의 X 위치
      const bottomX = t * width

      const alpha = 0.1 + Math.abs(t - 0.5) * 0.2
      g.lineStyle(1, 0x4444aa, alpha)
      g.beginPath()
      g.moveTo(vanishX, 0)          // 소실점(위)
      g.lineTo(bottomX, height)     // 하단 퍼짐
      g.strokePath()
    }

    g.setDepth(0)
  }
}
