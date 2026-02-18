import * as Phaser from 'phaser'
import { Player } from '../entities/Player'

let worldX = 0
let worldY = 0

const VANISH_Y_RATIO = 0.3

export class GameScene extends Phaser.Scene {
  private player!: Player
  private playerShadow!: Phaser.GameObjects.Ellipse
  private skyImage!: Phaser.GameObjects.Image
  private groundTile!: Phaser.GameObjects.TileSprite

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const { width, height } = this.scale
    const vanishY = height * VANISH_Y_RATIO
    const groundH = height - vanishY

    // 하늘 이미지
    this.skyImage = this.add.image(width / 2, vanishY / 2, 'sky')
    this.skyImage.setDisplaySize(width, vanishY)
    this.skyImage.setDepth(0)

    // 바닥: 원근 없는 단순 2D 타일 (화면 아랫부분 전체)
    this.groundTile = this.add.tileSprite(
      width / 2,
      vanishY + groundH / 2,
      width,
      groundH,
      'ground'
    )
    this.groundTile.setDepth(1)

    // 지평선 글로우
    const glow = this.add.graphics()
    glow.fillStyle(0x2a3a7a, 0.25)
    glow.fillRect(0, vanishY - 4, width, 8)
    glow.setDepth(4)

    // 플레이어 그림자
    this.playerShadow = this.add.ellipse(width / 2, height / 2 + 10, 28, 10, 0x000000, 0.5)
    this.playerShadow.setDepth(9998)

    // 플레이어
    this.player = new Player(this, width / 2, height / 2)
  }

  update(_time: number, delta: number) {
    const { width, height } = this.scale
    const { vx, vy } = this.player.update(delta)
    worldX += vx
    worldY += vy

    // 바닥 스크롤 (worldX/Y 그대로 반영)
    this.groundTile.setTilePosition(worldX, worldY)

    const normalized = (height / 2) / height
    const scale = 0.5 + normalized * 0.8
    this.player.setScale(scale)
    this.playerShadow.setPosition(width / 2, height / 2 + 14 * scale)
    this.playerShadow.setScale(scale)
  }
}
