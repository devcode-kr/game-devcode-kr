import * as Phaser from 'phaser'
import { Player } from '../entities/Player'

// 월드 오프셋 (카메라 위치)
let worldX = 0
let worldY = 0

const GRID_SIZE = 80       // 타일 하나의 기본 크기
const GRID_COLS = 30
const GRID_ROWS = 30

export class GameScene extends Phaser.Scene {
  private player!: Player
  private gridGraphics!: Phaser.GameObjects.Graphics
  private playerShadow!: Phaser.GameObjects.Ellipse

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale

    // 격자 레이어 (배경)
    this.gridGraphics = this.add.graphics()
    this.gridGraphics.setDepth(0)

    // 플레이어 그림자 (화면 중앙)
    this.playerShadow = this.add.ellipse(width / 2, height / 2 + 10, 28, 10, 0x000000, 0.4)
    this.playerShadow.setDepth(9998)

    // 플레이어 (항상 화면 중앙)
    this.player = new Player(this, width / 2, height / 2)

    this.drawGrid()
  }

  update(_time: number, delta: number) {
    const { width, height } = this.scale

    // 플레이어 입력 받아 월드 오프셋 이동
    const { vx, vy } = this.player.update(delta)
    worldX += vx
    worldY += vy

    // perspective 스케일: 화면 중앙 y 기준 (항상 고정)
    const screenCenterY = height / 2
    const normalized = screenCenterY / height
    const scale = 0.5 + normalized * 0.8
    this.player.setScale(scale)

    // 그림자도 중앙에 고정
    this.playerShadow.setPosition(width / 2, height / 2 + 14 * scale)
    this.playerShadow.setScale(scale)

    this.drawGrid()
  }

  private drawGrid() {
    const { width, height } = this.scale
    const g = this.gridGraphics
    g.clear()

    // 하늘 그라디언트 (소실점 위쪽)
    const vanishX = width / 2
    const vanishY = height * 0.3   // 소실점 (화면 30% 지점)

    // 하늘: 위(어두운 남색) → 소실점(밝은 남색) 그라디언트
    const skySteps = 12
    for (let i = 0; i < skySteps; i++) {
      const t = i / skySteps
      const y = (vanishY / skySteps) * i
      const h = vanishY / skySteps + 1
      // 위쪽: 0x0a0a1a, 소실점: 0x1e2a5e
      const r = Math.round(0x0a + (0x1e - 0x0a) * t)
      const gv = Math.round(0x0a + (0x2a - 0x0a) * t)
      const b = Math.round(0x1a + (0x5e - 0x1a) * t)
      g.fillStyle((r << 16) | (gv << 8) | b)
      g.fillRect(0, y, width, h)
    }

    // 지면 배경
    g.fillStyle(0x1a1a2e)
    g.fillRect(0, vanishY, width, height - vanishY)

    // 지평선 글로우 (소실점 근처 밝은 띠)
    g.fillStyle(0x2a3a7a, 0.3)
    g.fillRect(0, vanishY - 6, width, 12)

    // 월드 오프셋 기반으로 격자 타일 그리기
    const tileW = GRID_SIZE
    const tileH = GRID_SIZE * 0.5  // 원근감을 위해 세로 압축

    // 화면에 보여야 할 타일 범위 계산
    const startCol = Math.floor(worldX / tileW) - 6  // 왼쪽 여유 확장
    const startRow = Math.floor(worldY / tileH) - 6  // 소실점 방향 5칸 추가
    const endCol = startCol + GRID_COLS + 10          // 오른쪽도 함께 확장
    const endRow = startRow + GRID_ROWS

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        // 타일의 월드 좌표
        const wx = col * tileW - worldX
        const wy = row * tileH - worldY

        // 스크린 Y 기준 perspective 계산
        const screenY = wy + height / 2
        const t = Phaser.Math.Clamp(screenY / height, 0, 1)
        const perspScale = 0.3 + t * 0.7

        // perspective 적용한 스크린 좌표
        const sx = vanishX + (wx - width / 2) * perspScale + (width / 2 - vanishX) * (1 - perspScale)
        const sy = vanishY + (screenY - vanishY) * perspScale

        const tw = tileW * perspScale
        const th = tileH * perspScale

        // 타일 그리기
        const alpha = 0.1 + t * 0.25
        g.lineStyle(1, 0x4455cc, alpha)
        g.strokeRect(sx - tw / 2, sy - th / 2, tw, th)

        // 체커보드 패턴
        if ((col + row) % 2 === 0) {
          g.fillStyle(0x22224a, 0.3 + t * 0.2)
          g.fillRect(sx - tw / 2 + 1, sy - th / 2 + 1, tw - 2, th - 2)
        }
      }
    }
  }
}
