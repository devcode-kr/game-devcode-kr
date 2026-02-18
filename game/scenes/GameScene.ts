import * as Phaser from 'phaser'
import { Player } from '../entities/Player'

let worldX = 0
let worldY = 0

const TILE_W = 96
const TILE_H = 48
const POOL_SIZE = 300  // 화면에 최대로 보이는 타일 수

export class GameScene extends Phaser.Scene {
  private player!: Player
  private playerShadow!: Phaser.GameObjects.Ellipse
  private poolA: Phaser.GameObjects.Image[] = []  // (col+row) % 2 === 0
  private poolB: Phaser.GameObjects.Image[] = []  // (col+row) % 2 === 1

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale

    this.cameras.main.setBackgroundColor(0x1a1a2e)

    // 등각투영 마름모 텍스처 베이크
    this.bakeDiamondTextures()

    // 타일 이미지 풀 생성 (화면 밖에 대기)
    for (let i = 0; i < POOL_SIZE; i++) {
      const a = this.add.image(-9999, -9999, 'tile-a').setDepth(1)
      const b = this.add.image(-9999, -9999, 'tile-b').setDepth(1)
      this.poolA.push(a)
      this.poolB.push(b)
    }

    // 플레이어 그림자
    this.playerShadow = this.add.ellipse(width / 2, height / 2 + 10, 28, 10, 0x000000, 0.5)
    this.playerShadow.setDepth(9998)

    // 플레이어
    this.player = new Player(this, width / 2, height / 2)

    this.drawIsoFloor()
  }

  /**
   * 정사각형 ground.png → 등각투영 마름모 텍스처 베이크
   * 변환 행렬: ctx.transform(0.5, 0.25, -0.5, 0.25, halfW, 0)
   *   (0,0)   → (halfW, 0)      ← 마름모 위 꼭짓점
   *   (TW,0)  → (TW,   halfH)   ← 오른쪽
   *   (TW,TW) → (halfW, TH)     ← 아래
   *   (0, TW) → (0,    halfH)   ← 왼쪽
   */
  private bakeDiamondTextures() {
    const groundImg = this.textures.get('ground').getSourceImage() as HTMLImageElement
    const halfW = TILE_W / 2
    const halfH = TILE_H / 2

    const variants: { key: string; darken: number }[] = [
      { key: 'tile-a', darken: 0 },
      { key: 'tile-b', darken: 0.2 },
    ]

    for (const { key, darken } of variants) {
      if (this.textures.exists(key)) this.textures.remove(key)

      const ct = this.textures.createCanvas(key, TILE_W, TILE_H)
      if (!ct) continue
      const ctx = ct.context

      // 마름모 클리핑
      ctx.beginPath()
      ctx.moveTo(halfW, 0)
      ctx.lineTo(TILE_W, halfH)
      ctx.lineTo(halfW, TILE_H)
      ctx.lineTo(0, halfH)
      ctx.closePath()
      ctx.clip()

      // 등각투영 변환 후 텍스처 그리기
      ctx.save()
      ctx.transform(0.5, 0.25, -0.5, 0.25, halfW, 0)
      ctx.drawImage(groundImg, 0, 0, TILE_W, TILE_W)
      ctx.restore()

      // 체커보드 명암
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
      ctx.strokeStyle = 'rgba(200,220,200,0.25)'
      ctx.lineWidth = 1
      ctx.stroke()

      ct.refresh()
    }
  }

  private drawIsoFloor() {
    const { width, height } = this.scale
    const halfW = TILE_W / 2  // 48
    const halfH = TILE_H / 2  // 24

    /**
     * 화면 중심(width/2, height/2)에 해당하는 타일 좌표:
     *   sx = (col-row)*halfW - worldX + width/2  = width/2  → col-row = worldX/halfW
     *   sy = (col+row)*halfH - worldY + height/2 = height/2 → col+row = worldY/halfH
     *   → col = (worldX/halfW + worldY/halfH) / 2
     *   → row = (worldY/halfH - worldX/halfW) / 2
     */
    const centerCol = Math.round((worldX / halfW + worldY / halfH) / 2)
    const centerRow = Math.round((worldY / halfH - worldX / halfW) / 2)

    const rC = Math.ceil(width  / halfW) + 2
    const rR = Math.ceil(height / halfH) + 2

    let idxA = 0
    let idxB = 0

    for (let col = centerCol - rC; col <= centerCol + rC; col++) {
      for (let row = centerRow - rR; row <= centerRow + rR; row++) {
        const sx = (col - row) * halfW - worldX + width  / 2
        const sy = (col + row) * halfH - worldY + height / 2

        // 화면 밖 스킵 (타일 반폭/반높이 만큼 여유)
        if (sx + halfW < 0 || sx - halfW > width)  continue
        if (sy + halfH < 0 || sy - halfH > height) continue

        if ((col + row) % 2 === 0) {
          if (idxA < this.poolA.length) {
            this.poolA[idxA++].setPosition(sx, sy)
          }
        } else {
          if (idxB < this.poolB.length) {
            this.poolB[idxB++].setPosition(sx, sy)
          }
        }
      }
    }

    // 미사용 풀 타일 화면 밖으로
    for (; idxA < this.poolA.length; idxA++) this.poolA[idxA].setPosition(-9999, -9999)
    for (; idxB < this.poolB.length; idxB++) this.poolB[idxB].setPosition(-9999, -9999)
  }

  update(_time: number, delta: number) {
    const { width, height } = this.scale
    const { vx, vy } = this.player.update(delta)
    worldX += vx
    worldY += vy

    this.drawIsoFloor()

    this.player.setScale(1.0)
    this.playerShadow.setPosition(width / 2, height / 2 + 14)
  }
}
