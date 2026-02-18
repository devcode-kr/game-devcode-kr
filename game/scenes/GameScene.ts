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

    // 하늘
    this.skyImage = this.add.image(width / 2, vanishY / 2, 'sky')
    this.skyImage.setDisplaySize(width, vanishY)
    this.skyImage.setDepth(0)

    // 마름모 타일 텍스처 베이크 (dark/light 두 종류)
    this.bakeDiamondTextures()

    // 바닥 렌더 텍스처 (전체 화면)
    this.floorRT = this.add.renderTexture(0, 0, width, height)
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

  private bakeDiamondTextures() {
    const halfW = TILE_W / 2
    const halfH = TILE_H / 2
    const groundSource = this.textures.get('ground').getSourceImage() as HTMLImageElement

    const variants = [
      { key: 'tile-dark',  tint: 'rgba(0,   0,   0,   0.25)' },
      { key: 'tile-light', tint: 'rgba(255, 255, 255, 0.08)' },
    ]

    for (const { key, tint } of variants) {
      // 기존 텍스처 있으면 제거 (씬 재시작 대비)
      if (this.textures.exists(key)) this.textures.remove(key)

      const canvas = this.textures.createCanvas(key, TILE_W, TILE_H)
      const ctx = canvas.context

      // 마름모 클리핑 경로
      ctx.beginPath()
      ctx.moveTo(halfW, 0)
      ctx.lineTo(TILE_W, halfH)
      ctx.lineTo(halfW, TILE_H)
      ctx.lineTo(0, halfH)
      ctx.closePath()
      ctx.clip()

      // ground 텍스처 그리기
      ctx.drawImage(groundSource, 0, 0, TILE_W, TILE_H)

      // 명암 오버레이 (체커보드 구분)
      ctx.fillStyle = tint
      ctx.fillRect(0, 0, TILE_W, TILE_H)

      // 테두리선
      ctx.beginPath()
      ctx.moveTo(halfW, 1)
      ctx.lineTo(TILE_W - 1, halfH)
      ctx.lineTo(halfW, TILE_H - 1)
      ctx.lineTo(1, halfH)
      ctx.closePath()
      ctx.strokeStyle = 'rgba(180, 200, 180, 0.35)'
      ctx.lineWidth = 1
      ctx.stroke()

      canvas.refresh()
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

        const tileKey = (col + row) % 2 === 0 ? 'tile-dark' : 'tile-light'
        // draw(key, x, y) — x,y는 타일 좌상단
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
