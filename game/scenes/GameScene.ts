import * as Phaser from 'phaser'
import { Player } from '../entities/Player'

let worldX = 0
let worldY = 0

const TILE_W = 96
const TILE_H = 48
const POOL_SIZE = 250

export class GameScene extends Phaser.Scene {
  private player!: Player
  private playerShadow!: Phaser.GameObjects.Ellipse
  private poolA: Phaser.GameObjects.Image[] = []
  private poolB: Phaser.GameObjects.Image[] = []

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale

    this.cameras.main.setBackgroundColor(0x111111)

    // 마름모 타일 텍스처 베이크 (ground.png 클리핑 or 단색 폴백)
    this.bakeDiamonds()

    // Image 풀 생성
    for (let i = 0; i < POOL_SIZE; i++) {
      this.poolA.push(this.add.image(-9999, -9999, 'tile-a').setDepth(1))
      this.poolB.push(this.add.image(-9999, -9999, 'tile-b').setDepth(1))
    }

    // 플레이어 그림자
    this.playerShadow = this.add.ellipse(width / 2, height / 2 + 10, 28, 10, 0x000000, 0.5)
    this.playerShadow.setDepth(9998)

    // 플레이어
    this.player = new Player(this, width / 2, height / 2)

    this.drawIsoFloor()
  }

  /**
   * ground.png 를 마름모 shape 으로 클리핑해서 tile-a / tile-b 텍스처 베이크.
   * tile-b 는 약간 어둡게 처리해 체커보드 구분.
   * Canvas API 실패 시 단색 Graphics 폴백.
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
        // ── 폴백: 단색 Graphics ──
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

  private drawIsoFloor() {
    const { width, height } = this.scale
    const halfW = TILE_W / 2
    const halfH = TILE_H / 2

    // 화면 중심에 해당하는 등각 타일 좌표
    const centerCol = Math.round((worldX / halfW + worldY / halfH) / 2)
    const centerRow = Math.round((worldY / halfH - worldX / halfW) / 2)

    const rC = Math.ceil(width  / halfW) + 3
    const rR = Math.ceil(height / halfH) + 3

    let idxA = 0
    let idxB = 0

    for (let col = centerCol - rC; col <= centerCol + rC; col++) {
      for (let row = centerRow - rR; row <= centerRow + rR; row++) {
        const sx = (col - row) * halfW - worldX + width  / 2
        const sy = (col + row) * halfH - worldY + height / 2

        if (sx + halfW < 0 || sx - halfW > width)  continue
        if (sy + halfH < 0 || sy - halfH > height) continue

        if ((col + row) % 2 === 0) {
          if (idxA < this.poolA.length) this.poolA[idxA++].setPosition(sx, sy)
        } else {
          if (idxB < this.poolB.length) this.poolB[idxB++].setPosition(sx, sy)
        }
      }
    }

    for (; idxA < this.poolA.length; idxA++) this.poolA[idxA].setPosition(-9999, -9999)
    for (; idxB < this.poolB.length; idxB++) this.poolB[idxB].setPosition(-9999, -9999)
  }

  update(_time: number, delta: number) {
    const { width, height } = this.scale
    const { vx, vy } = this.player.update(delta)
    worldX += vx
    worldY += vy

    // 마름모 타일 위치 갱신
    this.drawIsoFloor()

    this.player.setScale(1.0)
    this.playerShadow.setPosition(width / 2, height / 2 + 14)
  }
}
