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
  private floorRT!: Phaser.GameObjects.RenderTexture

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

    // 등각투영 마름모 텍스처 베이크
    this.bakeDiamondTextures()

    // 바닥 렌더 텍스처
    this.floorRT = this.add.renderTexture(0, vanishY, width, groundH)
    this.floorRT.setDepth(1)

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

    this.drawIsoFloor()
  }

  /**
   * ground.png를 등각투영 변환 행렬로 마름모 모양에 맞게 베이크
   *
   * 변환 행렬 유도:
   *   정사각형 [0,TW]x[0,TW] → 마름모 꼭짓점:
   *     (0,0)   → top   (TW/2,  0)
   *     (TW,0)  → right (TW,    TH/2)
   *     (TW,TW) → bottom(TW/2,  TH)
   *     (0,TW)  → left  (0,     TH/2)
   *   ⇒ ctx.transform(0.5, 0.25, -0.5, 0.25, TW/2, 0)
   */
  private bakeDiamondTextures() {
    const groundImg = this.textures.get('ground').getSourceImage() as HTMLImageElement
    const halfW = TILE_W / 2
    const halfH = TILE_H / 2

    const variants: { key: string; darken: number }[] = [
      { key: 'tile-a', darken: 0 },
      { key: 'tile-b', darken: 0.18 },
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

      // 등각투영 변환 행렬 적용 후 텍스처 그리기
      ctx.save()
      ctx.transform(0.5, 0.25, -0.5, 0.25, halfW, 0)
      ctx.drawImage(groundImg, 0, 0, TILE_W, TILE_W)
      ctx.restore()

      // 체커보드 명암
      if (darken > 0) {
        ctx.fillStyle = `rgba(0,0,0,${darken})`
        ctx.fillRect(0, 0, TILE_W, TILE_H)
      }

      // 테두리
      ctx.beginPath()
      ctx.moveTo(halfW, 1)
      ctx.lineTo(TILE_W - 1, halfH)
      ctx.lineTo(halfW, TILE_H - 1)
      ctx.lineTo(1, halfH)
      ctx.closePath()
      ctx.strokeStyle = 'rgba(200,220,200,0.3)'
      ctx.lineWidth = 1
      ctx.stroke()

      ct.refresh()
    }
  }

  private drawIsoFloor() {
    const { width, height } = this.scale
    const vanishY = height * VANISH_Y_RATIO
    const halfW = TILE_W / 2
    const halfH = TILE_H / 2

    this.floorRT.clear()

    const rangeCol = Math.ceil(width / halfW) + 6
    const rangeRow = Math.ceil((height - vanishY) / halfH) + 6

    const startCol = Math.floor((worldX / halfW - worldY / halfH) / 2) - 2
    const startRow = Math.floor((worldX / halfW + worldY / halfH) / 2) - 2

    for (let row = startRow; row < startRow + rangeRow; row++) {
      for (let col = startCol; col < startCol + rangeCol; col++) {
        // 등각투영 화면 좌표 (floorRT 기준, 즉 vanishY 아래부터 시작)
        const sx = (col - row) * halfW - worldX + width / 2
        const sy = (col + row) * halfH - worldY + halfH * 2

        if (sy + halfH <= 0) continue
        if (sy - halfH > height - vanishY) continue

        const tileKey = (col + row) % 2 === 0 ? 'tile-a' : 'tile-b'
        this.floorRT.draw(tileKey, sx - halfW, sy - halfH)
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
