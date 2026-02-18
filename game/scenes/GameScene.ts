import * as Phaser from 'phaser'
import { Player } from '../entities/Player'

let worldX = 0
let worldY = 0

// 원근 설정
const VANISH_Y_RATIO = 0.02   // 소실점: 화면 거의 최상단 (각도 플랫하게)
const SCALE_FAR = 0.78         // 멀리(위) 타일 스케일
const SCALE_NEAR = 1.0         // 가까이(아래) 타일 스케일
const TILE_BASE = 72           // 기준 타일 크기 (near 기준)

// 렌더 타일 수: 멀리 = 더 많이, 가까이 = 더 적게
const ROWS_FAR = 22            // 위쪽 렌더 행 수
const ROWS_NEAR = 10           // 아래쪽 렌더 행 수
const TOTAL_ROWS = ROWS_FAR + ROWS_NEAR
const COLS = 24                // 가로 타일 수

export class GameScene extends Phaser.Scene {
  private player!: Player
  private gridGraphics!: Phaser.GameObjects.Graphics
  private playerShadow!: Phaser.GameObjects.Ellipse

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale

    this.gridGraphics = this.add.graphics()
    this.gridGraphics.setDepth(0)

    this.playerShadow = this.add.ellipse(width / 2, height / 2 + 12, 28, 8, 0x000000, 0.35)
    this.playerShadow.setDepth(9998)

    this.player = new Player(this, width / 2, height / 2)

    this.drawGrid()
  }

  update(_time: number, delta: number) {
    const { width, height } = this.scale
    const { vx, vy } = this.player.update(delta)
    worldX += vx
    worldY += vy

    // 플레이어 스케일: 화면 중앙 = 항상 동일
    const t = 0.5
    const scale = SCALE_FAR + (SCALE_NEAR - SCALE_FAR) * t
    this.player.setScale(scale)
    this.playerShadow.setPosition(width / 2, height / 2 + 12 * scale)
    this.playerShadow.setScale(scale, scale * 0.5)

    this.drawGrid()
  }

  private drawGrid() {
    const { width, height } = this.scale
    const g = this.gridGraphics
    g.clear()

    // 배경
    g.fillStyle(0x111122)
    g.fillRect(0, 0, width, height)

    const vanishX = width / 2
    const vanishY = height * VANISH_Y_RATIO
    const groundY = height          // 화면 하단

    // row별 스크린 Y 계산 (perspective-correct: 제곱 분포)
    // row=0 → 화면 하단(near), row=TOTAL_ROWS → 소실점(far)
    const rowScreenY = (row: number): number => {
      const t = row / TOTAL_ROWS                 // 0(near/bottom) ~ 1(far/top)
      const ease = 1 - Math.pow(1 - t, 2.2)     // ease-in: 위로 갈수록 빠르게 압축
      return groundY - (groundY - vanishY) * ease
    }

    // 월드 오프셋으로 타일 시작 인덱스 계산
    const tileWorldH = TILE_BASE
    const tileWorldW = TILE_BASE
    const startRow = Math.floor(worldY / tileWorldH)
    const startCol = Math.floor(worldX / tileWorldW) - Math.floor(COLS / 2)

    for (let row = 0; row < TOTAL_ROWS; row++) {
      const sy1 = rowScreenY(row)
      const sy2 = rowScreenY(row + 1)

      // row별 perspective scale (near=1.0, far=SCALE_FAR)
      const t = row / TOTAL_ROWS
      const perspScale = SCALE_NEAR - (SCALE_NEAR - SCALE_FAR) * t

      const tileScreenW = TILE_BASE * perspScale
      const rowWorldIndex = startRow - row

      for (let col = 0; col < COLS; col++) {
        const colWorldIndex = startCol + col

        // 체커보드 색
        const isEven = (colWorldIndex + rowWorldIndex) % 2 === 0
        const alpha = 0.15 + (1 - t) * 0.15

        // 타일 X 계산 (소실점에서 퍼지는 구조)
        // 화면 중앙 기준, col 오프셋 * perspScale
        const worldOffsetX = (colWorldIndex * tileWorldW - worldX) - width / 2
        const sx = vanishX + worldOffsetX * perspScale + tileScreenW / 2

        // 타일 사각형 그리기 (사다리꼴: 윗변/아랫변 다른 너비)
        const x1l = vanishX + (worldOffsetX) * (SCALE_FAR + (SCALE_NEAR - SCALE_FAR) * ((row + 1) / TOTAL_ROWS))
        const x1r = x1l + tileScreenW * ((SCALE_FAR + (SCALE_NEAR - SCALE_FAR) * ((row + 1) / TOTAL_ROWS)) / perspScale)
        const x0l = sx - tileScreenW / 2
        const x0r = sx + tileScreenW / 2

        if (isEven) {
          g.fillStyle(0x1e2255, alpha)
        } else {
          g.fillStyle(0x16193d, alpha)
        }

        g.fillPoints([
          { x: x0l, y: sy1 },
          { x: x0r, y: sy1 },
          { x: x1r, y: sy2 },
          { x: x1l, y: sy2 },
        ], true)

        g.lineStyle(1, 0x3344aa, alpha * 0.8)
        g.strokePoints([
          { x: x0l, y: sy1 },
          { x: x0r, y: sy1 },
          { x: x1r, y: sy2 },
          { x: x1l, y: sy2 },
        ], true)
      }
    }

    // 지평선 라인
    g.lineStyle(1, 0x445588, 0.4)
    g.beginPath()
    g.moveTo(0, vanishY)
    g.lineTo(width, vanishY)
    g.strokePath()
  }
}
