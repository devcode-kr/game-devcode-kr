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
  private groundTile!: Phaser.GameObjects.TileSprite
  private poolA: Phaser.GameObjects.Image[] = []
  private poolB: Phaser.GameObjects.Image[] = []

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale

    // ① 바닥 텍스처 (가장 밑에 깔리는 스크롤 레이어)
    this.groundTile = this.add.tileSprite(width / 2, height / 2, width, height, 'ground')
    this.groundTile.setDepth(0)

    // ② Graphics.generateTexture 로 마름모 타일 베이크 (100% 확실하게 동작)
    this.bakeDiamonds()

    // ③ 반투명 마름모 Image 풀 (depth 1, 바닥 위에 올라가는 체커보드 음영)
    for (let i = 0; i < POOL_SIZE; i++) {
      this.poolA.push(this.add.image(-9999, -9999, 'tile-a').setDepth(1).setAlpha(0.45))
      this.poolB.push(this.add.image(-9999, -9999, 'tile-b').setDepth(1).setAlpha(0.25))
    }

    // 플레이어 그림자
    this.playerShadow = this.add.ellipse(width / 2, height / 2 + 10, 28, 10, 0x000000, 0.5)
    this.playerShadow.setDepth(9998)

    // 플레이어
    this.player = new Player(this, width / 2, height / 2)

    this.drawIsoFloor()
  }

  /** Graphics.generateTexture 로 다이아몬드 2종 생성 */
  private bakeDiamonds() {
    const halfW = TILE_W / 2
    const halfH = TILE_H / 2

    const defs = [
      { key: 'tile-a', fill: 0x000000, line: 0xaabbaa }, // 어두운 타일
      { key: 'tile-b', fill: 0xffffff, line: 0xaabbaa }, // 밝은 타일
    ]

    for (const { key, fill, line } of defs) {
      if (this.textures.exists(key)) this.textures.remove(key)

      const g = this.add.graphics()
      g.fillStyle(fill, 1)
      g.lineStyle(1, line, 1)
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

    // 바닥 텍스처 스크롤
    this.groundTile.setTilePosition(worldX, worldY)

    // 마름모 타일 위치 갱신
    this.drawIsoFloor()

    this.player.setScale(1.0)
    this.playerShadow.setPosition(width / 2, height / 2 + 14)
  }
}
